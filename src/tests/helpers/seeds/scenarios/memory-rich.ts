/**
 * Seed Scenario: Memory Rich
 *
 * Creates a user + assistant with rich data across all 6 memory contexts
 * for visually testing the Memory tab: Contacts, Transcripts, Knowledge,
 * Tasks, Guidance, and Functions.
 *
 * **What it creates:**
 *   - 1 user ("owner")
 *   - 1 personal assistant ("Aria Chen")
 *   - 25 contacts (assistant + owner + 23 people)
 *   - ~220 transcript messages across 7 days
 *   - 2 Knowledge sub-contexts: Products (12 rows), FAQ (8 rows)
 *   - 20 tasks with varied statuses, schedules, triggers, and repeat patterns
 *   - 14 task runs (Activity) with mixed source types and states
 *   - 10 guidance entries (some with linked images)
 *   - Functions: 6 Compositional, 4 Primitives, 2 VirtualEnvs, 1 Meta
 *
 * **Credentials:**
 *   - `owner` — full access
 *
 * **Usage:**
 *   ./scripts/local.sh start --seed memory-rich
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
// Data: Contacts
// ---------------------------------------------------------------------------

const ASSISTANT_CONTACT_ID = 42;
const OWNER_CONTACT_ID = 43;

const CONTACTS: Record<string, unknown>[] = [
  {
    contact_id: ASSISTANT_CONTACT_ID,
    first_name: 'Aria',
    surname: 'Chen',
    email_address: 'aria@assistant.ai',
    is_system: true,
    timezone: 'UTC',
    bio: 'AI assistant specializing in project management, engineering, and research.',
  },
  {
    contact_id: OWNER_CONTACT_ID,
    first_name: 'Jordan',
    surname: 'Mitchell',
    email_address: 'jordan@example.com',
    phone_number: '+14155551001',
    timezone: 'America/New_York',
    bio: 'CEO and founder. Oversees product strategy and investor relations.',
  },
  {
    contact_id: 2,
    first_name: 'Priya',
    surname: 'Sharma',
    email_address: 'priya@example.com',
    phone_number: '+14155551002',
    timezone: 'Asia/Kolkata',
    bio: 'VP Engineering. Leads the backend and infrastructure teams.',
  },
  {
    contact_id: 3,
    first_name: 'Marcus',
    surname: 'Williams',
    email_address: 'marcus@example.com',
    timezone: 'America/Chicago',
    bio: 'Senior frontend engineer with 8 years React experience.',
  },
  {
    contact_id: 4,
    first_name: 'Sofia',
    surname: 'Petrov',
    email_address: 'sofia@example.com',
    phone_number: '+442071234567',
    timezone: 'Europe/London',
    bio: 'Product designer. Responsible for UI/UX across web and mobile.',
  },
  {
    contact_id: 5,
    first_name: 'Kenji',
    surname: 'Tanaka',
    email_address: 'kenji@example.com',
    timezone: 'Asia/Tokyo',
    bio: 'DevOps lead managing CI/CD and cloud infrastructure.',
  },
  {
    contact_id: 6,
    first_name: 'Elena',
    surname: 'Rodriguez',
    email_address: 'elena@example.com',
    timezone: 'America/Los_Angeles',
    bio: 'Data scientist working on analytics and ML pipelines.',
  },
  {
    contact_id: 7,
    first_name: 'David',
    surname: 'Kim',
    email_address: 'david.kim@example.com',
    whatsapp_number: '+821012345678',
    timezone: 'Asia/Seoul',
    bio: 'Mobile engineer (iOS/Android), React Native specialist.',
  },
  {
    contact_id: 8,
    first_name: 'Aisha',
    surname: 'Okonkwo',
    email_address: 'aisha@example.com',
    timezone: 'Africa/Lagos',
    bio: 'QA lead. Manages testing strategy and automation.',
  },
  {
    contact_id: 9,
    first_name: 'Luca',
    surname: 'Bianchi',
    email_address: 'luca@example.com',
    timezone: 'Europe/Rome',
    bio: 'Backend engineer focused on API performance and database optimization.',
  },
  {
    contact_id: 10,
    first_name: 'Mei',
    surname: 'Zhang',
    email_address: 'mei@example.com',
    timezone: 'Asia/Shanghai',
    bio: 'Security engineer. Leads penetration testing and compliance.',
  },
  {
    contact_id: 11,
    first_name: 'Noah',
    surname: 'Baker',
    email_address: 'noah@example.com',
    timezone: 'America/Denver',
    bio: 'Technical writer and documentation lead.',
  },
  {
    contact_id: 12,
    first_name: 'Fatima',
    surname: 'Al-Hassan',
    email_address: 'fatima@example.com',
    timezone: 'Asia/Dubai',
    bio: 'Customer success manager, handles enterprise client relationships.',
  },
  {
    contact_id: 13,
    first_name: 'Oscar',
    surname: 'Lindgren',
    email_address: 'oscar@example.com',
    timezone: 'Europe/Stockholm',
    bio: 'ML engineer working on recommendation systems.',
  },
  {
    contact_id: 14,
    first_name: 'Camila',
    surname: 'Santos',
    email_address: 'camila@example.com',
    timezone: 'America/Sao_Paulo',
    bio: 'Growth marketing lead. Manages user acquisition and retention campaigns.',
  },
  {
    contact_id: 15,
    first_name: 'Ryan',
    surname: "O'Brien",
    email_address: 'ryan@example.com',
    timezone: 'Europe/Dublin',
    bio: 'Full-stack engineer, recently joined from a YC startup.',
  },
  {
    contact_id: 16,
    first_name: 'Yuki',
    surname: 'Nakamura',
    email_address: 'yuki@example.com',
    timezone: 'Asia/Tokyo',
    bio: 'Intern, computer science student at University of Tokyo.',
  },
  {
    contact_id: 17,
    first_name: 'Alex',
    surname: 'Novak',
    email_address: 'alex.n@example.com',
    timezone: 'America/New_York',
    bio: 'Finance controller. Manages budgets, P&L, and vendor payments.',
  },
  {
    contact_id: 18,
    first_name: 'Isabelle',
    surname: 'Dupont',
    email_address: 'isabelle@example.com',
    timezone: 'Europe/Paris',
    bio: 'Legal counsel. Oversees contracts, IP, and compliance.',
  },
  {
    contact_id: 19,
    first_name: 'Tom',
    surname: 'Andersen',
    email_address: 'tom@example.com',
    timezone: 'Europe/Oslo',
    bio: 'Platform reliability engineer.',
  },
  {
    contact_id: 20,
    first_name: 'Zara',
    surname: 'Hussain',
    email_address: 'zara@example.com',
    phone_number: '+61412345678',
    timezone: 'Australia/Sydney',
    bio: 'Head of partnerships for APAC region.',
  },
  {
    contact_id: 21,
    first_name: 'Ben',
    surname: 'Carter',
    email_address: 'ben@example.com',
    discord_id: 'bencarter4521',
    timezone: 'America/Los_Angeles',
    bio: 'Community manager, runs Discord and social channels.',
  },
  {
    contact_id: 22,
    first_name: 'Ling',
    surname: 'Wu',
    email_address: 'ling@example.com',
    timezone: 'Asia/Singapore',
    bio: 'Solutions architect for enterprise integrations.',
  },
  {
    contact_id: 23,
    first_name: 'Patrick',
    surname: 'Müller',
    email_address: 'patrick@example.com',
    timezone: 'Europe/Berlin',
    bio: 'VP Sales, EMEA region.',
  },
  {
    contact_id: 24,
    first_name: 'Nadia',
    surname: 'Kowalski',
    email_address: 'nadia@example.com',
    timezone: 'Europe/Warsaw',
    bio: 'Recruiter. Manages engineering and product hiring pipelines.',
  },
];

// ---------------------------------------------------------------------------
// Data: Transcripts
// ---------------------------------------------------------------------------

function buildTranscripts(): Record<string, unknown>[] {
  let msgId = 20_000;
  const msgs: Record<string, unknown>[] = [];

  function msg(
    senderId: number,
    content: string,
    daysAgo: number,
    hour: number,
    minute = 0,
    extra?: Record<string, unknown>
  ) {
    msgs.push({
      message_id: msgId++,
      medium: 'unify_message',
      sender_id: senderId,
      receiver_ids: senderId === ASSISTANT_CONTACT_ID ? [OWNER_CONTACT_ID] : [ASSISTANT_CONTACT_ID],
      content,
      timestamp: ts(daysAgo, hour, minute),
      exchange_id: Math.floor(msgId / 20),
      ...extra,
    });
  }

  // Day 7 — onboarding
  msg(
    1,
    "Hi Aria! Welcome aboard. I'm Jordan, the CEO. Let me know how I can help you get set up.",
    7,
    9
  );
  msg(
    0,
    "Thank you Jordan! Happy to be here. I've already reviewed the company wiki and the product roadmap. I have a few questions about the Q4 priorities — should we schedule a call?",
    7,
    9,
    5
  );
  msg(
    1,
    "Sure, let's do a quick call at 2pm. Also, Priya from engineering will want to sync with you.",
    7,
    9,
    10
  );
  msg(
    0,
    "Perfect, I'll reach out to Priya as well. In the meantime, I'll draft an onboarding checklist for new team members based on what I've seen so far.",
    7,
    9,
    15
  );
  msg(
    2,
    "Hey Aria, Jordan mentioned you're joining us. I'm Priya, VP Engineering. Let's chat about the backend architecture when you're ready.",
    7,
    10
  );
  msg(
    0,
    "Hi Priya! Great to connect. I've been looking at the service topology — I have some thoughts on the authentication layer. When works for you?",
    7,
    10,
    5
  );
  msg(
    2,
    "How about tomorrow morning at 10? I'll add Marcus and Luca too since they own the relevant services.",
    7,
    10,
    10
  );
  msg(0, "Works perfectly. I'll prepare a brief overview of what I've found so far.", 7, 10, 15);

  // Day 6 — architecture discussion
  msg(2, 'Good morning! Ready for the architecture review?', 6, 10);
  msg(
    0,
    "Ready! Here's what I found:\n\n1. Auth service is a single point of failure — no redundancy\n2. Session tokens stored in-memory (lost on restart)\n3. No rate limiting on login endpoints\n4. Password hashing uses MD5 (critical security risk)\n\nI'd recommend we prioritize items 4 and 1 immediately.",
    6,
    10,
    5
  );
  msg(
    3,
    'Good catch on the MD5. I can migrate to bcrypt this sprint. How many rounds do you recommend?',
    6,
    10,
    10
  );
  msg(
    0,
    'Use bcrypt with 12 rounds minimum. That gives ~250ms hash time which is the sweet spot between security and UX. Also implement a password rotation notification — any accounts with MD5 hashes should prompt for password reset on next login.',
    6,
    10,
    15
  );
  msg(
    9,
    "For session storage, we could use Redis. I've used it at my previous company — works well with our existing infrastructure.",
    6,
    10,
    20
  );
  msg(
    0,
    "Agreed, Redis is ideal here. I'd suggest Redis 7+ with TLS, ACLs enabled, and persistence via AOF. For session TTL, 24h for web and 30d for mobile with refresh tokens. Want me to draft the architecture doc?",
    6,
    10,
    25
  );
  msg(2, 'Yes please. Also loop in Kenji for the DevOps side of standing up Redis.', 6, 10, 30);
  msg(
    0,
    "Will do. I'll have the architecture doc ready by EOD and schedule a review with Kenji for infra provisioning.",
    6,
    10,
    35
  );

  // Day 5 — product and design sync
  msg(
    4,
    "Aria, I heard you're helping with the auth overhaul. I need to update the login UI — can you share the new flow requirements?",
    5,
    11
  );
  msg(
    0,
    "Hi Sofia! Here's the updated auth flow:\n\n1. Email + password (existing)\n2. OAuth (Google, GitHub) — new\n3. Magic link via email — new\n4. 2FA via TOTP app — new\n\nFor each flow, users should see clear progress indicators and error messages. I'll send wireframe suggestions.",
    5,
    11,
    10
  );
  msg(
    4,
    "Great. I'll start with the OAuth buttons and magic link input. What about mobile?",
    5,
    11,
    15
  );
  msg(
    0,
    'Mobile should support biometric auth (Face ID / fingerprint) in addition to the above. The SDK handles most of it but we need custom UI for the biometric prompt.',
    5,
    11,
    20
  );
  msg(
    7,
    "I can handle the React Native biometric integration. I've implemented Touch ID flows before — should be straightforward.",
    5,
    11,
    25
  );
  msg(
    0,
    "Perfect, David. Let's coordinate — I'll prepare the API spec for the biometric enrollment endpoint by tomorrow.",
    5,
    11,
    30
  );

  // Day 4 — data and analytics
  msg(
    6,
    'Aria, we need to set up an analytics pipeline for user behavior tracking. Any recommendations?',
    4,
    14
  );
  msg(
    0,
    'For analytics, I recommend a two-layer approach:\n\n**Collection**: Segment (or open-source Jitsu) as the event router\n**Storage**: BigQuery for raw events, dbt for transformations\n**Visualization**: Metabase for internal dashboards\n\nKey events to track: signup, login, feature_used, error_encountered, subscription_changed. Include user_id, session_id, and device_type as properties.',
    4,
    14,
    10
  );
  msg(6, 'Sounds good. What about GDPR compliance for the tracking?', 4, 14, 15);
  msg(
    0,
    "Good question. GDPR requirements:\n\n1. Consent banner before any tracking\n2. Ability to export all user data within 30 days\n3. Right to deletion (anonymize, don't hard-delete for referential integrity)\n4. Data processing agreement with all third-party tools\n5. Cookie policy page\n\nI'll coordinate with Isabelle from legal on the privacy policy updates.",
    4,
    14,
    20
  );
  msg(
    18,
    "Thanks Aria, I'll prepare the DPA templates for our vendors. Can you send me the list of all third-party services that process user data?",
    4,
    15
  );
  msg(
    0,
    "Sure Isabelle. Current third-party data processors:\n\n1. Stripe — payment processing\n2. SendGrid — transactional email\n3. Segment — analytics routing\n4. BigQuery — data warehousing\n5. Sentry — error tracking\n6. Intercom — customer support chat\n\nI'll add GCP (hosting) and Cloudflare (CDN) to the list.",
    4,
    15,
    10
  );

  // Day 3 — QA and testing
  msg(
    8,
    "Aria, I'm building out the test plan for the auth overhaul. What test scenarios should I cover?",
    3,
    9
  );
  msg(
    0,
    'Hi Aisha! Here are the critical test scenarios:\n\n**Happy paths**: login/signup for each method, token refresh, session persistence\n**Edge cases**: expired tokens, concurrent sessions, account lockout after 5 failed attempts\n**Security**: SQL injection on login, XSS in OAuth callback, CSRF on password change\n**Performance**: 1000 concurrent logins, token validation under load\n**Integration**: OAuth provider downtime handling, email delivery failures',
    3,
    9,
    10
  );
  msg(
    8,
    "That's comprehensive. I'll create the test cases in TestRail and assign them across the QA team. ETA for automation: 1 week.",
    3,
    9,
    15
  );
  msg(
    0,
    "For automation, prioritize the happy paths and security tests — those should run on every PR. Edge cases can be nightly. I'd also suggest adding a contract test for each OAuth provider to catch upstream API changes early.",
    3,
    9,
    20
  );

  // Day 2 — hiring and ops
  msg(
    24,
    'Aria, we need to hire 2 more backend engineers. Can you help draft the job description?',
    2,
    11
  );
  msg(
    0,
    "Of course Nadia! Based on the current tech stack and upcoming projects, here's a draft:\n\n**Role**: Backend Engineer (Mid/Senior)\n**Stack**: Python, PostgreSQL, Redis, GCP\n**Must have**: 3+ years backend exp, REST API design, SQL proficiency\n**Nice to have**: GraphQL, Kubernetes, event-driven architecture\n**Projects**: Auth service migration, analytics pipeline, API gateway\n\nSalary range should be competitive with Series B companies in the Bay Area.",
    2,
    11,
    10
  );
  msg(
    17,
    'Aria, regarding the Q4 budget — the engineering headcount increase will need board approval. Can you prepare a cost-benefit analysis?',
    2,
    14
  );
  msg(
    0,
    "Hi Alex. Here's the summary:\n\n**Cost**: 2 engineers × $180K avg = $360K annual (+ benefits ~$90K)\n**Benefit**: Reduces delivery timeline by 40%, unblocks 3 revenue-generating features\n**ROI**: Features projected to generate $1.2M ARR by Q2 next year\n**Risk of not hiring**: 6-month delay, potential churn of existing engineers due to overwork\n\nI'll format this into a one-page brief for the board deck.",
    2,
    14,
    15
  );

  // Day 1 — customer success
  msg(
    12,
    'Aria, our enterprise client Acme Corp is asking about custom SSO integration. Can you assess the effort?',
    1,
    10
  );
  msg(
    0,
    "Hi Fatima! SSO integration assessment:\n\n**Protocol**: SAML 2.0 (Acme uses Okta)\n**Effort**: ~2 weeks with our current auth architecture\n**Prerequisites**: The auth overhaul needs to land first (ETA: end of this sprint)\n**Pricing**: This should be a premium feature — suggest $500/month add-on\n\nI can prepare a technical proposal document for Acme if you'd like.",
    1,
    10,
    10
  );
  msg(
    12,
    'That would be great. They also want to know about our data residency options.',
    1,
    10,
    15
  );
  msg(
    0,
    "Data residency options:\n\n**Current**: US-East (GCP us-east1)\n**Available Q1**: EU (GCP europe-west1)\n**Available Q2**: APAC (GCP asia-southeast1)\n\nFor Acme specifically, EU residency would satisfy their compliance needs. The multi-region setup is on Kenji's roadmap — I'll confirm the timeline with him.",
    1,
    10,
    20
  );

  // Day 0 — today
  msg(1, 'Morning Aria! Status update on the sprint?', 0, 9);
  msg(
    0,
    "Good morning Jordan! Sprint progress:\n\n**Completed** (18/30 pts):\n- Password hashing migration ✅\n- Redis session storage ✅\n- OAuth Google integration ✅\n- Login rate limiting ✅\n\n**In progress** (8 pts):\n- OAuth GitHub integration (David, 80%)\n- 2FA TOTP (Marcus, 60%)\n\n**Remaining** (4 pts):\n- Magic link flow\n- Biometric enrollment API\n\nWe're on track to complete everything by Friday.",
    0,
    9,
    5
  );
  msg(
    1,
    'Excellent progress. The board meeting is next Tuesday — can you prepare the engineering update?',
    0,
    9,
    10
  );
  msg(
    0,
    "Already working on it. I'll include: sprint velocity trends (up 15%), security posture improvements, infrastructure cost reduction from the Redis migration, and the hiring pipeline status. Draft will be ready for your review by tomorrow morning.",
    0,
    9,
    15
  );

  // -----------------------------------------------------------------
  // Extended conversations (days 14–8 ago) for infinite scroll testing.
  // Adds ~160 messages across various team members and topics.
  // -----------------------------------------------------------------

  const STANDUP_TOPICS = [
    {
      sender: 5,
      q: 'Aria, the CI pipeline is taking 25 minutes per run. Any ideas on speeding it up?',
      a: 'A few things we can do:\n\n1. Parallelize test suites — split unit/integration/e2e across workers\n2. Cache node_modules and Docker layers between runs\n3. Use incremental TypeScript builds (tsc --build)\n4. Skip unchanged packages in the monorepo\n\nI estimate we can get it down to 8-10 minutes.',
    },
    {
      sender: 3,
      q: 'The dashboard bundle size is 2.4MB. Users on slow connections are complaining.',
      a: "Let's attack this from multiple angles:\n\n1. Code splitting — lazy load each dashboard tab\n2. Tree-shake unused lodash/moment imports (switch to date-fns)\n3. Replace react-icons with individual SVG imports\n4. Enable Brotli compression on the CDN\n\nTarget: under 800KB initial bundle.",
    },
    {
      sender: 10,
      q: 'I found a potential XSS vulnerability in the markdown renderer. Should I file a CVE?',
      a: "Good catch Mei. Let's handle this carefully:\n\n1. Don't file a public CVE yet — patch first\n2. Sanitize all HTML output with DOMPurify\n3. Add Content-Security-Policy headers to block inline scripts\n4. Write a regression test\n5. After the fix ships, we can disclose responsibly\n\nI'll prepare the patch today.",
    },
    {
      sender: 11,
      q: "Aria, I'm rewriting the API docs. Should I use OpenAPI 3.0 or 3.1?",
      a: "Go with OpenAPI 3.1 — it aligns with JSON Schema draft 2020-12, which gives us:\n\n- Proper nullable types (no more `nullable: true` hack)\n- `const` keyword for fixed values\n- Better discriminated unions with `oneOf`\n\nMost tools support 3.1 now. I'll review the first draft when it's ready.",
    },
    {
      sender: 13,
      q: "The recommendation model accuracy dropped 3% after last week's data refresh. Any ideas?",
      a: "A few things to investigate, Oscar:\n\n1. Check for data drift — compare feature distributions before/after\n2. Look for label noise in recent training data\n3. Verify the feature pipeline isn't dropping records\n4. Check if the data refresh included a schema change\n\nLet's pair on this tomorrow — I'll set up a Jupyter notebook with diagnostic queries.",
    },
    {
      sender: 14,
      q: "We're planning a Product Hunt launch next month. What should the engineering team prepare?",
      a: "For a successful PH launch, Camila, engineering needs:\n\n1. **Load testing**: simulate 10x normal traffic (PH spike is real)\n2. **Monitoring dashboard**: real-time error rate, latency, signups\n3. **Feature flags**: ability to disable non-critical features under load\n4. **On-call rotation**: 3 engineers covering the 48-hour launch window\n5. **Landing page**: optimized for Lighthouse score >95\n\nI'll coordinate the load test this week.",
    },
    {
      sender: 19,
      q: 'The Kubernetes cluster is showing memory pressure on 2 out of 5 nodes. Should we scale up?',
      a: "Let's be strategic about this, Tom:\n\n1. First check for memory leaks — run `kubectl top pods` and identify outliers\n2. Review resource requests vs actual usage (likely over-provisioned on some pods)\n3. Enable HPA (Horizontal Pod Autoscaler) for the top 3 memory consumers\n4. If we still need more capacity, add a node with 32GB instead of scaling all 5\n\nI'll draft the HPA configs today.",
    },
    {
      sender: 15,
      q: "I just joined last week. What's the best way to get up to speed on the codebase?",
      a: "Welcome Ryan! Here's the onboarding path I recommend:\n\n1. Read the architecture README in the repo root (30 min)\n2. Set up local dev env following CONTRIBUTING.md\n3. Browse the last 10 merged PRs to see coding patterns\n4. Pick a \"good first issue\" from the backlog\n5. Pair with Marcus on a frontend task or Luca on backend\n\nDon't hesitate to ask questions in engineering — everyone's friendly.",
    },
    {
      sender: 20,
      q: 'Aria, we have a potential partnership with a Japanese payment provider. Can we support JPY?',
      a: "Hi Zara! Multi-currency support assessment:\n\n**Current state**: USD and EUR only via Stripe\n**JPY via Stripe**: Supported, but zero-decimal currency (no cents)\n**Effort**: ~3 days to update pricing engine and invoice templates\n**Considerations**: Japanese tax invoicing (qualified invoice system) requires specific formatting\n\nI'd recommend we scope this as a 1-week project including QA.",
    },
    {
      sender: 21,
      q: 'The Discord community is growing fast — 500 new members this week. Any tips for managing it?',
      a: 'Great growth Ben! Scaling community management:\n\n1. Set up auto-moderation with MEE6 or Dyno for spam/toxicity\n2. Create a getting-started channel with pinned FAQ\n3. Add role-based channels (users, developers, enterprise)\n4. Schedule weekly "office hours" where engineers answer questions\n5. Bot integration: pipe GitHub releases and status page updates to announcements\n\nI can help configure the bots if you share the server settings.',
    },
    {
      sender: 22,
      q: 'Aria, an enterprise client wants to integrate our API with their SAP system. How complex is that?',
      a: "SAP integration is non-trivial but doable, Ling:\n\n**Approach 1**: SAP Cloud Integration (middleware) — 2-3 weeks, lower maintenance\n**Approach 2**: Direct RFC/BAPI calls — 1 week, but requires SAP expertise\n**Approach 3**: IDoc-based batch processing — simplest but not real-time\n\nI'd recommend Approach 1 with SAP CI. We should charge a one-time integration fee ($10K-15K). Want me to prepare a technical scoping document?",
    },
    {
      sender: 23,
      q: 'The sales pipeline in EMEA is looking strong. Can we handle 3x the current client load by Q2?',
      a: "Patrick, let's do a capacity assessment:\n\n**Current**: 50 enterprise clients, ~5K RPM peak\n**3x target**: 150 clients, ~15K RPM peak\n\n**Infrastructure**: We'll need to upgrade to 3 API server replicas and add read replicas for the DB. Cost: ~$2K/month extra.\n**Support**: We'll need 1 additional CSM and documentation in German/French.\n**Timeline**: Infrastructure ready in 2 weeks. Support hiring is the bottleneck (6-8 weeks).\n\nI'll share a detailed scaling plan by Friday.",
    },
    {
      sender: 16,
      q: "Hi Aria! I'm working on the intern project — building a CLI tool for our API. Is Go or Rust a better choice?",
      a: "Great question Yuki! For a CLI tool:\n\n**Go**: Faster to develop, simpler concurrency, excellent stdlib for HTTP/JSON. Single binary with no runtime deps. Most of the team knows Go.\n**Rust**: Better performance (marginal for a CLI), stricter type safety. Steeper learning curve.\n\nI'd recommend Go for this project — you'll ship faster and the team can maintain it. Use the cobra library for CLI structure and viper for config management.",
    },
    {
      sender: 7,
      q: 'The iOS app is crashing on startup for users running iOS 16. React Native 0.73 minimum is iOS 15.1 so it should work.',
      a: "This is likely a native module compatibility issue, David. Debug steps:\n\n1. Check Xcode crash logs for the specific exception\n2. Run on an iOS 16 simulator with address sanitizer enabled\n3. Likely culprit: one of the native modules (react-native-screens or react-native-reanimated) has an iOS 16 regression\n4. Try downgrading react-native-screens to 3.28 — there was a known issue in 3.29\n\nIf that doesn't work, share the crash log and I'll dig deeper.",
    },
    {
      sender: 9,
      q: 'The database query for the user list endpoint takes 800ms with 100K users. How can we optimize?',
      a: 'Several optimization strategies, Luca:\n\n1. **Indexing**: Add a composite index on (created_at, status) for the common filter\n2. **Pagination**: Switch from OFFSET to keyset pagination (WHERE id > last_id)\n3. **Select optimization**: Only fetch columns needed for the list view, not the full row\n4. **Materialized view**: For the admin dashboard, pre-compute user stats hourly\n5. **Connection pooling**: Ensure PgBouncer is configured with transaction mode\n\nThe keyset pagination alone should drop it to <50ms.',
    },
    {
      sender: 6,
      q: 'Aria, the ETL job failed overnight. Looks like BigQuery rate limited us during the load phase.',
      a: "This happens when we hit the streaming insert quota, Elena. Fixes:\n\n1. **Immediate**: Switch to batch load jobs instead of streaming inserts for the nightly ETL\n2. **Short-term**: Implement exponential backoff with jitter on rate limit errors\n3. **Long-term**: Use Pub/Sub → Dataflow → BigQuery pipeline for real-time data\n\nThe batch load approach has no rate limits and is cheaper. I'll update the ETL config now.",
    },
    {
      sender: 2,
      q: 'Aria, we need to decide on our observability stack. What do you recommend for a team of 20 engineers?',
      a: "For our scale, Priya, here's what I recommend:\n\n**Metrics**: Prometheus + Grafana (self-hosted, ~$200/month infra)\n**Logs**: Loki (integrates with Grafana, much cheaper than ELK)\n**Traces**: OpenTelemetry SDK → Tempo (Grafana's tracing backend)\n**Alerts**: Grafana OnCall (free tier covers our needs)\n\nTotal cost: ~$400/month vs $2K+ for Datadog at our volume. The Grafana ecosystem gives us a unified pane of glass.",
    },
    {
      sender: 1,
      q: 'Aria, an investor asked about our technical moat. Can you summarize what makes our architecture unique?',
      a: "Jordan, here's the technical moat summary:\n\n1. **Multi-tenant isolation**: Each customer gets their own data partition with row-level security — enterprise-grade without the cost of single-tenant\n2. **Edge computing layer**: Our CDN processes auth and rate limiting at the edge, reducing latency by 60% vs competitors\n3. **Proprietary ML pipeline**: The recommendation engine is trained on anonymized behavioral data across all tenants, improving accuracy as the platform grows\n4. **API-first design**: Every feature is accessible via API, enabling integrations competitors can't match\n\nI can expand this into a one-pager for the investor deck.",
    },
    {
      sender: 5,
      q: "Quick update: I've finished setting up the Redis cluster. 3 nodes, TLS enabled, AOF persistence. Running in the staging environment now.",
      a: 'Excellent work Kenji! A few things to verify before we promote to production:\n\n1. Run a chaos test — kill one node and verify failover completes in <5 seconds\n2. Confirm maxmemory-policy is set to allkeys-lru\n3. Verify the Prometheus Redis exporter is scraping metrics\n4. Load test with 10K concurrent sessions to validate memory usage\n\nOnce those pass, we can schedule the production cutover for next Tuesday.',
    },
    {
      sender: 8,
      q: "All auth test cases are written — 47 tests covering the full matrix. I'm starting automation with Playwright tomorrow.",
      a: "Great progress Aisha! For the Playwright setup:\n\n1. Use `test.describe.parallel()` to run independent auth flows concurrently\n2. Create a shared `authFixtures.ts` for test user setup/teardown\n3. Mock the OAuth providers in CI — don't hit real Google/GitHub APIs\n4. Add visual regression tests for the login page (screenshot comparison)\n\nI'll review the first batch of automated tests when they're ready.",
    },
  ];

  for (let i = 0; i < STANDUP_TOPICS.length; i++) {
    const topic = STANDUP_TOPICS[i];
    const day = 14 - Math.floor(i / 3);
    const hour = 9 + (i % 3) * 3;
    msg(topic.sender, topic.q, day, hour);
    msg(0, topic.a, day, hour, 8);
  }

  // Bulk daily check-ins from various contacts (days 14–8)
  const CHECKIN_SENDERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 15, 19, 20];
  const CHECKIN_QUESTIONS = [
    'Can you give me a quick update on your current priorities?',
    "What's the ETA on the task I assigned yesterday?",
    'Are there any blockers I should know about?',
    'Did you get a chance to review the document I shared?',
    'Can you pull the latest metrics for our weekly report?',
    'I need your input on the architecture proposal — thoughts?',
    'Can we reschedule our 1:1 to tomorrow?',
    'The client is asking for an update — what should I tell them?',
    'Have you seen the Slack thread about the outage last night?',
    "Quick question: what's our current test coverage percentage?",
    "Can you review PR 287 when you get a chance? It's blocking the release.",
    "I'm drafting the quarterly OKRs — can you suggest engineering objectives?",
    'The new intern starts Monday — can you prepare a project for them?',
    'We got feedback from the beta users — mostly positive but they want dark mode.',
    "Heads up: there's a planned database maintenance window tonight at 2am.",
    'Can you set up a staging environment for the enterprise demo on Friday?',
    'The monitoring dashboard shows a slow increase in error rate — is that expected?',
    "I'm presenting to the board next week — can you prepare the tech slides?",
    'We need to renew our GCP committed use discount — should we increase capacity?',
    'The design team wants to use a new component library — Shadcn UI. Thoughts?',
    'Can you estimate how long it would take to add webhook support to the API?',
    'The competitor just launched a similar feature. How does ours compare?',
    'I need a data export for the compliance audit — JSON format, last 90 days.',
    'Can we add a health check endpoint that our load balancer can ping?',
    'The marketing team wants to embed analytics on the pricing page — feasible?',
    'Quick ask: can you whitelist the new office IP range in our firewall rules?',
    "We're evaluating a switch from Heroku to GCP Cloud Run. Pros and cons?",
    'The mobile app needs push notification support — what backend changes are needed?',
    'Can you document the deployment runbook for the on-call rotation?',
    "I'm debugging a race condition in the WebSocket handler — any tips?",
  ];
  const CHECKIN_ANSWERS = [
    "I'm currently focused on the auth migration and the infrastructure scaling plan. Both are on track for the sprint deadline.",
    'The task is about 70% complete. I hit a dependency issue but found a workaround. Should be done by end of day tomorrow.',
    'No major blockers right now. The only risk is the third-party API response times, but I have a caching layer as fallback.',
    "Yes, I reviewed it this morning. I left some comments inline — the overall structure is solid but I'd suggest restructuring section 3.",
    'Here are the latest metrics: DAU up 12%, API latency P99 at 450ms, error rate 0.3%. All within acceptable ranges.',
    'I think the proposal is solid. My one suggestion: add a caching layer between the API gateway and the microservices to reduce database load.',
    "Tomorrow works. I've blocked 2-3pm on my calendar. Let me know if that time works for you.",
    "Tell them we're on track for the milestone. The auth upgrade completes this sprint, and the dashboard refresh ships next sprint.",
    "Yes, I investigated. It was a DNS issue with our CDN provider — resolved within 20 minutes. I'm writing the post-mortem now.",
    "Current test coverage is 76%. We're targeting 80% by end of quarter. The biggest gaps are in the payment module and admin panel.",
    "I'll review it right after this meeting. Based on the PR description, it looks like a solid refactor — should be a quick review.",
    "Engineering OKRs I'd suggest: 1) Reduce P99 latency to <200ms, 2) Achieve 99.95% uptime, 3) Ship auth v2, 4) Hire 2 senior engineers.",
    "I'll prepare a well-scoped starter project. I'm thinking a CLI tool for our internal API — good learning experience with clear deliverables.",
    "Dark mode is on the roadmap for next quarter. We're already using CSS variables for theming, so the implementation should be straightforward.",
    "Acknowledged. I'll ensure all cron jobs are paused during the window and set up automated health checks to verify recovery.",
    "I'll clone the production environment to staging and load the demo dataset. Should be ready by Thursday evening for a dry run.",
    "Checking now... it's correlated with the new feature flag rollout at 10%. Some users are hitting an uncaught exception. Pushing a hotfix.",
    "I'll prepare slides covering: architecture evolution, team velocity, security improvements, and the scaling roadmap. Draft by Wednesday.",
    "Yes, we should increase by 30% based on current growth trajectory. The committed use discount saves us 25% vs on-demand. I'll run the numbers.",
    "Shadcn UI is excellent — built on Radix primitives, fully accessible, and highly customizable. I'd recommend it. We'd save ~2 weeks of component development.",
    'Webhook support estimate: 1 week for basic (HTTP POST on events), 2 weeks for production-grade (retry logic, signature verification, delivery dashboard).',
    "Our implementation is more flexible — we support custom workflows while they're template-only. We should highlight this in marketing materials.",
    "I'll generate the export and encrypt it with the compliance team's GPG key. Should be ready within 2 hours.",
    "Done — I've added a /health endpoint that returns 200 with response time and dependency status. The load balancer can poll it every 10 seconds.",
    "Feasible but we need to be careful about cookie consent. I'd recommend a lightweight Plausible embed rather than full Google Analytics.",
    'The new IP range has been added to the firewall allowlist and the VPN config. Changes take effect within 5 minutes.',
    "Cloud Run pros: auto-scaling, pay-per-use, no server management. Cons: cold start latency (~2s), less control over networking. I'd recommend it for our stateless API services.",
    'Backend changes needed: 1) FCM integration for push delivery, 2) User device token storage, 3) Notification preferences API, 4) Push template engine. Estimate: 1.5 weeks.',
    "I've documented the full runbook in Notion: pre-deploy checklist, deploy commands, smoke test procedures, rollback steps, and escalation contacts.",
    'For WebSocket race conditions: use a mutex or channel to serialize message processing. Also add sequence numbers to messages so the client can detect and reorder out-of-sequence deliveries.',
  ];

  for (let i = 0; i < CHECKIN_QUESTIONS.length; i++) {
    const sender = CHECKIN_SENDERS[i % CHECKIN_SENDERS.length];
    const day = 14 - Math.floor(i / 5);
    const hour = 10 + (i % 5) * 2;
    msg(sender, CHECKIN_QUESTIONS[i], day, hour);
    msg(0, CHECKIN_ANSWERS[i], day, hour, 6);
  }

  return msgs;
}

// ---------------------------------------------------------------------------
// Data: Knowledge (Products)
// ---------------------------------------------------------------------------

const KNOWLEDGE_PRODUCTS: Record<string, unknown>[] = [
  {
    product_id: 'PROD-001',
    name: 'Cloud Console',
    category: 'Platform',
    status: 'GA',
    price_monthly: 0,
    description:
      'Web-based management dashboard for all services. Includes user management, billing, and analytics.',
    launch_date: '2024-01-15',
  },
  {
    product_id: 'PROD-002',
    name: 'Auth Service',
    category: 'Security',
    status: 'Beta',
    price_monthly: 99,
    description: 'Enterprise-grade authentication with SSO, MFA, and role-based access control.',
    launch_date: '2025-03-01',
  },
  {
    product_id: 'PROD-003',
    name: 'Data Pipeline',
    category: 'Analytics',
    status: 'GA',
    price_monthly: 299,
    description:
      'Real-time data ingestion, transformation, and warehousing. Supports 50+ data sources.',
    launch_date: '2024-06-10',
  },
  {
    product_id: 'PROD-004',
    name: 'Edge CDN',
    category: 'Infrastructure',
    status: 'GA',
    price_monthly: 49,
    description:
      'Global content delivery network with 200+ PoPs. Automatic image optimization and DDoS protection.',
    launch_date: '2024-04-20',
  },
  {
    product_id: 'PROD-005',
    name: 'ML Studio',
    category: 'AI/ML',
    status: 'Alpha',
    price_monthly: 499,
    description:
      'No-code machine learning platform for model training, evaluation, and deployment.',
    launch_date: '2025-09-01',
  },
  {
    product_id: 'PROD-006',
    name: 'Notification Hub',
    category: 'Communication',
    status: 'GA',
    price_monthly: 29,
    description:
      'Multi-channel notification service: email, SMS, push, and in-app. Template engine with A/B testing.',
    launch_date: '2024-08-15',
  },
  {
    product_id: 'PROD-007',
    name: 'API Gateway',
    category: 'Infrastructure',
    status: 'GA',
    price_monthly: 79,
    description:
      'Managed API gateway with rate limiting, authentication, request transformation, and observability.',
    launch_date: '2024-10-01',
  },
  {
    product_id: 'PROD-008',
    name: 'Serverless Functions',
    category: 'Compute',
    status: 'Beta',
    price_monthly: 0,
    description:
      'Event-driven compute platform. Pay-per-invocation pricing. Supports Node.js, Python, Go, and Rust.',
    launch_date: '2025-05-15',
  },
  {
    product_id: 'PROD-009',
    name: 'Object Storage',
    category: 'Storage',
    status: 'GA',
    price_monthly: 19,
    description:
      'S3-compatible object storage with lifecycle policies, versioning, and cross-region replication.',
    launch_date: '2024-02-28',
  },
  {
    product_id: 'PROD-010',
    name: 'Managed Postgres',
    category: 'Database',
    status: 'GA',
    price_monthly: 149,
    description:
      'Fully managed PostgreSQL with automated backups, point-in-time recovery, and read replicas.',
    launch_date: '2024-03-10',
  },
  {
    product_id: 'PROD-011',
    name: 'Feature Flags',
    category: 'DevTools',
    status: 'Beta',
    price_monthly: 39,
    description:
      'Feature flag management with percentage rollouts, user targeting, and experiment tracking.',
    launch_date: '2025-07-01',
  },
  {
    product_id: 'PROD-012',
    name: 'Status Page',
    category: 'Operations',
    status: 'GA',
    price_monthly: 15,
    description:
      'Public and private status pages with incident management, subscriber notifications, and SLA tracking.',
    launch_date: '2024-11-20',
  },
];

// ---------------------------------------------------------------------------
// Data: Knowledge (FAQ)
// ---------------------------------------------------------------------------

const KNOWLEDGE_FAQ: Record<string, unknown>[] = [
  {
    question: 'How do I reset my password?',
    answer:
      'Go to Settings > Security > Change Password. You can also use the "Forgot Password" link on the login page, which sends a reset email valid for 1 hour.',
    category: 'Account',
    last_updated: '2025-10-01',
  },
  {
    question: 'What payment methods do you accept?',
    answer:
      'We accept all major credit/debit cards (Visa, Mastercard, Amex), wire transfers for enterprise plans, and ACH bank transfers for US customers.',
    category: 'Billing',
    last_updated: '2025-09-15',
  },
  {
    question: 'How do I add team members?',
    answer:
      'Navigate to Settings > Team > Invite Member. Enter their email address and select a role (Admin, Member, or Viewer). They will receive an email invitation.',
    category: 'Team',
    last_updated: '2025-10-10',
  },
  {
    question: 'What is your uptime SLA?',
    answer:
      'We offer 99.9% uptime for Business plans and 99.99% for Enterprise plans. SLA credits are automatically applied if we fall below the guaranteed threshold.',
    category: 'Infrastructure',
    last_updated: '2025-08-20',
  },
  {
    question: 'Can I export my data?',
    answer:
      'Yes, all data can be exported via the API or the Console UI (Settings > Data > Export). We support JSON, CSV, and Parquet formats. GDPR data export requests are fulfilled within 72 hours.',
    category: 'Data',
    last_updated: '2025-11-01',
  },
  {
    question: 'Do you support SSO?',
    answer:
      'Yes, we support SAML 2.0 and OpenID Connect for enterprise SSO. Supported providers include Okta, Azure AD, Google Workspace, and OneLogin. SSO is available on Business and Enterprise plans.',
    category: 'Security',
    last_updated: '2025-10-20',
  },
  {
    question: 'What regions are available?',
    answer:
      'We currently operate in US-East, EU-West, and APAC-Southeast regions. Data residency controls allow you to restrict data to specific regions for compliance.',
    category: 'Infrastructure',
    last_updated: '2025-09-01',
  },
  {
    question: 'How do I cancel my subscription?',
    answer:
      'Go to Settings > Billing > Cancel Subscription. Your access continues until the end of the current billing period. Data is retained for 90 days after cancellation.',
    category: 'Billing',
    last_updated: '2025-10-05',
  },
];

// ---------------------------------------------------------------------------
// Data: Tasks
// ---------------------------------------------------------------------------

const TASKS: Record<string, unknown>[] = [
  {
    task_id: 1,
    name: 'Migrate password hashing',
    description:
      'Switch from bcrypt to argon2id for all stored password hashes with zero-downtime migration.',
    status: 'completed',
    trigger_type: 'manual',
    entrypoint: 'migrate_password_hashing',
    created_at: ts(6, 10),
    updated_at: ts(5, 16),
    next_due_at: null,
  },
  {
    task_id: 2,
    name: 'Set up Redis session store',
    description:
      'Replace in-memory session storage with Redis-backed sessions for horizontal scaling.',
    status: 'completed',
    trigger_type: 'manual',
    entrypoint: 'setup_redis_sessions',
    created_at: ts(6, 11),
    updated_at: ts(5, 18),
    next_due_at: null,
  },
  {
    task_id: 3,
    name: 'Google OAuth integration',
    description:
      'Implement Sign-in with Google using OAuth 2.0 PKCE flow and automatic account linking.',
    status: 'completed',
    trigger_type: 'manual',
    entrypoint: 'implement_oauth_google',
    created_at: ts(5, 9),
    updated_at: ts(4, 14),
    next_due_at: null,
  },
  {
    task_id: 4,
    name: 'GitHub OAuth integration',
    description: 'Add GitHub as an OAuth provider with org-level access scoping.',
    status: 'in_progress',
    trigger_type: 'manual',
    entrypoint: 'implement_oauth_github',
    created_at: ts(3, 9),
    updated_at: ts(1, 11),
    next_due_at: ts(-1, 17),
  },
  {
    task_id: 5,
    name: 'TOTP two-factor authentication',
    description: 'Add TOTP-based 2FA with QR code enrollment and backup recovery codes.',
    status: 'in_progress',
    trigger_type: 'manual',
    entrypoint: 'implement_totp_2fa',
    created_at: ts(3, 10),
    updated_at: ts(0, 15),
    next_due_at: ts(-1, 17),
  },
  {
    task_id: 6,
    name: 'Magic link authentication',
    description: 'Passwordless login via magic link emails with configurable TTL.',
    status: 'pending',
    trigger_type: 'manual',
    entrypoint: 'implement_magic_link_auth',
    created_at: ts(2, 9),
    updated_at: ts(2, 9),
    next_due_at: ts(-3, 17),
  },
  {
    task_id: 7,
    name: 'Biometric enrollment API',
    description:
      'Design and implement WebAuthn-based biometric enrollment endpoints for passkey support.',
    status: 'pending',
    trigger_type: 'manual',
    entrypoint: 'biometric_enrollment_api',
    created_at: ts(2, 11),
    updated_at: ts(2, 11),
    next_due_at: ts(-3, 17),
  },
  {
    task_id: 8,
    name: 'Generate weekly engineering report',
    description:
      'Compile deployment count, incident summary, velocity metrics, and blockers into a Slack-posted report.',
    status: 'completed',
    trigger_type: 'scheduled',
    entrypoint: 'generate_weekly_report',
    created_at: ts(7, 8),
    updated_at: ts(0, 8, 30),
    next_due_at: ts(-1, 8),
    schedule: { start_at: ts(-1, 8) },
    repeat: [{ frequency: 'weekly', interval: 1, weekdays: ['MO'], time_of_day: '08:00' }],
  },
  {
    task_id: 9,
    name: 'Prepare board deck',
    description:
      'Aggregate KPIs, revenue projections, and product roadmap updates into the quarterly board presentation.',
    status: 'pending',
    trigger_type: 'manual',
    entrypoint: 'prepare_board_deck',
    created_at: ts(0, 9),
    updated_at: ts(0, 9),
    next_due_at: ts(-2, 17),
  },
  {
    task_id: 10,
    name: 'Monitor error rates',
    description:
      'Continuously poll error-tracking service and alert on-call if 5xx rate exceeds threshold.',
    status: 'running',
    trigger_type: 'scheduled',
    entrypoint: 'monitor_error_rates',
    offline: true,
    created_at: ts(5, 8),
    updated_at: ts(0, 12),
    next_due_at: ts(0, 12),
    schedule: { start_at: ts(0, 12) },
    repeat: [{ frequency: 'daily', interval: 1, time_of_day: '12:00' }],
  },
  {
    task_id: 11,
    name: 'Update API documentation',
    description: 'Regenerate OpenAPI specs from code annotations and update the developer portal.',
    status: 'completed',
    trigger_type: 'manual',
    entrypoint: 'update_api_documentation',
    created_at: ts(4, 9),
    updated_at: ts(3, 17),
    next_due_at: null,
  },
  {
    task_id: 12,
    name: 'Assess SSO integration',
    description: 'Evaluate SAML 2.0 vs OIDC for enterprise SSO, produce recommendation document.',
    status: 'pending',
    trigger_type: 'manual',
    entrypoint: 'assess_sso_integration',
    created_at: ts(1, 10),
    updated_at: ts(1, 10),
    next_due_at: ts(-5, 17),
  },
  {
    task_id: 13,
    name: 'Migrate legacy user data',
    description:
      'ETL pipeline to transform and import 2.3M user records from the legacy MySQL database.',
    status: 'failed',
    trigger_type: 'manual',
    entrypoint: 'etl_migrate_legacy_users',
    created_at: ts(4, 14),
    updated_at: ts(3, 22),
    next_due_at: null,
  },
  {
    task_id: 14,
    name: 'Draft backend job description',
    description:
      'Write the job description and screening rubric for the Senior Backend Engineer role.',
    status: 'in_progress',
    trigger_type: 'manual',
    entrypoint: 'draft_job_description_backend',
    created_at: ts(2, 11),
    updated_at: ts(0, 14),
    next_due_at: ts(-1, 17),
  },
  {
    task_id: 15,
    name: 'Fix dashboard query performance',
    description:
      'Optimize the slow analytics dashboard queries — add composite indexes and materialized views.',
    status: 'completed',
    trigger_type: 'manual',
    entrypoint: 'fix_dashboard_query_performance',
    created_at: ts(1, 14),
    updated_at: ts(0, 18),
    next_due_at: null,
  },
  {
    task_id: 16,
    name: 'Respond to new WhatsApp messages',
    description:
      'Listen for incoming WhatsApp messages and draft a contextual response for the assistant to review.',
    status: 'active',
    trigger_type: 'triggered',
    entrypoint: 'handle_whatsapp_inbound',
    created_at: ts(4, 10),
    updated_at: ts(0, 9),
    next_due_at: null,
    trigger: { medium: 'whatsapp', recurring: true },
  },
  {
    task_id: 17,
    name: 'Nightly database backup',
    description:
      'Take a pg_dump snapshot of the production database and upload to S3 with 30-day retention.',
    status: 'scheduled',
    trigger_type: 'scheduled',
    entrypoint: 'nightly_db_backup',
    offline: true,
    created_at: ts(6, 8),
    updated_at: ts(0, 2),
    next_due_at: ts(-1, 2),
    schedule: { start_at: ts(-1, 2) },
    repeat: [{ frequency: 'daily', interval: 1, time_of_day: '02:00' }],
  },
  {
    task_id: 18,
    name: 'Triage SMS support requests',
    description: 'Classify and route inbound SMS support messages to the appropriate team queue.',
    status: 'active',
    trigger_type: 'triggered',
    entrypoint: 'triage_sms_support',
    created_at: ts(3, 9),
    updated_at: ts(0, 11),
    next_due_at: null,
    trigger: { medium: 'sms_message', from_contact_ids: [1, 2], recurring: true, interrupt: true },
  },
  {
    task_id: 19,
    name: 'Monthly cost report',
    description:
      'Pull cloud infrastructure costs from AWS Cost Explorer and produce a month-over-month comparison.',
    status: 'queued',
    trigger_type: 'scheduled',
    entrypoint: 'monthly_cost_report',
    created_at: ts(5, 10),
    updated_at: ts(0, 10),
    next_due_at: ts(-1, 9),
    schedule: { start_at: ts(-1, 9) },
    repeat: [{ frequency: 'monthly', interval: 1, time_of_day: '09:00', count: 12 }],
  },
  {
    task_id: 20,
    name: 'Sync CRM contacts',
    description: 'Bi-directional sync between internal contacts and Salesforce CRM every 6 hours.',
    status: 'paused',
    trigger_type: 'scheduled',
    entrypoint: 'sync_crm_contacts',
    offline: true,
    created_at: ts(4, 14),
    updated_at: ts(1, 14),
    next_due_at: null,
    schedule: { start_at: ts(-1, 6) },
    repeat: [
      { frequency: 'daily', interval: 1, time_of_day: '06:00' },
      { frequency: 'daily', interval: 1, time_of_day: '12:00' },
      { frequency: 'daily', interval: 1, time_of_day: '18:00' },
      { frequency: 'daily', interval: 1, time_of_day: '00:00' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Data: Tasks/Runs (Activity)
// ---------------------------------------------------------------------------

const TASK_RUNS: Record<string, unknown>[] = [
  {
    task_id: 8,
    task_name: 'Generate weekly engineering report',
    task_description:
      'Compile deployment count, incident summary, velocity metrics, and blockers into a Slack-posted report.',
    source_type: 'scheduled',
    state: 'completed',
    scheduled_for: ts(7, 8),
    started_at: ts(7, 8, 1),
    completed_at: ts(7, 8, 12),
  },
  {
    task_id: 8,
    task_name: 'Generate weekly engineering report',
    task_description:
      'Compile deployment count, incident summary, velocity metrics, and blockers into a Slack-posted report.',
    source_type: 'scheduled',
    state: 'completed',
    scheduled_for: ts(0, 8),
    started_at: ts(0, 8, 1),
    completed_at: ts(0, 8, 15),
  },
  {
    task_id: 10,
    task_name: 'Monitor error rates',
    task_description:
      'Continuously poll error-tracking service and alert on-call if 5xx rate exceeds threshold.',
    source_type: 'scheduled',
    state: 'running',
    scheduled_for: ts(0, 12),
    started_at: ts(0, 12, 1),
  },
  {
    task_id: 10,
    task_name: 'Monitor error rates',
    task_description:
      'Continuously poll error-tracking service and alert on-call if 5xx rate exceeds threshold.',
    source_type: 'scheduled',
    state: 'completed',
    scheduled_for: ts(1, 12),
    started_at: ts(1, 12, 1),
    completed_at: ts(1, 12, 8),
  },
  {
    task_id: 13,
    task_name: 'Migrate legacy user data',
    task_description:
      'ETL pipeline to transform and import 2.3M user records from the legacy MySQL database.',
    source_type: 'explicit',
    state: 'failed',
    started_at: ts(3, 14),
    completed_at: ts(3, 17),
  },
  {
    task_id: 13,
    task_name: 'Migrate legacy user data',
    task_description:
      'ETL pipeline to transform and import 2.3M user records from the legacy MySQL database.',
    source_type: 'explicit',
    state: 'failed',
    started_at: ts(4, 14),
    completed_at: ts(4, 16),
  },
  {
    task_id: 16,
    task_name: 'Respond to new WhatsApp messages',
    task_description: 'Listen for incoming WhatsApp messages and draft a contextual response.',
    source_type: 'triggered',
    source_medium: 'whatsapp',
    source_contact_display_name: 'Jordan Mitchell',
    state: 'completed',
    started_at: ts(1, 10, 15),
    completed_at: ts(1, 10, 16),
  },
  {
    task_id: 16,
    task_name: 'Respond to new WhatsApp messages',
    task_description: 'Listen for incoming WhatsApp messages and draft a contextual response.',
    source_type: 'triggered',
    source_medium: 'whatsapp',
    source_contact_display_name: 'David Kim',
    state: 'completed',
    started_at: ts(0, 14, 5),
    completed_at: ts(0, 14, 6),
  },
  {
    task_id: 17,
    task_name: 'Nightly database backup',
    task_description: 'Take a pg_dump snapshot of the production database and upload to S3.',
    source_type: 'scheduled',
    state: 'completed',
    scheduled_for: ts(1, 2),
    started_at: ts(1, 2, 1),
    completed_at: ts(1, 2, 18),
  },
  {
    task_id: 17,
    task_name: 'Nightly database backup',
    task_description: 'Take a pg_dump snapshot of the production database and upload to S3.',
    source_type: 'scheduled',
    state: 'completed',
    scheduled_for: ts(0, 2),
    started_at: ts(0, 2, 1),
    completed_at: ts(0, 2, 20),
  },
  {
    task_id: 18,
    task_name: 'Triage SMS support requests',
    task_description:
      'Classify and route inbound SMS support messages to the appropriate team queue.',
    source_type: 'triggered',
    source_medium: 'sms_message',
    source_contact_display_name: 'Priya Sharma',
    state: 'completed',
    started_at: ts(0, 11, 22),
    completed_at: ts(0, 11, 23),
  },
  {
    task_id: 15,
    task_name: 'Fix dashboard query performance',
    task_description: 'Optimize the slow analytics dashboard queries.',
    source_type: 'explicit',
    state: 'completed',
    started_at: ts(1, 14),
    completed_at: ts(0, 18),
  },
  {
    task_id: 1,
    task_name: 'Migrate password hashing',
    task_description: 'Switch from bcrypt to argon2id for all stored password hashes.',
    source_type: 'explicit',
    state: 'completed',
    started_at: ts(6, 10),
    completed_at: ts(5, 16),
  },
  {
    task_id: 19,
    task_name: 'Monthly cost report',
    task_description: 'Pull cloud infrastructure costs from AWS Cost Explorer.',
    source_type: 'scheduled',
    state: 'completed',
    scheduled_for: ts(30, 9),
    started_at: ts(30, 9, 2),
    completed_at: ts(30, 9, 14),
  },
];

// ---------------------------------------------------------------------------
// Data: Guidance
// ---------------------------------------------------------------------------

const GUIDANCE: Record<string, unknown>[] = [
  {
    title: 'Communication Style',
    content:
      'Be concise and professional. Use bullet points for lists. Avoid jargon when talking to non-technical stakeholders. Always include action items and deadlines in meeting summaries.',
    linked_images: ['https://example.com/assets/communication-guide.png'],
  },
  {
    title: 'Code Review Standards',
    content:
      'All PRs require at least one approval. Check for: security vulnerabilities, test coverage (>80%), documentation updates, breaking API changes. Provide constructive feedback with code suggestions.',
  },
  {
    title: 'Incident Response Protocol',
    content:
      'P0 incidents: Notify the on-call engineer immediately via PagerDuty. Post in incidents Slack channel. Begin incident write-up within 1 hour. Follow up with post-mortem within 48 hours. Never blame individuals.',
    linked_images: [
      'https://example.com/assets/incident-flowchart.png',
      'https://example.com/assets/escalation-matrix.png',
    ],
  },
  {
    title: 'Meeting Scheduling Rules',
    content:
      'Respect timezone differences — schedule overlap hours (9am-12pm EST). Keep meetings under 30 minutes when possible. Always share an agenda 24h in advance. Cancel if no agenda exists.',
  },
  {
    title: 'Data Handling Policy',
    content:
      'Never store PII in logs. Encrypt all data at rest and in transit. Use field-level encryption for sensitive data (SSN, payment info). Mask data in non-production environments. Report any data breach within 1 hour.',
  },
  {
    title: 'Customer Communication',
    content:
      'Respond to enterprise clients within 4 hours during business hours. Use the approved email templates for common requests. Escalate pricing discussions to the sales team. Never promise features without PM approval.',
  },
  {
    title: 'Sprint Planning Guidelines',
    content:
      'Sprint duration: 2 weeks. Target velocity: 30 story points per developer. Reserve 20% capacity for bugs and tech debt. All stories must have acceptance criteria. Demo to stakeholders at sprint end.',
  },
  {
    title: 'Deployment Process',
    content:
      'Deploy to staging first, wait 1 hour for smoke tests. Production deploys only on Mon-Thu before 3pm EST. No deploys on Fridays. Rollback plan required for every deploy. Feature flags for risky changes.',
    linked_images: ['https://example.com/assets/deploy-pipeline.png'],
  },
  {
    title: 'Documentation Standards',
    content:
      'All public APIs must have OpenAPI specs. Internal services need README with setup instructions, architecture diagram, and runbook. Update docs in the same PR as code changes.',
  },
  {
    title: 'Hiring Process',
    content:
      'Pipeline: Resume screen → Phone screen (30min) → Technical interview (1hr) → System design (1hr) → Culture fit (30min). Target: offer within 5 business days of final interview. Salary benchmarked against Levels.fyi 75th percentile.',
  },
];

// ---------------------------------------------------------------------------
// Data: Functions
// ---------------------------------------------------------------------------

const FUNCTIONS_COMPOSITIONAL: Record<string, unknown>[] = [
  {
    name: 'search_knowledge_base',
    language: 'python',
    argspec: '(query: str, top_k: int = 5, filters: dict | None = None) -> list[dict]',
    docstring:
      'Search the knowledge base using semantic similarity. Returns top_k most relevant entries with scores.',
    implementation:
      'def search_knowledge_base(query, top_k=5, filters=None):\n    embeddings = embed(query)\n    results = vector_store.search(embeddings, top_k=top_k)\n    if filters:\n        results = [r for r in results if all(r.get(k) == v for k, v in filters.items())]\n    return results',
  },
  {
    name: 'send_email_notification',
    language: 'python',
    argspec:
      '(to: str, subject: str, body: str, cc: list[str] | None = None, template_id: str | None = None) -> bool',
    docstring: 'Send an email notification via SendGrid. Supports HTML body and templates.',
    implementation:
      'def send_email_notification(to, subject, body, cc=None, template_id=None):\n    msg = Mail(from_email="noreply@example.com", to_emails=to, subject=subject)\n    if template_id:\n        msg.template_id = template_id\n    else:\n        msg.html_content = body\n    if cc:\n        msg.cc = [Cc(addr) for addr in cc]\n    return sg_client.send(msg).status_code == 202',
  },
  {
    name: 'create_jira_ticket',
    language: 'python',
    argspec:
      '(title: str, description: str, priority: str = "Medium", assignee: str | None = None, labels: list[str] | None = None) -> str',
    docstring:
      'Create a Jira ticket in the current project. Returns the ticket ID (e.g. "PROJ-123").',
    implementation:
      'def create_jira_ticket(title, description, priority="Medium", assignee=None, labels=None):\n    issue = jira.create_issue(\n        project="PROJ", summary=title, description=description,\n        issuetype={"name": "Task"}, priority={"name": priority}\n    )\n    if assignee: issue.update(assignee={"name": assignee})\n    if labels: issue.update(labels=labels)\n    return issue.key',
  },
  {
    name: 'query_analytics',
    language: 'python',
    argspec: '(metric: str, start_date: str, end_date: str, group_by: str = "day") -> list[dict]',
    docstring:
      'Query analytics data from BigQuery. Supports daily, weekly, and monthly aggregations.',
    implementation:
      'def query_analytics(metric, start_date, end_date, group_by="day"):\n    sql = f"""\n        SELECT DATE_TRUNC(timestamp, {group_by}) as period, {metric}\n        FROM analytics.events\n        WHERE timestamp BETWEEN @start AND @end\n        GROUP BY period ORDER BY period\n    """\n    return list(bq_client.query(sql, parameters=[start_date, end_date]))',
  },
  {
    name: 'schedule_meeting',
    language: 'python',
    argspec:
      '(title: str, attendees: list[str], duration_minutes: int = 30, preferred_time: str | None = None) -> dict',
    docstring:
      "Schedule a Google Calendar meeting. Finds the next available slot respecting all attendees' timezone preferences.",
    implementation:
      'def schedule_meeting(title, attendees, duration_minutes=30, preferred_time=None):\n    slots = calendar.find_available_slots(attendees, duration_minutes)\n    if preferred_time:\n        slots.sort(key=lambda s: abs(parse(s.start) - parse(preferred_time)))\n    chosen = slots[0]\n    event = calendar.create_event(title=title, start=chosen.start, end=chosen.end, attendees=attendees)\n    return {"event_id": event.id, "start": chosen.start, "link": event.hangout_link}',
  },
  {
    name: 'summarize_document',
    language: 'python',
    argspec: '(content: str, max_length: int = 500, style: str = "executive") -> str',
    docstring:
      'Summarize a document using LLM. Styles: executive (bullet points), technical (detailed), casual (conversational).',
    implementation:
      'def summarize_document(content, max_length=500, style="executive"):\n    prompt = f"Summarize in {style} style, max {max_length} chars:\\n\\n{content}"\n    return llm.complete(prompt, max_tokens=max_length)',
  },
];

const FUNCTIONS_PRIMITIVES: Record<string, unknown>[] = [
  {
    name: 'get_current_time',
    language: 'python',
    argspec: '(timezone: str = "UTC") -> str',
    docstring: 'Returns the current date and time in the specified timezone as an ISO 8601 string.',
    implementation: '__builtin__',
  },
  {
    name: 'http_request',
    language: 'python',
    argspec:
      '(url: str, method: str = "GET", headers: dict | None = None, body: str | None = None, timeout: int = 30) -> dict',
    docstring: 'Make an HTTP request to an external URL. Returns status code, headers, and body.',
    implementation: '__builtin__',
  },
  {
    name: 'read_file',
    language: 'python',
    argspec: '(path: str, encoding: str = "utf-8") -> str',
    docstring: "Read the contents of a file from the assistant's workspace.",
    implementation: '__builtin__',
  },
  {
    name: 'write_file',
    language: 'python',
    argspec: '(path: str, content: str, encoding: str = "utf-8") -> bool',
    docstring:
      "Write content to a file in the assistant's workspace. Creates parent directories if needed.",
    implementation: '__builtin__',
  },
];

const FUNCTIONS_VIRTUAL_ENVS: Record<string, unknown>[] = [
  {
    name: 'default',
    pyproject_content:
      '[project]\nname = "default"\nversion = "1.0.0"\n\n[project.dependencies]\nrequests = ">=2.31"\npython-dateutil = ">=2.8"\n',
    custom_hash: 'a1b2c3d4e5f6',
  },
  {
    name: 'analytics',
    pyproject_content:
      '[project]\nname = "analytics"\nversion = "1.0.0"\n\n[project.dependencies]\npandas = ">=2.1"\nnumpy = ">=1.25"\ngoogle-cloud-bigquery = ">=3.12"\n',
    custom_hash: 'f6e5d4c3b2a1',
  },
];

const FUNCTIONS_META: Record<string, unknown>[] = [
  {
    primitives_hash: 'sha256:abc123def456',
    custom_venvs_hash: 'sha256:789ghi012jkl',
    custom_functions_hash: 'sha256:mno345pqr678',
    last_synced_at: ts(0, 8),
  },
];

/* eslint-enable @typescript-eslint/naming-convention */

