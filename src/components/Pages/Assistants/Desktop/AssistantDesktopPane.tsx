'use client';

import * as React from 'react';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Eye,
  Laptop,
  Maximize2,
  Minimize2,
  MonitorOff,
  MonitorPlay,
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

/**
 * What a connect attempt settled on. Reported back to the caller rather than read
 * off `status`, because the retry sequence needs the answer immediately and any
 * ref it could read still holds the previous render's value at that point.
 */
type ConnectOutcome = 'ready' | 'retry' | 'failed';

const DESKTOP_START_POLL_INTERVAL_MS = 3_000;
const DESKTOP_START_TIMEOUT_MS = 120_000;
/**
 * Backoff between attempts to reach a desktop that is still coming up. A refused
 * connection fails in milliseconds, so an unpaced retry spends the whole startup
 * window hammering the health probe; the ceiling holds a wedged desktop to a
 * handful of attempts rather than dozens.
 */
const DESKTOP_CONNECT_RETRY_BASE_MS = 3_000;
const DESKTOP_CONNECT_RETRY_MAX_MS = 15_000;
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

/** Delay before retry `attempt`, 1-based: 3s, 6s, 12s, then 15s from there on. */
function connectRetryDelayMs(attempt: number): number {
  return Math.min(DESKTOP_CONNECT_RETRY_BASE_MS * 2 ** (attempt - 1), DESKTOP_CONNECT_RETRY_MAX_MS);
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
 *
 * Unwatch ends the session on demand without leaving the tab, and survives until
 * the user watches again or switches teammate — unlike the grace teardown, which
 * keeps the intent so a trip to Chat and back does not need a second click.
 * Neither stops the desktop itself: the controller starts and reclaims VMs from
 * the assistant's own config, and other people watching the same desktop from a
 * call are unaffected.
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
  // Whether the user wants to be watching. Starts true so opening the tab
  // behaves as it always has; only an explicit unwatch turns it off, which is
  // what stops the auto-connect below from immediately undoing that.
  const [isWatching, setIsWatching] = React.useState(true);
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

  // `null` unless someone is actually waiting for this desktop: no one is
  // looking at the pane, or they unwatched it, so its readiness is not news. The
  // unscoped fallback stays opted in because the pane has neither a binding id
  // nor a job name to scope by, and the interval is what decides whether it
  // polls at all.
  const { isDesktopReady, eventLiveviewUrl, eventLiveviewPassword } = useDesktopReady(
    assistantId,
    boundGetLiveviewUrl,
    false,
    shouldConnect && isWatching ? DESKTOP_START_POLL_INTERVAL_MS : null,
    startupAttempt,
    undefined,
    undefined,
    true
  );

  // Latest values for the teardown paths, which must not re-run (and thus fire
  // a spurious stop event) every time these change mid-session.
  const isInteractiveRef = React.useRef(isInteractive);
  isInteractiveRef.current = isInteractive;
  // Read by the connect sequence on entry, so a desktop already up (or already
  // failed) is not re-fetched when an unrelated dependency changes identity.
  const statusRef = React.useRef(status);
  statusRef.current = status;
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

  const connect = React.useCallback(async (): Promise<ConnectOutcome> => {
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
      return 'ready';
    } catch (e: unknown) {
      const message = formatUnknownError(e, 'Could not open the assistant desktop.');
      const startedAt = sessionStartRequestedAtRef.current;
      const withinStartupWindow =
        startedAt !== null && Date.now() - startedAt < DESKTOP_START_TIMEOUT_MS;

      if (withinStartupWindow && isTransientDesktopError(message)) {
        setStatus('starting');
        setErrorMessage(null);
        return 'retry';
      }

      setStatus('error');
      setErrorMessage(message);
      setLiveviewUrl(null);
      return 'failed';
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
  // Skipped while unwatched, so a failed wake cannot be retried on behalf of
  // someone who has said they are not looking.
  React.useEffect(() => {
    if (!shouldConnect || !isWatching) return;
    if (isDesktopReady || wakeAttemptedRef.current) return;
    beginStartup();
  }, [shouldConnect, isWatching, isDesktopReady, assistantId, startupAttempt, beginStartup]);

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

  // Open the desktop once there is one to open, re-attempting with backoff while
  // it is still warming up.
  //
  // The whole sequence lives in one effect that re-schedules itself, and must not
  // depend on `status`: connect() moves the pane to 'loading' on entry, so an
  // effect gated on 'starting' tears down the timer that just scheduled it, and
  // every retry then lands one round trip after the last instead of on the
  // cadence above. `statusRef` is read on entry only — refs are current when an
  // effect runs, but not immediately after an await.
  React.useEffect(() => {
    if (!shouldConnect || !isWatching || !isDesktopReady) return;
    if (statusRef.current === 'ready' || statusRef.current === 'error') return;

    let cancelled = false;
    let retryTimeout = 0;
    let attempt = 0;

    const attemptConnect = async () => {
      const outcome = await connect().catch((error: unknown) => {
        console.error('[AssistantDesktopPane] Connect failed:', error);
        return 'failed' as ConnectOutcome;
      });
      if (cancelled || outcome !== 'retry') return;
      attempt += 1;
      retryTimeout = window.setTimeout(attemptConnect, connectRetryDelayMs(attempt));
    };

    void attemptConnect();

    return () => {
      cancelled = true;
      window.clearTimeout(retryTimeout);
    };
  }, [shouldConnect, isWatching, isDesktopReady, connect]);

  // Reset the whole session when the assistant changes so we never show one
  // teammate's desktop under another. Also reset when Computer is enabled after
  // the upgrade empty state so startup can begin.
  //
  // Closing the viewer here catches Computer being switched off mid-view, which
  // drops the desktop without changing assistant or unmounting the pane. React
  // runs every cleanup before any body, so on an assistant change the teardown
  // has already closed the old session and this call finds nothing to stop —
  // it cannot mistake the incoming assistant for the outgoing one.
  //
  // Only on a *change*: every value below is already at its initial state on
  // mount, so running then resets nothing — except the startup the effect above
  // has just requested, whose window and wake flag this would wipe, taking the
  // spinner and the whole transient-retry path with them.
  const identityResetArmedRef = React.useRef(false);
  React.useEffect(() => {
    if (!identityResetArmedRef.current) {
      identityResetArmedRef.current = true;
      return;
    }
    closeViewerSession(assistantId);
    setStatus('idle');
    setLiveviewUrl(null);
    setErrorMessage(null);
    setIsInteractive(false);
    setIsWatching(true);
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

  /**
   * Stop watching. This ends only *this* viewer — the desktop keeps running, and
   * anyone watching the same one from a call is untouched, because the runtime
   * keys a viewer on `viewerUserId:viewerSource`.
   */
  const handleUnwatch = React.useCallback(() => {
    setIsWatching(false);
    closeViewerSession(assistantId);
    setStatus('idle');
    setLiveviewUrl(null);
    setErrorMessage(null);
    setIsInteractive(false);
  }, [assistantId, closeViewerSession]);

  /**
   * Start watching again. A desktop already up is picked straight back up by the
   * auto-connect effect; one that is not gets the same startup the pane performs
   * on open, since asking to watch is the same intent as arriving here.
   */
  const handleWatch = React.useCallback(() => {
    setIsWatching(true);
    if (!isDesktopReady) {
      beginStartup();
    }
  }, [isDesktopReady, beginStartup]);

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
            {!isWatching
              ? 'Not watching'
              : status === 'ready'
                ? isInteractive
                  ? 'You have control of this desktop'
                  : 'Live view of the assistant desktop'
                : 'Remote desktop'}
          </span>
        </div>
        {computerEnabled && (
          <div className="flex items-center gap-2">
            {/* Watching is the one control that has to work from either side, so
             *  it sits outside the ready-only group below. */}
            <Button
              variant={isWatching ? 'outline' : 'default'}
              size="sm"
              onClick={isWatching ? handleUnwatch : handleWatch}
              data-testid="desktop-watch-toggle"
            >
              {isWatching ? (
                <MonitorOff className="mr-1.5 h-4 w-4" />
              ) : (
                <MonitorPlay className="mr-1.5 h-4 w-4" />
              )}
              {isWatching ? 'Unwatch' : 'Watch'}
            </Button>
            {status === 'ready' && (
              <>
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
                  {isFullscreen ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleRefresh}
                  aria-label="Refresh desktop"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </>
            )}
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
        ) : !isWatching ? (
          <p
            className="text-body max-w-sm p-6 text-center text-muted-foreground"
            data-testid="desktop-not-watching"
          >
            You stopped watching. {displayName}&apos;s desktop keeps running.
          </p>
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
