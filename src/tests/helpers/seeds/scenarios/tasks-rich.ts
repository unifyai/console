/**
 * Seed Scenario: Tasks Rich
 *
 * Creates a user + assistant with a rich set of tasks and task runs
 * for visually testing the dedicated Tasks tab: varied statuses,
 * schedules, triggers, repeat patterns, and activity history.
 *
 * Also seeds a small set of contacts so that task-run source display
 * names resolve correctly.
 *
 * **What it creates:**
 *   - 1 user ("owner")
 *   - 1 personal assistant ("TaskBot")
 *   - 5 contacts (assistant + owner + 3 people)
 *   - 12 tasks with varied statuses, schedules, triggers, and repeat patterns
 *   - 10 task runs (Activity) with mixed source types and states
 *
 * **Credentials:**
 *   - `owner` — full access
 *
 * **Usage:**
 *   ./scripts/local.sh start --seed tasks-rich
 */

import type { SeededState } from '../types';
import {
  createUser,
  createAssistant,
  createEmailLogin,
  seedChatInfrastructure,
  orchestraFetch,
  ensureProject,
} from '../client';

/* eslint-disable @typescript-eslint/naming-convention */

async function seedLogs(
  apiKey: string,
  userId: string,
  assistantId: number,
  context: string,
  entries: Record<string, unknown>[]
): Promise<void> {
  const res = await orchestraFetch(
    '/v0/logs',
    {
      method: 'POST',
      body: JSON.stringify({
        project_name: 'Assistants',
        context: `${userId}/${assistantId}/${context}`,
        entries,
      }),
    },
    apiKey
  );
  if (!res.ok) throw new Error(`Failed to seed ${context}: ${res.status} ${await res.text()}`);
}