// ---------------------------------------------------------------------------
// Scenario
// ---------------------------------------------------------------------------

export async function seedMemoryRich(): Promise<SeededState> {
  const owner = createUser({ name: 'Memory', lastName: 'Explorer', credits: 50_000 });
  createEmailLogin({ userId: owner.id });

  const assistant = createAssistant({
    userId: owner.id,
    firstName: 'Aria',
    surname: 'Chen',
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

  // Seed all memory contexts in parallel where possible
  await Promise.all([
    seedLogs(apiKey, owner.id, agentId, 'Contacts', CONTACTS),
    seedLogs(apiKey, owner.id, agentId, 'Tasks', TASKS),
    seedLogs(apiKey, owner.id, agentId, 'Tasks/Runs', TASK_RUNS),
    seedLogs(apiKey, owner.id, agentId, 'Guidance', GUIDANCE),
    seedLogs(apiKey, owner.id, agentId, 'Knowledge/Products', KNOWLEDGE_PRODUCTS),
    seedLogs(apiKey, owner.id, agentId, 'Knowledge/FAQ', KNOWLEDGE_FAQ),
    seedLogs(apiKey, owner.id, agentId, 'Functions/Compositional', FUNCTIONS_COMPOSITIONAL),
    seedLogs(apiKey, owner.id, agentId, 'Functions/Primitives', FUNCTIONS_PRIMITIVES),
    seedLogs(apiKey, owner.id, agentId, 'Functions/VirtualEnvs', FUNCTIONS_VIRTUAL_ENVS),
    seedLogs(apiKey, owner.id, agentId, 'Functions/Meta', FUNCTIONS_META),
  ]);

  // Transcripts are seeded sequentially to maintain message ordering
  const transcripts = buildTranscripts();
  const BATCH_SIZE = 30;
  for (let i = 0; i < transcripts.length; i += BATCH_SIZE) {
    await seedLogs(apiKey, owner.id, agentId, 'Transcripts', transcripts.slice(i, i + BATCH_SIZE));
  }

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
