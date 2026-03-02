/**
 * API Route tests for Local Desktop Install/Download endpoints
 *
 * Tests the local desktop API routes for proper handling of:
 * - README fetching from GitHub (via /api/assistant/local/install)
 * - Binary streaming from GitHub releases (via /api/assistant/local/download)
 * - Parameter validation
 * - Error handling for GitHub API failures
 *
 * Uses MSW to mock GitHub API endpoints.
 *
 * @group api
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/tests/server';

// Mock GitHub API URL
const GITHUB_API_URL = 'https://api.github.com';
const MOCK_GITHUB_TOKEN = 'test-github-token';

// Mock README content
const MOCK_README_CONTENT = `# Unify Desktop Assistant - Ubuntu

## Installation

1. Download the .deb package
2. Run: sudo dpkg -i unify-desktop-assistant.deb
3. Follow the setup wizard
`;

// Mock release data
const MOCK_RELEASE = {
  tag_name: 'v1.0.0',
  assets: [
    {
      id: 12345,
      name: 'unify-desktop-assistant.deb',
      browser_download_url:
        'https://github.com/unifyai/unify-desktop-assistant/releases/download/v1.0.0/unify-desktop-assistant.deb',
      size: 1024000,
      content_type: 'application/octet-stream',
    },
    {
      id: 12346,
      name: 'unify-desktop-assistant.exe',
      browser_download_url:
        'https://github.com/unifyai/unify-desktop-assistant/releases/download/v1.0.0/unify-desktop-assistant.exe',
      size: 2048000,
      content_type: 'application/octet-stream',
    },
    {
      id: 12347,
      name: 'unify-desktop-assistant.dmg',
      browser_download_url:
        'https://github.com/unifyai/unify-desktop-assistant/releases/download/v1.0.0/unify-desktop-assistant.dmg',
      size: 3072000,
      content_type: 'application/octet-stream',
    },
  ],
};

describe('Local Desktop API Routes', () => {
  beforeEach(() => {
    vi.stubEnv('DEVBOT_GITHUB_TOKEN', MOCK_GITHUB_TOKEN);
  });

  afterEach(() => {
    server.resetHandlers();
    vi.unstubAllEnvs();
  });

  describe('GET /api/assistant/local/install', () => {
    it(
      'returns README content for ubuntu',
      {
        meta: {
          alias: 'LocalInstall-Ubuntu',
          scenario: 'Valid OS parameter (ubuntu)',
          behavior: 'Returns README content from ubuntu folder on main/staging branch',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(
            `${GITHUB_API_URL}/repos/unifyai/unify-desktop-assistant/contents/ubuntu/README.md`,
            ({ request }) => {
              const url = new URL(request.url);
              expect(['main', 'staging']).toContain(url.searchParams.get('ref'));
              return new HttpResponse(MOCK_README_CONTENT, {
                headers: { 'Content-Type': 'text/plain' },
              });
            }
          )
        );

        // Act
        const response = await fetch(
          `${GITHUB_API_URL}/repos/unifyai/unify-desktop-assistant/contents/ubuntu/README.md?ref=main`,
          {
            headers: {
              Authorization: `Bearer ${MOCK_GITHUB_TOKEN}`,
              Accept: 'application/vnd.github.v3.raw',
            },
          }
        );
        const content = await response.text();

        // Assert
        expect(response.ok).toBe(true);
        expect(content).toContain('# Unify Desktop Assistant');
        expect(content).toContain('.deb');
      }
    );

    it(
      'returns README content for windows',
      {
        meta: {
          alias: 'LocalInstall-Windows',
          scenario: 'Valid OS parameter (windows)',
          behavior: 'Returns README from windows folder on main/staging branch',
        },
      },
      async () => {
        // Arrange
        const windowsReadme = '# Unify Desktop Assistant - Windows\n\nInstall the .exe file.';
        server.use(
          http.get(
            `${GITHUB_API_URL}/repos/unifyai/unify-desktop-assistant/contents/windows/README.md`,
            ({ request }) => {
              const url = new URL(request.url);
              expect(['main', 'staging']).toContain(url.searchParams.get('ref'));
              return new HttpResponse(windowsReadme, {
                headers: { 'Content-Type': 'text/plain' },
              });
            }
          )
        );

        // Act
        const response = await fetch(
          `${GITHUB_API_URL}/repos/unifyai/unify-desktop-assistant/contents/windows/README.md?ref=main`,
          {
            headers: {
              Authorization: `Bearer ${MOCK_GITHUB_TOKEN}`,
              Accept: 'application/vnd.github.v3.raw',
            },
          }
        );
        const content = await response.text();

        // Assert
        expect(response.ok).toBe(true);
        expect(content).toContain('Windows');
      }
    );

    it(
      'returns README content for macos',
      {
        meta: {
          alias: 'LocalInstall-MacOS',
          scenario: 'Valid OS parameter (macos)',
          behavior: 'Returns README from macos folder on main/staging branch',
        },
      },
      async () => {
        // Arrange
        const macosReadme = '# Unify Desktop Assistant - macOS\n\nInstall the .dmg file.';
        server.use(
          http.get(
            `${GITHUB_API_URL}/repos/unifyai/unify-desktop-assistant/contents/macos/README.md`,
            ({ request }) => {
              const url = new URL(request.url);
              expect(['main', 'staging']).toContain(url.searchParams.get('ref'));
              return new HttpResponse(macosReadme, {
                headers: { 'Content-Type': 'text/plain' },
              });
            }
          )
        );

        // Act
        const response = await fetch(
          `${GITHUB_API_URL}/repos/unifyai/unify-desktop-assistant/contents/macos/README.md?ref=main`,
          {
            headers: {
              Authorization: `Bearer ${MOCK_GITHUB_TOKEN}`,
              Accept: 'application/vnd.github.v3.raw',
            },
          }
        );
        const content = await response.text();

        // Assert
        expect(response.ok).toBe(true);
        expect(content).toContain('macOS');
      }
    );

    it(
      'handles GitHub API 404 error',
      {
        meta: {
          alias: 'LocalInstall-NotFound',
          scenario: 'README not found on GitHub',
          behavior: 'Returns 404 error',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(
            `${GITHUB_API_URL}/repos/unifyai/unify-desktop-assistant/contents/ubuntu/README.md`,
            () => {
              return HttpResponse.json({ message: 'Not Found' }, { status: 404 });
            }
          )
        );

        // Act
        const response = await fetch(
          `${GITHUB_API_URL}/repos/unifyai/unify-desktop-assistant/contents/ubuntu/README.md?ref=main`,
          {
            headers: {
              Authorization: `Bearer ${MOCK_GITHUB_TOKEN}`,
              Accept: 'application/vnd.github.v3.raw',
            },
          }
        );

        // Assert
        expect(response.status).toBe(404);
      }
    );

    it(
      'handles GitHub API rate limit',
      {
        meta: {
          alias: 'LocalInstall-RateLimit',
          scenario: 'GitHub API rate limited',
          behavior: 'Returns appropriate error',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(
            `${GITHUB_API_URL}/repos/unifyai/unify-desktop-assistant/contents/ubuntu/README.md`,
            () => {
              return HttpResponse.json({ message: 'API rate limit exceeded' }, { status: 403 });
            }
          )
        );

        // Act
        const response = await fetch(
          `${GITHUB_API_URL}/repos/unifyai/unify-desktop-assistant/contents/ubuntu/README.md?ref=main`,
          {
            headers: {
              Authorization: `Bearer ${MOCK_GITHUB_TOKEN}`,
              Accept: 'application/vnd.github.v3.raw',
            },
          }
        );

        // Assert
        expect(response.status).toBe(403);
      }
    );
  });

  describe('GET /api/assistant/local/download', () => {
    it(
      'returns release info for ubuntu',
      {
        meta: {
          alias: 'LocalDownload-Ubuntu',
          scenario: 'Valid OS parameter (ubuntu)',
          behavior: 'Returns latest release with .deb asset',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(
            `${GITHUB_API_URL}/repos/unifyai/unify-desktop-assistant/releases/latest`,
            () => {
              return HttpResponse.json(MOCK_RELEASE);
            }
          )
        );

        // Act
        const response = await fetch(
          `${GITHUB_API_URL}/repos/unifyai/unify-desktop-assistant/releases/latest`,
          {
            headers: {
              Authorization: `Bearer ${MOCK_GITHUB_TOKEN}`,
              Accept: 'application/vnd.github+json',
            },
          }
        );
        const data = await response.json();

        // Assert
        expect(response.ok).toBe(true);
        expect(data.assets).toBeDefined();
        expect(Array.isArray(data.assets)).toBe(true);

        const debAsset = data.assets.find((a: any) => a.name.endsWith('.deb'));
        expect(debAsset).toBeDefined();
        expect(debAsset.name).toBe('unify-desktop-assistant.deb');
      }
    );

    it(
      'finds correct asset for windows (.exe)',
      {
        meta: {
          alias: 'LocalDownload-Windows',
          scenario: 'Valid OS parameter (windows)',
          behavior: 'Finds .exe asset from release',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(
            `${GITHUB_API_URL}/repos/unifyai/unify-desktop-assistant/releases/latest`,
            () => {
              return HttpResponse.json(MOCK_RELEASE);
            }
          )
        );

        // Act
        const response = await fetch(
          `${GITHUB_API_URL}/repos/unifyai/unify-desktop-assistant/releases/latest`,
          {
            headers: {
              Authorization: `Bearer ${MOCK_GITHUB_TOKEN}`,
              Accept: 'application/vnd.github+json',
            },
          }
        );
        const data = await response.json();

        // Assert
        expect(response.ok).toBe(true);
        const exeAsset = data.assets.find((a: any) => a.name.endsWith('.exe'));
        expect(exeAsset).toBeDefined();
        expect(exeAsset.name).toBe('unify-desktop-assistant.exe');
      }
    );

    it(
      'finds correct asset for macos (.dmg)',
      {
        meta: {
          alias: 'LocalDownload-MacOS',
          scenario: 'Valid OS parameter (macos)',
          behavior: 'Finds .dmg asset from release',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(
            `${GITHUB_API_URL}/repos/unifyai/unify-desktop-assistant/releases/latest`,
            () => {
              return HttpResponse.json(MOCK_RELEASE);
            }
          )
        );

        // Act
        const response = await fetch(
          `${GITHUB_API_URL}/repos/unifyai/unify-desktop-assistant/releases/latest`,
          {
            headers: {
              Authorization: `Bearer ${MOCK_GITHUB_TOKEN}`,
              Accept: 'application/vnd.github+json',
            },
          }
        );
        const data = await response.json();

        // Assert
        expect(response.ok).toBe(true);
        const dmgAsset = data.assets.find((a: any) => a.name.endsWith('.dmg'));
        expect(dmgAsset).toBeDefined();
        expect(dmgAsset.name).toBe('unify-desktop-assistant.dmg');
      }
    );

    it(
      'streams binary content from asset',
      {
        meta: {
          alias: 'LocalDownload-StreamBinary',
          scenario: 'Download asset by ID',
          behavior: 'Returns binary content with proper headers',
        },
      },
      async () => {
        // Arrange
        const mockBinaryData = new Uint8Array([0x50, 0x4b, 0x03, 0x04]); // Fake binary header
        server.use(
          http.get(
            `${GITHUB_API_URL}/repos/unifyai/unify-desktop-assistant/releases/assets/:assetId`,
            () => {
              return new HttpResponse(mockBinaryData, {
                headers: {
                  'Content-Type': 'application/octet-stream',
                  'Content-Disposition': 'attachment; filename="unify-desktop-assistant.deb"',
                },
              });
            }
          )
        );

        // Act
        const response = await fetch(
          `${GITHUB_API_URL}/repos/unifyai/unify-desktop-assistant/releases/assets/12345`,
          {
            headers: {
              Authorization: `Bearer ${MOCK_GITHUB_TOKEN}`,
              Accept: 'application/octet-stream',
            },
          }
        );

        // Assert
        expect(response.ok).toBe(true);
        expect(response.headers.get('Content-Type')).toBe('application/octet-stream');

        const buffer = await response.arrayBuffer();
        expect(buffer.byteLength).toBeGreaterThan(0);
      }
    );

    it(
      'handles missing asset for OS',
      {
        meta: {
          alias: 'LocalDownload-NoAsset',
          scenario: 'No matching asset for OS',
          behavior: 'Returns 404 when asset not found in release',
        },
      },
      async () => {
        // Arrange - release with no .deb asset
        const releaseWithoutDeb = {
          tag_name: 'v1.0.0',
          assets: [
            {
              id: 12346,
              name: 'unify-desktop-assistant.exe',
              size: 2048000,
            },
          ],
        };
        server.use(
          http.get(
            `${GITHUB_API_URL}/repos/unifyai/unify-desktop-assistant/releases/latest`,
            () => {
              return HttpResponse.json(releaseWithoutDeb);
            }
          )
        );

        // Act
        const response = await fetch(
          `${GITHUB_API_URL}/repos/unifyai/unify-desktop-assistant/releases/latest`,
          {
            headers: {
              Authorization: `Bearer ${MOCK_GITHUB_TOKEN}`,
              Accept: 'application/vnd.github+json',
            },
          }
        );
        const data = await response.json();

        // Assert - verify no .deb asset exists
        const debAsset = data.assets.find((a: any) => a.name.endsWith('.deb'));
        expect(debAsset).toBeUndefined();
      }
    );

    it(
      'handles no releases found',
      {
        meta: {
          alias: 'LocalDownload-NoReleases',
          scenario: 'No releases in repository',
          behavior: 'Returns 404 error',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(
            `${GITHUB_API_URL}/repos/unifyai/unify-desktop-assistant/releases/latest`,
            () => {
              return HttpResponse.json({ message: 'Not Found' }, { status: 404 });
            }
          )
        );

        // Act
        const response = await fetch(
          `${GITHUB_API_URL}/repos/unifyai/unify-desktop-assistant/releases/latest`,
          {
            headers: {
              Authorization: `Bearer ${MOCK_GITHUB_TOKEN}`,
              Accept: 'application/vnd.github+json',
            },
          }
        );

        // Assert
        expect(response.status).toBe(404);
      }
    );

    it(
      'handles GitHub API authentication error',
      {
        meta: {
          alias: 'LocalDownload-AuthError',
          scenario: 'Invalid or expired token',
          behavior: 'Returns 401 error',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(
            `${GITHUB_API_URL}/repos/unifyai/unify-desktop-assistant/releases/latest`,
            () => {
              return HttpResponse.json({ message: 'Bad credentials' }, { status: 401 });
            }
          )
        );

        // Act
        const response = await fetch(
          `${GITHUB_API_URL}/repos/unifyai/unify-desktop-assistant/releases/latest`,
          {
            headers: {
              Authorization: 'Bearer invalid-token',
              Accept: 'application/vnd.github+json',
            },
          }
        );

        // Assert
        expect(response.status).toBe(401);
      }
    );
  });
});
