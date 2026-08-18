'use client';

import * as React from 'react';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Eye,
  Laptop,
  Maximize2,
  Minimize2,
  MousePointerClick,
  RefreshCw,
} from 'lucide-react';
import { Loader } from '@/components/Common/Loader';
import { Button } from '@/components/UI/button';
import { cn } from '@/lib/utils';
import { assistantDisplayName } from '@/lib/assistants/displayName';
import { useDesktopReady } from '@/hooks/Assistants/useDesktopReady';
import { resolveManagedDesktopMode } from '@/utils/assistants/managed-desktop';
import { DESKTOP_PANE_VIEWER_SOURCE } from '@/lib/assistants/desktopViewer';
import { useWorkspace } from '@/components/Pages/Providers/WorkspaceProvider';
import type { Assistant, AssistantActions } from '@/types/assistants/assistant';

type DesktopStatus = 'idle' | 'starting' | 'loading' | 'ready' | 'error';

const DESKTOP_START_POLL_INTERVAL_MS = 3_000;
const DESKTOP_START_TIMEOUT_MS = 120_000;
const DESKTOP_CONNECT_RETRY_MS = 5_000;
/**
 * How long a ready desktop survives the pane being hidden. Long enough that
 * stepping over to Chat and back does not pay for a fresh liveview handshake,
 * short enough that walking away stops costing a live socket and a viewer the
 * assistant thinks is watching.
 */
const DESKTOP_HIDE_GRACE_MS = 10_000;

function formatUnknownError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  if (error && typeof error === 'object' && 'detail' in error) {
    const detail = (error as { detail?: unknown }).detail;
    if (typeof detail === 'string' && detail) return detail;
  }
  return fallback;
}

function isTransientDesktopError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('not yet available') ||
    lower.includes('not reachable') ||
    lower.includes('still be starting') ||
    lower.includes('no active session')
  );
}

interface AssistantDesktopPaneProps {
  assistant: Assistant;
  /** The `desktop` slice of the assistant action bag (liveview + system events). */
  desktopActions: AssistantActions['desktop'];
  /** True while the Desktop tab is the active right-pane view. */
  isVisible: boolean;
  /** False when the assistants surface is hidden behind settings/admin routes. */
  isActiveSurface?: boolean;
  /** Whether the current user can enable Computer Use for this assistant. */
  canWrite?: boolean;
  /** Opens the Computer Use enable/disable manager. */
  onOpenComputerUseManager?: (assistant: Assistant) => void;
}

/**
 * Standalone view of an assistant's remote desktop — the same liveview surface
 * the call exposes via "assistant screen share", without any call. Opening the
 * tab resolves the assistant's liveview URL, health-checks it, and renders it in
 * an iframe. The user can optionally take interactive control (mirroring the
 * call's remote-control toggle); by default the desktop is view-only.
 *
 * Requires managed Computer Use (Ubuntu/Windows). Without it, the pane shows an
 * upgrade empty state instead of waiting for a session that will never arrive.
 *
 * System events mirror the in-call behaviour so a running session knows when a
 * user is watching / driving its screen:
 *  - `assistant_screen_share_started` / `_stopped` around the viewing session
 *  - `user_remote_control_started` / `_stopped` around interactive control
 *
 * Leaving the pane ends the viewing session once the grace window elapses, and
 * coming back re-opens it. Watching is what the pane is visibly doing, so it
 * lasts as long as the pane is on screen and no longer.
 */
