'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchLogs } from '@/lib/logs/fetch';
import { updateLogEntries } from '@/lib/logs/mutations';
import { rootContext, type ContextRoot } from '@/lib/assistants/scope';

type ThreadMsg = {
  type?: string;
  from?: string;
  to?: string;
  subject?: string;
  time?: string;
  body?: string;
};

type JobRow = {
  logId: number;
  jobId: string;
  campaignId: number | null;
  leadEmail: string;
  status: string;
  statsId: string | null;
  body: string;
  route: string;
  threadSnapshot: ThreadMsg[];
  updatedAt: string;
};

const REVIEW_TITLE_RE = /smartlead reply review/i;

export function isSmartLeadReplyReviewDashboard(title: string | null | undefined): boolean {
  return REVIEW_TITLE_RE.test(String(title || ''));
}

function parseThreadSnapshot(raw: unknown): ThreadMsg[] {
  if (Array.isArray(raw)) return raw as ThreadMsg[];
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as ThreadMsg[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function jobsContext(root: ContextRoot, ownerId: string, assistantId: string): string {
  return rootContext(root, ownerId, assistantId, 'Data/GTM/SmartLeadReplyJobs');
}

interface SmartLeadReplyReviewPanelProps {
  root: ContextRoot;
  ownerId: string;
  assistantId: string;
  onMutated?: () => void;
}

export function SmartLeadReplyReviewPanel({
  root,
  ownerId,
  assistantId,
  onMutated,
}: SmartLeadReplyReviewPanelProps) {
  const jobsCtx = useMemo(
    () => jobsContext(root, ownerId, assistantId),
    [root, ownerId, assistantId]
  );

  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [draftBody, setDraftBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const jobPage = await fetchLogs({
      projectName: 'Assistants',
      context: jobsCtx,
      filter: 'status == "needs_approval"',
      limit: 200,
      offset: 0,
    });

    const nextJobs: JobRow[] = jobPage.rows.map((row) => {
      const e = row.entries;
      return {
        logId: row.logId,
        jobId: String(e.job_id ?? ''),
        campaignId: e.campaign_id == null ? null : Number(e.campaign_id),
        leadEmail: String(e.lead_email ?? ''),
        status: String(e.status ?? ''),
        statsId: e.stats_id == null ? null : String(e.stats_id),
        body: String(e.body ?? ''),
        route: String(e.route ?? ''),
        threadSnapshot: parseThreadSnapshot(e.thread_snapshot),
        updatedAt: String(e.updated_at ?? e.created_at ?? ''),
      };
    });
    nextJobs.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    setJobs(nextJobs);
    setSelectedJobId((prev) => {
      if (prev && nextJobs.some((j) => j.jobId === prev)) return prev;
      return nextJobs[0]?.jobId ?? null;
    });
  }, [jobsCtx]);

  useEffect(() => {
    void load().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : String(err));
    });
  }, [load]);

  const selected = useMemo(
    () => jobs.find((j) => j.jobId === selectedJobId) ?? null,
    [jobs, selectedJobId]
  );

  useEffect(() => {
    setDraftBody(selected?.body ?? '');
    setInfo(null);
  }, [selected?.logId, selected?.body, selected?.jobId]);

  const saveDraftBody = useCallback(async () => {
    if (!selected) {
      setError('No job selected.');
      return false;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await updateLogEntries({
        projectName: 'Assistants',
        context: jobsCtx,
        logIds: [selected.logId],
        entries: { body: draftBody },
      });
      if (!res.ok) {
        setError(res.detail || 'Failed to update draft body');
        return false;
      }
      setJobs((prev) =>
        prev.map((j) => (j.jobId === selected.jobId ? { ...j, body: draftBody } : j))
      );
      return true;
    } finally {
      setBusy(false);
    }
  }, [selected, draftBody, jobsCtx]);

  const setJobStatus = useCallback(
    async (status: 'approved' | 'rejected') => {
      if (!selected) return;
      setBusy(true);
      setError(null);
      setInfo(null);
      try {
        if (status === 'approved' && !draftBody.trim()) {
          setError('Cannot approve without a draft body.');
          return;
        }
        const entries: Record<string, unknown> =
          status === 'approved' ? { status, body: draftBody } : { status };
        const res = await updateLogEntries({
          projectName: 'Assistants',
          context: jobsCtx,
          logIds: [selected.logId],
          entries,
        });
        if (!res.ok) {
          setError(res.detail || `Failed to set status=${status}`);
          return;
        }
        setInfo(
          status === 'approved'
            ? 'Marked approved. Next campaign_runtime tick will send via send_founder_reply.'
            : 'Marked rejected. This job will not send.'
        );
        await load();
        onMutated?.();
      } finally {
        setBusy(false);
      }
    },
    [selected, draftBody, jobsCtx, load, onMutated]
  );

  return (
    <section
      className="border-t border-border px-3 py-3"
      data-testid="smartlead-reply-review-panel"
    >
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <div>
          <h3 className="text-title text-semibold">Reply approval</h3>
          <p className="text-caption text-muted-foreground">
            Edit the draft, then approve or reject. Mutations use Orchestra log PUT — no offline
            Job.
          </p>
        </div>
        <button
          type="button"
          className="text-caption underline"
          onClick={() => void load()}
          disabled={busy}
        >
          Refresh queue
        </button>
      </div>

      {error ? (
        <p className="text-caption mb-2 text-red-600" data-testid="smartlead-reply-review-error">
          {error}
        </p>
      ) : null}
      {info ? (
        <p className="text-caption mb-2 text-emerald-700" data-testid="smartlead-reply-review-info">
          {info}
        </p>
      ) : null}

      <div className="grid gap-3 md:grid-cols-[minmax(220px,0.9fr)_minmax(0,1.4fr)]">
        <div className="max-h-80 overflow-auto rounded-md border border-border">
          {jobs.length === 0 ? (
            <p className="text-caption p-3 text-muted-foreground">No needs_approval jobs.</p>
          ) : (
            <ul>
              {jobs.map((job) => (
                <li key={job.jobId}>
                  <button
                    type="button"
                    className={`text-body hover:bg-muted/40 block w-full border-b border-border px-3 py-2 text-left ${
                      job.jobId === selectedJobId ? 'bg-muted/60' : ''
                    }`}
                    onClick={() => setSelectedJobId(job.jobId)}
                  >
                    <div className="text-semibold">{job.leadEmail || '(no email)'}</div>
                    <div className="text-caption text-muted-foreground">
                      {job.jobId.slice(0, 12)}… · {job.updatedAt}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="min-h-0 space-y-3">
          {!selected ? (
            <p className="text-caption text-muted-foreground">Select a job.</p>
          ) : (
            <>
              <div className="max-h-48 space-y-2 overflow-auto rounded-md border border-border p-2">
                {selected.threadSnapshot.length === 0 ? (
                  <p className="text-caption text-muted-foreground">No thread_snapshot.</p>
                ) : (
                  selected.threadSnapshot.map((msg, idx) => (
                    <div key={idx} className="bg-muted/20 rounded border border-border p-2 text-xs">
                      <div className="mb-1 text-muted-foreground">
                        [{msg.type || 'MSG'}] {msg.from} → {msg.to} · {msg.time}
                      </div>
                      {msg.subject ? <div className="text-semibold mb-1">{msg.subject}</div> : null}
                      <pre className="whitespace-pre-wrap font-sans">{msg.body || ''}</pre>
                    </div>
                  ))
                )}
              </div>

              <label className="text-caption text-semibold block">
                Draft body
                <textarea
                  className="text-body mt-1 min-h-32 w-full rounded-md border border-border bg-background p-2"
                  value={draftBody}
                  onChange={(e) => setDraftBody(e.target.value)}
                  disabled={busy}
                  data-testid="smartlead-reply-draft-body"
                />
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="text-body rounded-md bg-emerald-600 px-3 py-1.5 text-white disabled:opacity-50"
                  disabled={busy || !selected}
                  onClick={() => void setJobStatus('approved')}
                  data-testid="smartlead-reply-approve"
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="text-body rounded-md border border-border px-3 py-1.5 disabled:opacity-50"
                  disabled={busy || !selected}
                  onClick={() => void saveDraftBody().then((ok) => ok && setInfo('Draft saved.'))}
                  data-testid="smartlead-reply-save-draft"
                >
                  Save draft
                </button>
                <button
                  type="button"
                  className="text-body rounded-md bg-red-600 px-3 py-1.5 text-white disabled:opacity-50"
                  disabled={busy || !selected}
                  onClick={() => void setJobStatus('rejected')}
                  data-testid="smartlead-reply-reject"
                >
                  Reject
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
