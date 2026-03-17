/**
 * Unit tests for PhotoCropDialog component.
 *
 * Tests that the crop dialog preserves image format based on sourceType:
 * - PNG/WebP sources → PNG output (preserves transparency)
 * - JPEG sources → JPEG output
 * - No sourceType → JPEG output (backwards compatible)
 *
 * Also tests the full crop-and-confirm pipeline via component rendering.
 *
 * @group unit
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';

// ─── Mocks ──────────────────────────────────────────────────────────────────

// Mock react-easy-crop: renders a simple div and calls onCropComplete after
// a short delay so it runs AFTER the parent's open-reset effect (which sets
// croppedAreaPixels back to null on mount).
vi.mock('react-easy-crop', () => ({
  __esModule: true,
  default: function MockCropper(props: any) {
    React.useEffect(() => {
      const id = setTimeout(() => {
        props.onCropComplete?.(
          { x: 0, y: 0, width: 100, height: 100 },
          { x: 0, y: 0, width: 100, height: 100 }
        );
      }, 5);
      return () => clearTimeout(id);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return <div data-testid="mock-cropper" />;
  },
}));

// Mock Radix Dialog to avoid portal rendering issues in jsdom
vi.mock('@/components/UI/dialog', () => ({
  Dialog: ({ children, open }: any) => (open ? <div data-testid="dialog">{children}</div> : null),
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
}));

// Mock Slider (uses Radix)
vi.mock('@/components/UI/slider', () => ({
  Slider: (props: any) => <input data-testid="zoom-slider" type="range" />,
}));

// ─── Import after mocks ────────────────────────────────────────────────────

import { PhotoCropDialog, outputMime, outputExtension } from '@/components/UI/PhotoCropDialog';

/** Flush pending timers (e.g. mock Cropper's delayed onCropComplete) */
async function flushCropperEffect() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 10));
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function setupCanvasAndImageMocks() {
  let capturedToBlobMime: string | undefined;
  let capturedToBlobQuality: number | undefined;
  const allContexts: Array<ReturnType<typeof makeCtx>> = [];

  function makeCtx() {
    return {
      translate: vi.fn(),
      rotate: vi.fn(),
      scale: vi.fn(),
      drawImage: vi.fn(),
    };
  }

  function makeMockCanvas() {
    const ctx = makeCtx();
    allContexts.push(ctx);
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ctx),
      toBlob: vi.fn(
        (callback: BlobCallback, type?: string, quality?: number) => {
          capturedToBlobMime = type;
          capturedToBlobQuality = quality;
          callback(new Blob(['test-image-data'], { type: type || 'image/png' }));
        }
      ),
    };
    return canvas;
  }

  const realCreateElement = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation(
    (tagName: string, options?: ElementCreationOptions) => {
      if (tagName === 'canvas') {
        return makeMockCanvas() as any;
      }
      return realCreateElement(tagName, options);
    }
  );

  // Mock window.Image so createImage resolves synchronously.
  // The listener is registered BEFORE src is set in createImage(), so
  // firing synchronously from the setter is safe and avoids async timing issues.
  const OrigImage = window.Image;
  class MockImage {
    width = 100;
    height = 100;
    crossOrigin = '';
    private _src = '';
    private _loadListeners: Function[] = [];

    get src() {
      return this._src;
    }
    set src(value: string) {
      this._src = value;
      this._loadListeners.forEach((fn) => fn());
    }
    addEventListener(event: string, handler: Function) {
      if (event === 'load') this._loadListeners.push(handler);
    }
    removeEventListener() {}
  }
  Object.defineProperty(window, 'Image', {
    value: MockImage,
    writable: true,
    configurable: true,
  });

  return {
    getCapturedMime: () => capturedToBlobMime,
    getCapturedQuality: () => capturedToBlobQuality,
    getAllContexts: () => allContexts,
    cleanup: () => {
      vi.restoreAllMocks();
      Object.defineProperty(window, 'Image', {
        value: OrigImage,
        writable: true,
        configurable: true,
      });
    },
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('PhotoCropDialog', () => {
  describe('outputMime', () => {
    it(
      'returns image/png for PNG source',
      {
        meta: {
          alias: 'OutputMime-PNG',
          scenario: 'Source image is PNG (supports transparency)',
          behavior: 'Returns image/png to preserve alpha channel',
        },
      },
      () => {
        expect(outputMime('image/png')).toBe('image/png');
      }
    );

    it(
      'returns image/png for WebP source',
      {
        meta: {
          alias: 'OutputMime-WebP',
          scenario: 'Source image is WebP (supports transparency)',
          behavior: 'Returns image/png to preserve alpha channel',
        },
      },
      () => {
        expect(outputMime('image/webp')).toBe('image/png');
      }
    );

    it(
      'returns image/jpeg for JPEG source',
      {
        meta: {
          alias: 'OutputMime-JPEG',
          scenario: 'Source image is JPEG (no transparency)',
          behavior: 'Returns image/jpeg for optimal compression',
        },
      },
      () => {
        expect(outputMime('image/jpeg')).toBe('image/jpeg');
      }
    );

    it(
      'returns image/jpeg for GIF source',
      {
        meta: {
          alias: 'OutputMime-GIF',
          scenario: 'Source image is GIF (animation lost during crop)',
          behavior: 'Returns image/jpeg as fallback',
        },
      },
      () => {
        expect(outputMime('image/gif')).toBe('image/jpeg');
      }
    );

    it(
      'returns image/jpeg when sourceType is undefined',
      {
        meta: {
          alias: 'OutputMime-Undefined',
          scenario: 'No sourceType provided (backwards compatibility)',
          behavior: 'Defaults to image/jpeg',
        },
      },
      () => {
        expect(outputMime(undefined)).toBe('image/jpeg');
      }
    );

    it(
      'returns image/jpeg for empty string sourceType',
      {
        meta: {
          alias: 'OutputMime-EmptyString',
          scenario: 'sourceType is an empty string',
          behavior: 'Defaults to image/jpeg',
        },
      },
      () => {
        expect(outputMime('')).toBe('image/jpeg');
      }
    );
  });

  describe('outputExtension', () => {
    it(
      'returns .png for image/png mime',
      {
        meta: {
          alias: 'OutputExt-PNG',
          scenario: 'MIME type is image/png',
          behavior: 'Returns .png extension',
        },
      },
      () => {
        expect(outputExtension('image/png')).toBe('.png');
      }
    );

    it(
      'returns .jpg for image/jpeg mime',
      {
        meta: {
          alias: 'OutputExt-JPEG',
          scenario: 'MIME type is image/jpeg',
          behavior: 'Returns .jpg extension',
        },
      },
      () => {
        expect(outputExtension('image/jpeg')).toBe('.jpg');
      }
    );

    it(
      'returns .jpg for any non-png mime',
      {
        meta: {
          alias: 'OutputExt-Fallback',
          scenario: 'MIME type is not image/png',
          behavior: 'Defaults to .jpg extension',
        },
      },
      () => {
        expect(outputExtension('image/webp')).toBe('.jpg');
        expect(outputExtension('image/gif')).toBe('.jpg');
      }
    );
  });

  describe('Component crop pipeline', () => {
    let mocks: ReturnType<typeof setupCanvasAndImageMocks>;

    beforeEach(() => {
      mocks = setupCanvasAndImageMocks();
    });

    afterEach(() => {
      mocks.cleanup();
    });

    it(
      'produces a PNG file when sourceType is image/png',
      {
        meta: {
          alias: 'CropPipeline-PNG',
          scenario: 'User crops a PNG image with transparency',
          behavior: 'onConfirm receives a .png File with image/png type',
        },
      },
      async () => {
        const onConfirm = vi.fn();
        const onCancel = vi.fn();

        await act(async () => {
          render(
            <PhotoCropDialog
              imageSrc="blob:http://localhost/test-png"
              open={true}
              onConfirm={onConfirm}
              onCancel={onCancel}
              sourceType="image/png"
            />
          );
        });

        await flushCropperEffect();

        await act(async () => {
          fireEvent.click(screen.getByRole('button', { name: /apply/i }));
        });

        expect(onConfirm).toHaveBeenCalledTimes(1);
        const file: File = onConfirm.mock.calls[0][0];
        expect(file.type).toBe('image/png');
        expect(file.name).toBe('cropped-photo.png');
        expect(mocks.getCapturedMime()).toBe('image/png');
        expect(mocks.getCapturedQuality()).toBeUndefined();
      }
    );

    it(
      'produces a PNG file when sourceType is image/webp',
      {
        meta: {
          alias: 'CropPipeline-WebP',
          scenario: 'User crops a WebP image (may have transparency)',
          behavior: 'onConfirm receives a .png File with image/png type',
        },
      },
      async () => {
        const onConfirm = vi.fn();
        const onCancel = vi.fn();

        await act(async () => {
          render(
            <PhotoCropDialog
              imageSrc="blob:http://localhost/test-webp"
              open={true}
              onConfirm={onConfirm}
              onCancel={onCancel}
              sourceType="image/webp"
            />
          );
        });

        await flushCropperEffect();

        await act(async () => {
          fireEvent.click(screen.getByRole('button', { name: /apply/i }));
        });

        expect(onConfirm).toHaveBeenCalledTimes(1);
        const file: File = onConfirm.mock.calls[0][0];
        expect(file.type).toBe('image/png');
        expect(file.name).toBe('cropped-photo.png');
        expect(mocks.getCapturedMime()).toBe('image/png');
        expect(mocks.getCapturedQuality()).toBeUndefined();
      }
    );

    it(
      'produces a JPEG file when sourceType is image/jpeg',
      {
        meta: {
          alias: 'CropPipeline-JPEG',
          scenario: 'User crops a JPEG image',
          behavior: 'onConfirm receives a .jpg File with image/jpeg type and quality 0.92',
        },
      },
      async () => {
        const onConfirm = vi.fn();
        const onCancel = vi.fn();

        await act(async () => {
          render(
            <PhotoCropDialog
              imageSrc="blob:http://localhost/test-jpeg"
              open={true}
              onConfirm={onConfirm}
              onCancel={onCancel}
              sourceType="image/jpeg"
            />
          );
        });

        await flushCropperEffect();

        await act(async () => {
          fireEvent.click(screen.getByRole('button', { name: /apply/i }));
        });

        expect(onConfirm).toHaveBeenCalledTimes(1);
        const file: File = onConfirm.mock.calls[0][0];
        expect(file.type).toBe('image/jpeg');
        expect(file.name).toBe('cropped-photo.jpg');
        expect(mocks.getCapturedMime()).toBe('image/jpeg');
        expect(mocks.getCapturedQuality()).toBe(0.92);
      }
    );

    it(
      'defaults to JPEG when sourceType is not provided',
      {
        meta: {
          alias: 'CropPipeline-NoSourceType',
          scenario: 'sourceType prop is omitted (backwards compatibility)',
          behavior: 'onConfirm receives a .jpg File with image/jpeg type',
        },
      },
      async () => {
        const onConfirm = vi.fn();
        const onCancel = vi.fn();

        await act(async () => {
          render(
            <PhotoCropDialog
              imageSrc="blob:http://localhost/test-default"
              open={true}
              onConfirm={onConfirm}
              onCancel={onCancel}
            />
          );
        });

        await flushCropperEffect();

        await act(async () => {
          fireEvent.click(screen.getByRole('button', { name: /apply/i }));
        });

        expect(onConfirm).toHaveBeenCalledTimes(1);
        const file: File = onConfirm.mock.calls[0][0];
        expect(file.type).toBe('image/jpeg');
        expect(file.name).toBe('cropped-photo.jpg');
        expect(mocks.getCapturedMime()).toBe('image/jpeg');
        expect(mocks.getCapturedQuality()).toBe(0.92);
      }
    );

    it(
      'calls onCancel when dialog is closed without confirming',
      {
        meta: {
          alias: 'CropPipeline-Cancel',
          scenario: 'User clicks Cancel button',
          behavior: 'onCancel is called and onConfirm is not',
        },
      },
      async () => {
        const onConfirm = vi.fn();
        const onCancel = vi.fn();

        render(
          <PhotoCropDialog
            imageSrc="blob:http://localhost/test"
            open={true}
            onConfirm={onConfirm}
            onCancel={onCancel}
            sourceType="image/png"
          />
        );

        const cancelButton = screen.getByRole('button', { name: /cancel/i });
        fireEvent.click(cancelButton);

        expect(onCancel).toHaveBeenCalledTimes(1);
        expect(onConfirm).not.toHaveBeenCalled();
      }
    );

    it(
      'does not render content when open is false',
      {
        meta: {
          alias: 'CropPipeline-Closed',
          scenario: 'Dialog is not open',
          behavior: 'No dialog content is rendered',
        },
      },
      () => {
        render(
          <PhotoCropDialog
            imageSrc="blob:http://localhost/test"
            open={false}
            onConfirm={vi.fn()}
            onCancel={vi.fn()}
          />
        );

        expect(screen.queryByText('Adjust Photo')).toBeNull();
        expect(screen.queryByRole('button', { name: /apply/i })).toBeNull();
      }
    );

    it(
      'applies horizontal flip via a third canvas when flip-H is toggled',
      {
        meta: {
          alias: 'CropPipeline-FlipH',
          scenario: 'User toggles Flip Horizontal before applying',
          behavior: 'getCroppedBlob creates a third canvas and calls scale(-1, 1)',
        },
      },
      async () => {
        const onConfirm = vi.fn();
        const onCancel = vi.fn();

        await act(async () => {
          render(
            <PhotoCropDialog
              imageSrc="blob:http://localhost/test-fliph"
              open={true}
              onConfirm={onConfirm}
              onCancel={onCancel}
              sourceType="image/png"
            />
          );
        });

        await flushCropperEffect();

        await act(async () => {
          fireEvent.click(screen.getByRole('button', { name: /flip horizontal/i }));
        });

        await act(async () => {
          fireEvent.click(screen.getByRole('button', { name: /apply/i }));
        });

        expect(onConfirm).toHaveBeenCalledTimes(1);

        const contexts = mocks.getAllContexts();
        // 3 canvases: rotation, crop, flip
        expect(contexts.length).toBe(3);
        const flipCtx = contexts[2];
        expect(flipCtx.scale).toHaveBeenCalledWith(-1, 1);
        expect(flipCtx.translate).toHaveBeenCalled();
        expect(flipCtx.drawImage).toHaveBeenCalled();
      }
    );

    it(
      'applies vertical flip via a third canvas when flip-V is toggled',
      {
        meta: {
          alias: 'CropPipeline-FlipV',
          scenario: 'User toggles Flip Vertical before applying',
          behavior: 'getCroppedBlob creates a third canvas and calls scale(1, -1)',
        },
      },
      async () => {
        const onConfirm = vi.fn();
        const onCancel = vi.fn();

        await act(async () => {
          render(
            <PhotoCropDialog
              imageSrc="blob:http://localhost/test-flipv"
              open={true}
              onConfirm={onConfirm}
              onCancel={onCancel}
              sourceType="image/png"
            />
          );
        });

        await flushCropperEffect();

        await act(async () => {
          fireEvent.click(screen.getByRole('button', { name: /flip vertical/i }));
        });

        await act(async () => {
          fireEvent.click(screen.getByRole('button', { name: /apply/i }));
        });

        expect(onConfirm).toHaveBeenCalledTimes(1);

        const contexts = mocks.getAllContexts();
        expect(contexts.length).toBe(3);
        const flipCtx = contexts[2];
        expect(flipCtx.scale).toHaveBeenCalledWith(1, -1);
      }
    );

    it(
      'does not create a flip canvas when neither flip is active',
      {
        meta: {
          alias: 'CropPipeline-NoFlip',
          scenario: 'User applies crop without toggling any flip',
          behavior: 'Only 2 canvases are created (rotation + crop)',
        },
      },
      async () => {
        const onConfirm = vi.fn();
        const onCancel = vi.fn();

        await act(async () => {
          render(
            <PhotoCropDialog
              imageSrc="blob:http://localhost/test-noflip"
              open={true}
              onConfirm={onConfirm}
              onCancel={onCancel}
              sourceType="image/png"
            />
          );
        });

        await flushCropperEffect();

        await act(async () => {
          fireEvent.click(screen.getByRole('button', { name: /apply/i }));
        });

        expect(onConfirm).toHaveBeenCalledTimes(1);

        const contexts = mocks.getAllContexts();
        expect(contexts.length).toBe(2);
      }
    );

    it(
      'renders counter-clockwise rotation button',
      {
        meta: {
          alias: 'CropPipeline-RotateCcw',
          scenario: 'Dialog is open',
          behavior: 'Counter-clockwise rotation button is present and clickable',
        },
      },
      async () => {
        await act(async () => {
          render(
            <PhotoCropDialog
              imageSrc="blob:http://localhost/test-ccw"
              open={true}
              onConfirm={vi.fn()}
              onCancel={vi.fn()}
            />
          );
        });

        const ccwButton = screen.getByRole('button', { name: /rotate counter-clockwise/i });
        expect(ccwButton).toBeTruthy();

        const cwButton = screen.getByRole('button', { name: /rotate clockwise/i });
        expect(cwButton).toBeTruthy();
      }
    );
  });
});