export function AssistantDesktopPane({
  assistant,
  desktopActions,
  isVisible,
  isActiveSurface = true,
  canWrite = false,
  onOpenComputerUseManager,
}: AssistantDesktopPaneProps) {
  const [status, setStatus] = React.useState<DesktopStatus>('idle');
  const [liveviewUrl, setLiveviewUrl] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isInteractive, setIsInteractive] = React.useState(false);
  const [isInteractiveLoading, setIsInteractiveLoading] = React.useState(false);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const desktopFrameRef = React.useRef<HTMLIFrameElement | null>(null);

  const { currentUserId } = useWorkspace();
  const assistantId = assistant.agentId;
  const ownerId = assistant.userId;
  const organizationId = assistant.organizationId ?? null;
  const displayName = assistantDisplayName(assistant);
  const computerEnabled = resolveManagedDesktopMode(assistant) != null;
  const shouldConnect = isVisible && isActiveSurface && computerEnabled;

  const boundGetLiveviewUrl = React.useCallback(
    (id: string) => desktopActions.getLiveviewUrl(id, ownerId, organizationId),
    [desktopActions, ownerId, organizationId]
  );

  const wakeAttemptedRef = React.useRef(false);
  const [startupAttempt, setStartupAttempt] = React.useState(0);

  const { isDesktopReady, eventLiveviewUrl, eventLiveviewPassword } = useDesktopReady(
    assistantId,
    boundGetLiveviewUrl,
    false,
    shouldConnect ? DESKTOP_START_POLL_INTERVAL_MS : undefined,
    startupAttempt,
    undefined,
    undefined,
    true
  );

  // Latest values for the teardown paths, which must not re-run (and thus fire
  // a spurious stop event) every time these change mid-session.
  const isInteractiveRef = React.useRef(isInteractive);
  isInteractiveRef.current = isInteractive;
  const desktopActionsRef = React.useRef(desktopActions);
  desktopActionsRef.current = desktopActions;
  const viewerUserIdRef = React.useRef(currentUserId);
  viewerUserIdRef.current = currentUserId;
  const sessionStartRequestedAtRef = React.useRef<number | null>(null);
  // Whether a viewer of ours may be registered against the running session.
  // Tracked rather than inferred from `status` because a failed refresh leaves
  // the pane in `error` while the viewer opened before it is still standing.
  const viewerOpenRef = React.useRef(false);

  /**
   * Close this viewer of the assistant's desktop.
   *
   * Every exit routes through here — the pane being hidden, the active assistant
   * changing, the pane unmounting — so the stop is sent exactly once however the
   * user left. The runtime keys a viewer on `viewerUserId:viewerSource`, so a
   * repeated start is idempotent and only the stop has to be guaranteed.
   */
  const closeViewerSession = React.useCallback((closingAssistantId: string) => {
    if (!viewerOpenRef.current) return;
    viewerOpenRef.current = false;
    const actions = desktopActionsRef.current;
    if (isInteractiveRef.current) {
      actions
        .sendSystemEvent(
          closingAssistantId,
          'user_remote_control_stopped',
          'User released remote control of the assistant desktop'
        )
        .catch(console.error);
    }
    actions
      .sendSystemEvent(
        closingAssistantId,
        'assistant_screen_share_stopped',
        'User closed the assistant desktop',
        { viewerUserId: viewerUserIdRef.current, viewerSource: DESKTOP_PANE_VIEWER_SOURCE }
      )
      .catch(console.error);
  }, []);

  React.useEffect(() => {
    if (typeof document === 'undefined') return;

    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === desktopFrameRef.current);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const connect = React.useCallback(async () => {
    setStatus('loading');
    setErrorMessage(null);
    try {
      const actions = desktopActionsRef.current;
      let resolvedUrl: string | undefined;
      if (eventLiveviewUrl) {
        const built = await actions.buildLiveviewUrl(
          eventLiveviewUrl,
          ownerId,
          organizationId,
          eventLiveviewPassword
        );
        resolvedUrl = built.liveviewUrl;
      } else {
        const result = await actions
          .getLiveviewUrl(assistantId, ownerId, organizationId)
          .catch((error: unknown) => ({
            detail: formatUnknownError(error, 'Failed to fetch desktop URL.'),
          }));
        resolvedUrl = result && 'liveviewUrl' in result ? result.liveviewUrl : undefined;
        if (!resolvedUrl && result && 'detail' in result && result.detail) {
          throw new Error(
            typeof result.detail === 'string'
              ? result.detail
              : 'Could not retrieve the desktop session URL.'
          );
        }
      }

      if (!resolvedUrl) {
        throw new Error('Could not retrieve the desktop session URL.');
      }

      const healthy = await actions.checkLiveviewHealth(resolvedUrl);
      if (!healthy) {
        throw new Error('Desktop is not reachable — it may still be starting up.');
      }

      setLiveviewUrl(resolvedUrl);
      setStatus('ready');
      sessionStartRequestedAtRef.current = null;
      viewerOpenRef.current = true;
      actions
        .sendSystemEvent(
          assistantId,
          'assistant_screen_share_started',
          'User opened the assistant desktop',
          { viewerUserId: viewerUserIdRef.current, viewerSource: DESKTOP_PANE_VIEWER_SOURCE }
        )
        .catch(console.error);
    } catch (e: unknown) {
      const message = formatUnknownError(e, 'Could not open the assistant desktop.');
      const startedAt = sessionStartRequestedAtRef.current;
      const withinStartupWindow =
        startedAt !== null && Date.now() - startedAt < DESKTOP_START_TIMEOUT_MS;

      if (withinStartupWindow && isTransientDesktopError(message)) {
        setStatus('starting');
        setErrorMessage(null);
        return;
      }

      setStatus('error');
      setErrorMessage(message);
      setLiveviewUrl(null);
    }
  }, [assistantId, ownerId, organizationId, eventLiveviewUrl, eventLiveviewPassword]);

  const beginStartup = React.useCallback(() => {
    wakeAttemptedRef.current = true;
    sessionStartRequestedAtRef.current = Date.now();
    setStatus('starting');
    setErrorMessage(null);

    void desktopActionsRef.current
      .wakeAssistantSession(assistantId)
      .then((result) => {
        if ('detail' in result && result.detail) {
          setStatus('error');
          setErrorMessage(
            typeof result.detail === 'string'
              ? result.detail
              : 'Failed to start the assistant session.'
          );
          wakeAttemptedRef.current = false;
          sessionStartRequestedAtRef.current = null;
        }
      })
      .catch((error: unknown) => {
        setStatus('error');
        setErrorMessage(formatUnknownError(error, 'Failed to start the assistant session.'));
        wakeAttemptedRef.current = false;
        sessionStartRequestedAtRef.current = null;
      });
  }, [assistantId]);

  // When the tab opens and Computer is enabled but no desktop is running yet,
  // request a session start then poll until the VM is ready (via useDesktopReady).
  React.useEffect(() => {
    if (!shouldConnect) return;
    if (isDesktopReady || wakeAttemptedRef.current) return;
    beginStartup();
  }, [shouldConnect, isDesktopReady, assistantId, startupAttempt, beginStartup]);

  // Fail gracefully if startup takes too long.
  React.useEffect(() => {
    if (!shouldConnect) return;
    if (status !== 'starting' && status !== 'loading') return;
    if (sessionStartRequestedAtRef.current === null) return;

    const elapsed = Date.now() - sessionStartRequestedAtRef.current;
    const remaining = DESKTOP_START_TIMEOUT_MS - elapsed;
    if (remaining <= 0) {
      setStatus('error');
      setErrorMessage(
        `${displayName}'s desktop did not become available in time. Try again in a moment.`
      );
      wakeAttemptedRef.current = false;
      sessionStartRequestedAtRef.current = null;
      return;
    }

    const timeout = window.setTimeout(() => {
      setStatus('error');
      setErrorMessage(
        `${displayName}'s desktop did not become available in time. Try again in a moment.`
      );
      wakeAttemptedRef.current = false;
      sessionStartRequestedAtRef.current = null;
    }, remaining);

    return () => window.clearTimeout(timeout);
  }, [shouldConnect, status, displayName]);

  // Retry connect while the desktop URL exists but health checks are still warming up.
  React.useEffect(() => {
    if (!shouldConnect || !isDesktopReady) return;
    if (status !== 'starting') return;

    const interval = window.setInterval(() => {
      void connect().catch((error: unknown) => {
        console.error('[AssistantDesktopPane] Connect retry failed:', error);
      });
    }, DESKTOP_CONNECT_RETRY_MS);

    void connect().catch((error: unknown) => {
      console.error('[AssistantDesktopPane] Connect failed:', error);
    });

    return () => window.clearInterval(interval);
  }, [shouldConnect, isDesktopReady, status, connect]);

  // Auto-connect when the tab becomes visible and the desktop is ready. Kept
  // idempotent via the `idle`/`starting` guard so re-renders don't re-fetch.
  React.useEffect(() => {
    if (!shouldConnect) return;
    if (status !== 'idle') return;
    if (!isDesktopReady) return;
    void connect().catch((error: unknown) => {
      console.error('[AssistantDesktopPane] Connect failed:', error);
    });
  }, [shouldConnect, status, isDesktopReady, connect]);

  // Reset the whole session when the assistant changes so we never show one
  // teammate's desktop under another. Also reset when Computer is enabled after
  // the upgrade empty state so startup can begin.
  //
  // Closing the viewer here catches Computer being switched off mid-view, which
  // drops the desktop without changing assistant or unmounting the pane. React
  // runs every cleanup before any body, so on an assistant change the teardown
  // has already closed the old session and this call finds nothing to stop —
  // it cannot mistake the incoming assistant for the outgoing one.
  React.useEffect(() => {
    closeViewerSession(assistantId);
    setStatus('idle');
    setLiveviewUrl(null);
    setErrorMessage(null);
    setIsInteractive(false);
    wakeAttemptedRef.current = false;
    sessionStartRequestedAtRef.current = null;
    setStartupAttempt(0);
  }, [assistantId, computerEnabled, closeViewerSession]);

  // Drop the desktop once the pane has been hidden for the grace window.
  //
  // Hiding is not enough on its own to end a viewing session: the tab bodies are
  // force-mounted and merely CSS-hidden, and the whole assistants surface is only
  // hidden behind other routes, so an iframe left mounted keeps its socket open
  // and keeps decoding frames for the rest of the session. Nothing else closes
  // the viewer either — a call ending drops only the viewers that call owned.
  //
  // Returning inside the window cancels the timeout, so the desktop is still
  // there and no start/stop pair is spent.
  React.useEffect(() => {
    if (shouldConnect) return;
    if (status !== 'ready') return;

    const timeout = window.setTimeout(() => {
      closeViewerSession(assistantId);
      setStatus('idle');
      setLiveviewUrl(null);
      setIsInteractive(false);
    }, DESKTOP_HIDE_GRACE_MS);

    return () => window.clearTimeout(timeout);
  }, [shouldConnect, status, assistantId, closeViewerSession]);

  // Close the viewer on the way out, for the exits no timer can wait for: the
  // pane unmounting, or the active assistant changing under it.
  React.useEffect(() => {
    return () => closeViewerSession(assistantId);
  }, [assistantId, closeViewerSession]);

  const toggleInteractive = React.useCallback(async () => {
    if (status !== 'ready') return;
    const nextState = !isInteractive;
    setIsInteractiveLoading(true);
    try {
      const result = await desktopActions.sendSystemEvent(
        assistantId,
        nextState ? 'user_remote_control_started' : 'user_remote_control_stopped',
        nextState
          ? 'User took remote control of the assistant desktop'
          : 'User released remote control of the assistant desktop'
      );
      if (result.detail) {
        throw new Error(result.detail);
      }
      setIsInteractive(nextState);
      toast.info(nextState ? 'Interactive mode enabled.' : 'View-only mode enabled.');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error.';
      console.error('[AssistantDesktopPane] Failed to toggle interactive mode:', message);
      toast.error(`Could not ${nextState ? 'enable' : 'disable'} interactive mode.`);
    } finally {
      setIsInteractiveLoading(false);
    }
  }, [status, isInteractive, assistantId, desktopActions]);

  const handleRefresh = React.useCallback(() => {
    setLiveviewUrl(null);
    setErrorMessage(null);
    void connect().catch((error: unknown) => {
      console.error('[AssistantDesktopPane] Refresh failed:', error);
    });
  }, [connect]);

  const toggleFullscreen = React.useCallback(async () => {
    const frame = desktopFrameRef.current;
    if (!frame || typeof document === 'undefined' || !frame.requestFullscreen) {
      toast.error('Fullscreen mode is not supported here.');
      return;
    }

    try {
      if (document.fullscreenElement === frame) {
        await document.exitFullscreen();
      } else {
        await frame.requestFullscreen();
      }
    } catch (error: unknown) {
      console.error('[AssistantDesktopPane] Failed to toggle fullscreen:', error);
      toast.error('Could not change fullscreen mode.');
    }
  }, []);

  const handleRetry = React.useCallback(() => {
    wakeAttemptedRef.current = false;
    sessionStartRequestedAtRef.current = null;
    setLiveviewUrl(null);
    setErrorMessage(null);
    try {
      sessionStorage.removeItem(`desktop-ready-${assistantId}`);
    } catch {
      /* SSR-safe */
    }
    setStartupAttempt((attempt) => attempt + 1);
    beginStartup();
  }, [assistantId, beginStartup]);

  return (
    <div className="flex h-full w-full flex-col bg-background">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2">
        <div className="flex min-w-0 flex-col">
          <span className="text-body truncate font-medium text-foreground">
            {displayName}&apos;s desktop
          </span>
          <span className="text-caption truncate text-muted-foreground">
            {status === 'ready'
              ? isInteractive
                ? 'You have control of this desktop'
                : 'Live view of the assistant desktop'
              : 'Remote desktop'}
          </span>
        </div>
        {status === 'ready' && (
          <div className="flex items-center gap-2">
            <Button
              variant={isInteractive ? 'default' : 'outline'}
              size="sm"
              onClick={toggleInteractive}
              disabled={isInteractiveLoading}
            >
              {isInteractive ? (
                <Eye className="mr-1.5 h-4 w-4" />
              ) : (
                <MousePointerClick className="mr-1.5 h-4 w-4" />
              )}
              {isInteractive ? 'View only' : 'Take control'}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen desktop'}
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen desktop'}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              aria-label="Refresh desktop"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        {!computerEnabled ? (
          <div
            className="flex flex-col items-center justify-center p-6 text-center"
            data-testid="desktop-computer-upgrade"
          >
            <Laptop className="mb-4 h-8 w-8 text-muted-foreground" />
            <h3 className="text-h2 text-semibold text-foreground">Computer not enabled</h3>
            <p className="text-body mt-2 max-w-sm text-muted-foreground">
              Desktop live view needs a managed Computer (Ubuntu or Windows) for {displayName}.
              Enable Computer to start a remote desktop session.
            </p>
            <div className="mt-6">
              {canWrite && onOpenComputerUseManager ? (
                <Button
                  data-testid="desktop-enable-computer"
                  onClick={() => onOpenComputerUseManager(assistant)}
                >
                  Enable Computer
                </Button>
              ) : (
                <p className="text-caption text-muted-foreground">
                  Ask someone with edit access to enable Computer for this teammate.
                </p>
              )}
            </div>
          </div>
        ) : status === 'ready' && liveviewUrl ? (
          <>
            <iframe
              src={liveviewUrl}
              ref={desktopFrameRef}
              className="h-full w-full border-0"
              title={`${displayName} Remote Desktop`}
              allow="autoplay; camera; microphone; display-capture; clipboard-write; clipboard-read; fullscreen"
              allowFullScreen
              referrerPolicy="no-referrer"
            />
            {!isInteractive && (
              <div
                className={cn('absolute inset-0 cursor-not-allowed bg-transparent')}
                title="Take control to interact with this desktop"
              />
            )}
          </>
        ) : status === 'error' ? (
          <div className="flex flex-col items-center justify-center p-6 text-center">
            <AlertTriangle className="mb-4 h-8 w-8 text-destructive" />
            <h3 className="text-h2 text-semibold text-foreground">Desktop unavailable</h3>
            <p className="text-body mt-2 max-w-sm text-muted-foreground">
              {errorMessage ?? `${displayName}'s desktop could not be opened.`}
            </p>
            <div className="mt-6">
              <Button onClick={handleRetry}>Try again</Button>
            </div>
          </div>
        ) : status === 'starting' || status === 'loading' ? (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Loader size={32} />
            <span className="text-body">
              {status === 'starting'
                ? `Starting ${displayName}'s session…`
                : `Connecting to ${displayName}'s desktop…`}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