function ts(daysAgo: number, hour: number, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

// ---------------------------------------------------------------------------
// Data: Contacts (minimal set for task-run display names)
// ---------------------------------------------------------------------------

const CONTACTS: Record<string, unknown>[] = [
  {
    contact_id: 0,
    first_name: 'TaskBot',
    surname: 'Runner',
    email_address: 'taskbot@assistant.ai',
    is_system: true,
    timezone: 'UTC',
  },
  {
    contact_id: 1,
    first_name: 'Alice',
    surname: 'Owner',
    email_address: 'alice@example.com',
    timezone: 'America/New_York',
  },
  {
    contact_id: 2,
    first_name: 'Bob',
    surname: 'Manager',
    email_address: 'bob@example.com',
    timezone: 'Europe/London',
  },
  {
    contact_id: 3,
    first_name: 'Carlos',
    surname: 'Support',
    email_address: 'carlos@example.com',
    timezone: 'America/Sao_Paulo',
  },
  {
    contact_id: 4,
    first_name: 'Diana',
    surname: 'Sales',
    email_address: 'diana@example.com',
    timezone: 'Asia/Tokyo',
  },
];

// ---------------------------------------------------------------------------
// Data: Tasks
// ---------------------------------------------------------------------------

const TASKS: Record<string, unknown>[] = [
  {
    task_id: 1,
    name: 'Send weekly status report',
    description: 'Compile and send the weekly status report to the team every Monday morning.',
    status: 'scheduled',
    trigger_type: 'scheduled',
    entrypoint: 'send_weekly_report',
    created_at: ts(14, 9),
    updated_at: ts(0, 8, 30),
    next_due_at: ts(-1, 8),
    schedule: { start_at: ts(-1, 8) },
    repeat: [{ frequency: 'weekly', interval: 1, weekdays: ['MO'], time_of_day: '08:00' }],
  },
  {
    task_id: 2,
    name: 'Escalate security emails',
    description: 'Watch for urgent security emails and surface them to the team lead.',
    status: 'triggerable',
    trigger_type: 'triggered',
    entrypoint: 'escalate_security',
    created_at: ts(10, 12),
    updated_at: ts(10, 12, 5),
    trigger: { medium: 'email', recurring: true },
  },
  {
    task_id: 3,
    name: 'Follow up with Alice',
    description: 'Reply when Alice emails about the project status.',
    status: 'triggerable',
    trigger_type: 'triggered',
    offline: true,
    entrypoint: 101,
    created_at: ts(7, 9),
    updated_at: ts(7, 9, 15),
    trigger: { medium: 'email', from_contact_ids: [1] },
  },
  {
    task_id: 4,
    name: 'Nightly database backup',
    description:
      'Take a pg_dump snapshot of the production database and upload to S3 with 30-day retention.',
    status: 'scheduled',
    trigger_type: 'scheduled',
    offline: true,
    entrypoint: 'nightly_db_backup',
    created_at: ts(12, 8),
    updated_at: ts(0, 2),
    next_due_at: ts(-1, 2),
    schedule: { start_at: ts(-1, 2) },
    repeat: [{ frequency: 'daily', interval: 1, time_of_day: '02:00' }],
  },
  {
    task_id: 5,
    name: 'Triage inbound SMS',
    description: 'Classify and route inbound SMS support messages to the appropriate team queue.',
    status: 'active',
    trigger_type: 'triggered',
    entrypoint: 'triage_sms',
    created_at: ts(8, 9),
    updated_at: ts(0, 11),
    trigger: { medium: 'sms_message', from_contact_ids: [1, 2], recurring: true, interrupt: true },
  },
  {
    task_id: 6,
    name: 'Monitor error rates',
    description:
      'Continuously poll error-tracking service and alert on-call if 5xx rate exceeds threshold.',
    status: 'running',
    trigger_type: 'scheduled',
    offline: true,
    entrypoint: 'monitor_errors',
    created_at: ts(10, 8),
    updated_at: ts(0, 12),
    next_due_at: ts(0, 12),
    schedule: { start_at: ts(0, 12) },
    repeat: [{ frequency: 'daily', interval: 1, time_of_day: '12:00' }],
  },
  {
    task_id: 7,
    name: 'Monthly cost report',
    description: 'Pull cloud infrastructure costs and produce a month-over-month comparison.',
    status: 'queued',
    trigger_type: 'scheduled',
    entrypoint: 'monthly_cost_report',
    created_at: ts(9, 10),
    updated_at: ts(0, 10),
    next_due_at: ts(-1, 9),
    schedule: { start_at: ts(-1, 9) },
    repeat: [{ frequency: 'monthly', interval: 1, time_of_day: '09:00', count: 12 }],
  },
  {
    task_id: 8,
    name: 'Sync CRM contacts',
    description: 'Bi-directional sync between internal contacts and Salesforce CRM every 6 hours.',
    status: 'paused',
    trigger_type: 'scheduled',
    offline: true,
    entrypoint: 'sync_crm',
    created_at: ts(6, 14),
    updated_at: ts(1, 14),
    schedule: { start_at: ts(-1, 6) },
    repeat: [
      { frequency: 'daily', interval: 1, time_of_day: '06:00' },
      { frequency: 'daily', interval: 1, time_of_day: '18:00' },
    ],
  },
  {
    task_id: 9,
    name: 'Migrate legacy user data',
    description: 'ETL pipeline to import 2.3M user records from the legacy MySQL database.',
    status: 'failed',
    trigger_type: 'manual',
    entrypoint: 'etl_legacy_users',
    created_at: ts(5, 14),
    updated_at: ts(4, 22),
  },
  {
    task_id: 10,
    name: 'Draft backend job description',
    description: 'Write the job description for the Senior Backend Engineer role.',
    status: 'pending',
    trigger_type: 'manual',
    entrypoint: 'draft_job_desc',
    created_at: ts(3, 11),
    updated_at: ts(3, 11),
    next_due_at: ts(-1, 17),
  },
  {
    task_id: 11,
    name: 'Respond to WhatsApp messages',
    description: 'Listen for incoming WhatsApp messages and draft a contextual response.',
    status: 'active',
    trigger_type: 'triggered',
    entrypoint: 'handle_whatsapp',
    created_at: ts(5, 10),
    updated_at: ts(0, 9),
    trigger: { medium: 'whatsapp', recurring: true },
  },
  {
    task_id: 12,
    name: 'Prepare board deck',
    description:
      'Aggregate KPIs, revenue projections, and roadmap updates for the quarterly board presentation.',
    status: 'completed',
    trigger_type: 'manual',
    entrypoint: 'prepare_board_deck',
    created_at: ts(4, 9),
    updated_at: ts(2, 17),
  },
];

// ---------------------------------------------------------------------------
// Data: Task Runs (Activity)
// ---------------------------------------------------------------------------

const TASK_RUNS: Record<string, unknown>[] = [
  {
    run_id: 9001,
    run_key: 'live:scheduled:run-9001',
    task_id: 1,
    task_name: 'Send weekly status report',
    task_description: 'Compile and send the weekly status report to the team every Monday morning.',
    source_type: 'scheduled',
    state: 'completed',
    scheduled_for: ts(7, 8),
    started_at: ts(7, 8, 1),
    completed_at: ts(7, 8, 12),
    source_medium: 'calendar',
  },
  {
    run_id: 9002,
    run_key: 'live:scheduled:run-9002',
    task_id: 1,
    task_name: 'Send weekly status report',
    task_description: 'Compile and send the weekly status report to the team every Monday morning.',
    source_type: 'scheduled',
    state: 'completed',
    scheduled_for: ts(0, 8),
    started_at: ts(0, 8, 1),
    completed_at: ts(0, 8, 15),
    source_medium: 'calendar',
  },
  {
    run_id: 9003,
    run_key: 'offline:triggered:run-9003',
    task_id: 3,
    task_name: 'Follow up with Alice',
    task_description: 'Reply when Alice emails about the project status.',
    source_type: 'triggered',
    source_medium: 'email',
    source_contact_id: '1',
    source_contact_display_name: 'Alice Owner',
    state: 'running',
    started_at: ts(0, 9, 20),
  },
  {
    run_id: 9004,
    run_key: 'offline:scheduled:run-9004',
    task_id: 4,
    task_name: 'Nightly database backup',
    task_description: 'Take a pg_dump snapshot of the production database and upload to S3.',
    source_type: 'scheduled',
    state: 'completed',
    scheduled_for: ts(1, 2),
    started_at: ts(1, 2, 1),
    completed_at: ts(1, 2, 18),
  },
  {
    run_id: 9005,
    run_key: 'offline:scheduled:run-9005',
    task_id: 4,
    task_name: 'Nightly database backup',
    task_description: 'Take a pg_dump snapshot of the production database and upload to S3.',
    source_type: 'scheduled',
    state: 'completed',
    scheduled_for: ts(0, 2),
    started_at: ts(0, 2, 1),
    completed_at: ts(0, 2, 20),
  },
  {
    run_id: 9006,
    run_key: 'live:scheduled:run-9006',
    task_id: 6,
    task_name: 'Monitor error rates',
    task_description: 'Continuously poll error-tracking service and alert on-call.',
    source_type: 'scheduled',
    state: 'running',
    scheduled_for: ts(0, 12),
    started_at: ts(0, 12, 1),
  },
  {
    run_id: 9007,
    run_key: 'live:explicit:run-9007',
    task_id: 9,
    task_name: 'Migrate legacy user data',
    task_description: 'ETL pipeline to import 2.3M user records from the legacy MySQL database.',
    source_type: 'explicit',
    state: 'failed',
    started_at: ts(5, 14),
    completed_at: ts(5, 17),
  },
  {
    run_id: 9008,
    run_key: 'live:triggered:run-9008',
    task_id: 11,
    task_name: 'Respond to WhatsApp messages',
    task_description: 'Listen for incoming WhatsApp messages and draft a contextual response.',
    source_type: 'triggered',
    source_medium: 'whatsapp',
    source_contact_display_name: 'Bob Manager',
    state: 'completed',
    started_at: ts(1, 10, 15),
    completed_at: ts(1, 10, 16),
  },
  {
    run_id: 9009,
    run_key: 'live:triggered:run-9009',
    task_id: 5,
    task_name: 'Triage inbound SMS',
    task_description: 'Classify and route inbound SMS support messages.',
    source_type: 'triggered',
    source_medium: 'sms_message',
    source_contact_display_name: 'Carlos Support',
    state: 'completed',
    started_at: ts(0, 11, 22),
    completed_at: ts(0, 11, 23),
  },
  {
    run_id: 9010,
    run_key: 'live:explicit:run-9010',
    task_id: 12,
    task_name: 'Prepare board deck',
    task_description: 'Aggregate KPIs, revenue projections, and roadmap updates.',
    source_type: 'explicit',
    state: 'completed',
    started_at: ts(4, 9),
    completed_at: ts(2, 17),
  },
];

/* eslint-enable @typescript-eslint/naming-convention */

// ---------------------------------------------------------------------------
// Scenario
// ---------------------------------------------------------------------------

export async function seedTasksRich(): Promise<SeededState> {
  const owner = createUser({ name: 'Tasks', lastName: 'Explorer', credits: 50_000 });
  createEmailLogin({ userId: owner.id });

  const assistant = createAssistant({
    userId: owner.id,
    firstName: 'TaskBot',
    surname: 'Runner',
  });

  const { apiKey } = owner;
  const { agentId } = assistant;

  await ensureProject(apiKey, 'Assistants');

  await seedChatInfrastructure({
    apiKey,
    userId: owner.id,
    assistantId: agentId,
    email: owner.email,
  });

  await Promise.all([
    seedLogs(apiKey, owner.id, agentId, 'Contacts', CONTACTS),
    seedLogs(apiKey, owner.id, agentId, 'Tasks', TASKS),
    seedLogs(apiKey, owner.id, agentId, 'Tasks/Runs', TASK_RUNS),
  ]);

  return {
    users: { owner },
    assistants: [assistant],
    credentials: {
      owner: {
        email: owner.email,
        password: 'testpass123',
        apiKey: owner.apiKey,
        userId: owner.id,
      },
    },
  };
}
