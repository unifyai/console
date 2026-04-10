'use client';

import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useEnvironment } from '@/components/Pages/Providers/EnvironmentProvider';

/**
 * Global type declarations for the Cloudflare Turnstile API.
 * See: https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/
 */
declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        params: {
          sitekey: string;
          callback?: (token: string) => void;
          'error-callback'?: () => void;
          'expired-callback'?: () => void;
          theme?: 'light' | 'dark' | 'auto';
          size?: 'normal' | 'compact' | 'invisible';
          appearance?: 'always' | 'execute' | 'interaction-only';
          retry?: 'auto' | 'never';
          // Cloudflare Turnstile API uses hyphenated property names
          // eslint-disable-next-line @typescript-eslint/naming-convention
          'retry-interval'?: number;
          // eslint-disable-next-line @typescript-eslint/naming-convention
          'refresh-expired'?: 'auto' | 'manual' | 'never';
        }
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
    onTurnstileLoad?: () => void;
  }
}

export interface TurnstileWidgetHandle {
  /** Reset the widget to get a fresh token. */
  reset: () => void;
}

interface TurnstileWidgetProps {
  /** Called with the Turnstile token when verification succeeds. */
  onVerify: (token: string) => void;
  /** Called when the token expires or verification fails. */
  onExpire?: () => void;
  /** Called when Turnstile encounters an error. */
  onError?: () => void;
}

const TURNSTILE_SCRIPT_ID = 'cf-turnstile-script';

/**
 * Cloudflare Turnstile CAPTCHA widget.
 *
 * Renders an invisible/managed Turnstile challenge and calls `onVerify`
 * with the token on success. If `TURNSTILE_SITE_KEY` is not configured,
 * renders nothing (allows local development without Turnstile).
 *
 * The widget automatically refreshes expired tokens so that a valid
 * token is always available when the user submits the form.
 *
 * The site key is read server-side in `Base.tsx` and injected via
 * `EnvironmentProvider`, so no `NEXT_PUBLIC_` prefix is needed.
 */
const TurnstileWidget = forwardRef<TurnstileWidgetHandle, TurnstileWidgetProps>(
  ({ onVerify, onExpire, onError }, ref) => {
    const { turnstileSiteKey } = useEnvironment();
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);

    useImperativeHandle(ref, () => ({
      reset: () => {
        if (widgetIdRef.current && window.turnstile) {
          window.turnstile.reset(widgetIdRef.current);
        }
      },
    }));

    const renderWidget = useCallback(() => {
      if (!containerRef.current || !window.turnstile || !turnstileSiteKey) return;

      // Remove existing widget before re-rendering
      if (widgetIdRef.current) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // Ignore removal errors
        }
      }

      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: turnstileSiteKey,
        callback: onVerify,
        'expired-callback': onExpire,
        'error-callback': onError,
        size: 'normal',
        'refresh-expired': 'auto',
      });
    }, [turnstileSiteKey, onVerify, onExpire, onError]);

    useEffect(() => {
      if (!turnstileSiteKey) return;

      // If the Turnstile script is already loaded, render immediately
      if (window.turnstile) {
        renderWidget();
        return;
      }

      // If the script tag already exists, wait for it to load
      if (document.getElementById(TURNSTILE_SCRIPT_ID)) {
        window.onTurnstileLoad = renderWidget;
        return;
      }

      // Inject the Turnstile script
      window.onTurnstileLoad = renderWidget;
      const script = document.createElement('script');
      script.id = TURNSTILE_SCRIPT_ID;
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);

      return () => {
        // Clean up the widget on unmount
        if (widgetIdRef.current && window.turnstile) {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch {
            // Ignore removal errors during cleanup
          }
        }
        window.onTurnstileLoad = undefined;
      };
    }, [turnstileSiteKey, renderWidget]);

    // Don't render anything if the site key is not configured
    if (!turnstileSiteKey) return null;

    return (
      <div className="flex justify-center overflow-hidden" data-testid="turnstile-widget-wrapper">
        <div
          ref={containerRef}
          data-testid="turnstile-widget"
          className="origin-center scale-[0.85] sm:scale-100"
        />
      </div>
    );
  }
);

TurnstileWidget.displayName = 'TurnstileWidget';

export default TurnstileWidget;
