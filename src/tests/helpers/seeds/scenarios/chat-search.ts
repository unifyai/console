/**
 * Seed Scenario: Chat Search
 *
 * Creates a user + assistant with rich conversation history for visually
 * testing the chat search, pagination, and "Go to Message" features.
 *
 * **What it creates:**
 *   - 1 user ("owner")
 *   - 1 personal assistant ("Luna Marquez")
 *   - ~250 chat messages spanning 14 days
 *   - 3 Unify Meet call sessions (with exchange IDs)
 *   - Messages with simulated attachments (PDF, image, code)
 *
 * **Credentials:**
 *   - `owner` — full access
 */

import type { SeededState } from '../types';
import {
  createUser,
  createAssistant,
  createEmailLogin,
  seedChatInfrastructure,
  orchestraFetch,
} from '../client';

const CONTACT_ID = 1;
let messageCounter = 10_000;

interface TranscriptEntry {
  senderId: number;
  content: string;
  timestamp: string;
  medium?: string;
  exchangeId?: number;
  attachments?: Record<string, unknown>[];
}

async function seedTranscriptBatch(
  apiKey: string,
  userId: string,
  assistantId: number,
  batch: TranscriptEntry[]
) {
  /* eslint-disable @typescript-eslint/naming-convention */
  const allEntries = batch.map((opts) => {
    const msgId = messageCounter++;
    const entries: Record<string, unknown> = {
      medium: opts.medium ?? 'unify_message',
      sender_id: opts.senderId,
      receiver_ids: opts.senderId === 0 ? [CONTACT_ID] : [0],
      content: opts.content,
      message_id: msgId,
      timestamp: opts.timestamp,
    };
    if (opts.exchangeId !== undefined) entries.exchange_id = opts.exchangeId;
    if (opts.attachments) entries.attachments = opts.attachments;
    return entries;
  });
  /* eslint-enable @typescript-eslint/naming-convention */

  const res = await orchestraFetch(
    '/v0/logs',
    {
      method: 'POST',
      body: JSON.stringify({
        project_name: 'Assistants',
        context: `${userId}/${assistantId}/Transcripts`,
        entries: allEntries,
      }),
    },
    apiKey
  );
  if (!res.ok)
    throw new Error(`Failed to seed transcript batch: ${res.status} ${await res.text()}`);
}

function ts(daysAgo: number, hourOffset: number, minuteOffset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(9 + hourOffset, minuteOffset, 0, 0);
  return d.toISOString();
}

const TOPICS = [
  {
    q: "What's the best database for our analytics pipeline?",
    a: "For analytics workloads, I'd recommend PostgreSQL with TimescaleDB extension. It handles time-series data well, supports complex aggregations, and scales horizontally. If volume grows past 10TB, we could consider ClickHouse.",
  },
  {
    q: 'How should we handle error logging in production?',
    a: 'I recommend a structured logging approach: use Winston or Pino for Node.js, emit JSON logs with correlation IDs, and ship them to a centralized system like Datadog or ELK stack. Always include request ID, user context, and stack traces.',
  },
  {
    q: "What's your take on microservices vs monolith for our scale?",
    a: 'At our current scale (5-10 developers, <100k users), a modular monolith is the sweet spot. We get clean separation of concerns without the operational complexity of distributed systems. We can extract services later when specific modules need independent scaling.',
  },
  {
    q: 'Can you draft a data retention policy?',
    a: "Here's a draft policy:\n- Active user data: retained indefinitely\n- Inactive accounts (>2 years): anonymized\n- Server logs: 90 days hot, 1 year cold storage\n- Analytics events: 2 years\n- Backups: 30-day rolling window\n\nWant me to add GDPR-specific clauses?",
  },
  {
    q: 'How should we implement feature flags?',
    a: "I'd suggest using LaunchDarkly or a self-hosted solution like Unleash. Key patterns:\n1. Boolean flags for kill switches\n2. Percentage rollouts for gradual releases\n3. User-segment targeting for beta features\n4. Multivariate flags for A/B tests\n\nKeep flag lifecycle short — clean up after full rollout.",
  },
  {
    q: 'What CI/CD pipeline do you recommend?',
    a: 'For our GitHub-based workflow, GitHub Actions is the natural choice. Pipeline stages:\n1. Lint + type check (2 min)\n2. Unit tests in parallel (3 min)\n3. Build + integration tests (5 min)\n4. Deploy to staging (auto)\n5. Deploy to production (manual approval)\n\nTotal: ~10 min to staging.',
  },
  {
    q: 'How do we handle API versioning?',
    a: 'URL-based versioning (e.g., /v1/users) is the most pragmatic approach. Rules:\n- Breaking changes = new version\n- Additive changes = same version\n- Support N-1 versions minimum\n- Sunset with 6-month deprecation notice\n- Use API gateway for routing between versions.',
  },
  {
    q: "What's the best way to handle file uploads?",
    a: 'Use pre-signed URLs with cloud storage (GCS or S3). Flow:\n1. Client requests upload URL from our API\n2. API generates pre-signed PUT URL (expires in 15 min)\n3. Client uploads directly to cloud storage\n4. Client confirms upload, API validates and processes\n\nThis keeps large files off our servers.',
  },
  {
    q: 'Should we use GraphQL or REST for the new API?',
    a: "For our use case, REST is the better choice. Reasons:\n- Simpler caching with HTTP semantics\n- Easier to secure (per-endpoint auth)\n- Better tooling for our team's experience\n- Our data model is resource-oriented, not graph-like\n\nGraphQL shines with complex nested queries, which we don't need.",
  },
  {
    q: 'How should we approach internationalization?',
    a: 'Use react-intl or next-intl for the frontend. Architecture:\n1. Extract all strings to JSON message files\n2. Use ICU message format for plurals/gender\n3. Store user locale preference in profile\n4. Lazy-load locale bundles\n5. RTL support via CSS logical properties\n\nStart with English + Spanish, add more based on user demographics.',
  },
  {
    q: "What's the security checklist for our launch?",
    a: 'Critical items before launch:\n1. HTTPS everywhere (HSTS headers)\n2. SQL injection protection (parameterized queries)\n3. XSS prevention (CSP headers, output encoding)\n4. CSRF tokens on all state-changing endpoints\n5. Rate limiting on auth endpoints\n6. Dependency audit (npm audit)\n7. Secrets rotation plan\n8. Penetration test report',
  },
  {
    q: 'How do we set up monitoring and alerting?',
    a: 'Three pillars approach:\n- Metrics: Prometheus + Grafana for system/app metrics\n- Logs: structured JSON → ELK or Loki\n- Traces: OpenTelemetry → Jaeger\n\nKey alerts:\n- Error rate > 1%\n- P99 latency > 2s\n- CPU > 80% for 5 min\n- Disk > 90%\n- Failed deployments',
  },
  {
    q: 'What testing strategy should we follow?',
    a: 'Testing pyramid:\n- Unit tests: 70% (fast, isolated, mock dependencies)\n- Integration tests: 20% (real DB, API contracts)\n- E2E tests: 10% (critical user flows only)\n\nTools: Jest for unit/integration, Playwright for E2E. Target 80% code coverage but focus on business logic, not getters/setters.',
  },
  {
    q: 'How should we handle database migrations?',
    a: 'Use a migration tool like Prisma Migrate or Knex migrations. Rules:\n1. Every schema change = versioned migration file\n2. Migrations must be idempotent\n3. No destructive changes in production without a multi-step process\n4. Test migrations against a production-size dataset\n5. Always have a rollback plan',
  },
  {
    q: "What's the best caching strategy for our app?",
    a: 'Multi-layer caching:\n1. Browser cache: static assets with content hashing (1 year TTL)\n2. CDN: public pages, API responses with Vary headers\n3. Application cache: Redis for session data, computed results (5-15 min TTL)\n4. Database cache: materialized views for dashboards\n\nInvalidation: event-driven for critical data, TTL-based for everything else.',
  },
];

const DAILY_CHATS: { q: string; a: string }[] = [
  {
    q: "Good morning! What's on the agenda today?",
    a: "Good morning! Today's priorities:\n1. Complete the auth module integration tests\n2. Review PR 142 (dashboard refactor)\n3. Update the project timeline document\n4. Standup at 2pm",
  },
  {
    q: 'Can you check if the staging deployment went through?',
    a: 'Yes, staging deployment completed successfully at 3:42 AM. All health checks passed. The new auth flow is live on staging — you can test it at staging.app.example.com.',
  },
  {
    q: 'The client asked about our uptime guarantees. What should I tell them?',
    a: 'Based on our infrastructure setup, we can commit to 99.9% uptime (43 min downtime/month). With our current redundancy setup across 2 availability zones, our actual uptime over the past 6 months has been 99.97%.',
  },
  {
    q: 'I need to prepare a budget estimate for Q4. What are our main infrastructure costs?',
    a: 'Current monthly infrastructure costs:\n- Cloud compute (GCP): $2,400\n- Database (Cloud SQL): $800\n- CDN + storage: $350\n- Monitoring (Datadog): $200\n- CI/CD: $150\n- Total: ~$3,900/month\n\nQ4 projection with planned scaling: ~$5,200/month.',
  },
  {
    q: 'Did you finish the API documentation?',
    a: "Yes, the OpenAPI spec is complete. I've documented all 47 endpoints across 8 resource groups. Each endpoint has request/response examples, error codes, and rate limit info. You can view it at /docs on the staging server.",
  },
  {
    q: "How's the bug backlog looking?",
    a: 'Current bug backlog:\n- Critical: 0\n- High: 2 (both assigned, ETA tomorrow)\n- Medium: 7 (3 in progress)\n- Low: 12 (scheduled for next sprint)\n\nThe two high-priority bugs are the payment webhook timeout and the CSV export encoding issue.',
  },
  {
    q: 'Can you set up a dev environment for the new contractor?',
    a: "I'll set up the environment. Checklist:\n1. Create GitHub account invite\n2. Add to relevant Slack channels\n3. Provision cloud dev environment\n4. Share onboarding documentation\n5. Schedule knowledge transfer session\n\nI'll have everything ready by end of day.",
  },
  {
    q: "What's the status of the mobile app?",
    a: 'Mobile app status:\n- iOS: React Native build compiling, basic navigation done\n- Android: Same codebase, tested on Pixel 7\n- Auth flow: integrated with our JWT system\n- Remaining: push notifications, offline mode, camera integration\n- ETA for beta: 3 weeks',
  },
];

export async function seedChatSearch(): Promise<SeededState> {
  const owner = createUser({ name: 'Search', lastName: 'Tester' });
  createEmailLogin({ userId: owner.id });

  const assistant = createAssistant({
    userId: owner.id,
    firstName: 'Luna',
    surname: 'Marquez',
  });

  await seedChatInfrastructure({
    apiKey: owner.apiKey,
    userId: owner.id,
    assistantId: assistant.agentId,
    email: owner.email,
  });

  // -----------------------------------------------------------------
  // Day 14 ago — onboarding
  // -----------------------------------------------------------------
  await seedTranscriptBatch(owner.apiKey, owner.id, assistant.agentId, [
    {
      senderId: CONTACT_ID,
      content: 'Hi Luna, nice to meet you! I just hired you as my assistant.',
      timestamp: ts(14, 0),
    },
    {
      senderId: 0,
      content:
        "Hello! Thank you for hiring me. I'm Luna Marquez, your new assistant. How can I help you today?",
      timestamp: ts(14, 0, 2),
    },
    {
      senderId: CONTACT_ID,
      content:
        'Can you help me organize my project files? I have a lot of documents to sort through.',
      timestamp: ts(14, 0, 5),
    },
    {
      senderId: 0,
      content:
        "Of course! I'd be happy to help organize your project files. Could you tell me more about the types of documents and how you'd like them categorized?",
      timestamp: ts(14, 0, 7),
    },
    {
      senderId: CONTACT_ID,
      content:
        'I have PDFs of contracts, some spreadsheets with financial data, and code files for the web app.',
      timestamp: ts(14, 1),
    },
    {
      senderId: 0,
      content:
        'Got it. I suggest creating three main folders: "Contracts", "Financial", and "Engineering". I can set up sub-folders within each for better organization. Want me to draft a folder structure?',
      timestamp: ts(14, 1, 3),
    },
    {
      senderId: CONTACT_ID,
      content:
        'Yes, draft the structure. Also, what tools do you recommend for project management?',
      timestamp: ts(14, 2),
    },
    {
      senderId: 0,
      content:
        "For project management, I recommend Linear for engineering tasks — it's fast and integrates well with GitHub. For broader team coordination, Notion works great as a knowledge base. I'll set up templates for both.",
      timestamp: ts(14, 2, 4),
    },
  ]);

  // -----------------------------------------------------------------
  // Day 13 ago — setup & initial planning
  // -----------------------------------------------------------------
  await seedTranscriptBatch(owner.apiKey, owner.id, assistant.agentId, [
    {
      senderId: CONTACT_ID,
      content: 'Luna, I need you to review the current tech stack and suggest improvements.',
      timestamp: ts(13, 0),
    },
    {
      senderId: 0,
      content:
        "I've audited the current stack. Summary:\n- Frontend: React 18 + Next.js 14 (good)\n- Backend: Express.js (consider migrating to Fastify for performance)\n- Database: PostgreSQL 15 (solid choice)\n- Cache: No caching layer (needs Redis)\n- Hosting: Heroku (consider GCP or AWS for more control)\n\nTop priorities: add Redis caching and upgrade hosting.",
      timestamp: ts(13, 0, 5),
    },
    {
      senderId: CONTACT_ID,
      content: "Great analysis. Let's plan the Redis integration first.",
      timestamp: ts(13, 1),
    },
    {
      senderId: 0,
      content:
        'Redis integration plan:\n\nPhase 1 (Week 1): Session storage migration\n- Replace in-memory sessions with Redis\n- Add connection pooling\n\nPhase 2 (Week 2): API response caching\n- Cache frequently accessed endpoints\n- Implement cache invalidation on writes\n\nPhase 3 (Week 3): Rate limiting\n- Per-user rate limiting via Redis\n- Sliding window algorithm\n\nShall I create tickets for this?',
      timestamp: ts(13, 1, 8),
    },
    ...Array.from({ length: 6 }, (_, i) => ({
      senderId: i % 2 === 0 ? CONTACT_ID : 0,
      content:
        i % 2 === 0
          ? `Follow-up question ${i / 2 + 1}: what about ${['connection pooling limits', 'Redis cluster vs standalone', 'cache key naming conventions'][Math.floor(i / 2)]}?`
          : `For ${['connection pooling, start with 10 connections per worker and monitor. Our expected QPS of ~500 should be comfortable with a pool of 20', 'standalone Redis is fine until we exceed 25GB of cached data or need geographic distribution. Cluster adds operational complexity', 'use a prefix:resource:id pattern like "cache:user:123" or "session:abc". Include a version prefix for easy invalidation'][Math.floor(i / 2)]}.`,
      timestamp: ts(13, 2 + i),
    })),
  ]);

  // -----------------------------------------------------------------
  // Day 12 ago — file sharing with attachments
  // -----------------------------------------------------------------
  await seedTranscriptBatch(owner.apiKey, owner.id, assistant.agentId, [
    {
      senderId: CONTACT_ID,
      content: "Here's the Q3 financial report for review.",
      timestamp: ts(12, 0),
      attachments: [
        {
          id: 'att-1',
          filename: 'Q3_Financial_Report.pdf',
          contentType: 'application/pdf',
          sizeBytes: 245000,
        },
      ],
    },
    {
      senderId: 0,
      content:
        "Thank you! I've reviewed the Q3 Financial Report. Revenue is up 12% compared to Q2. I noticed some discrepancies in the expense categories on page 7 — would you like me to flag those for the accounting team?",
      timestamp: ts(12, 0, 15),
    },
    {
      senderId: CONTACT_ID,
      content: 'Yes please, flag those discrepancies. Also here is the project screenshot.',
      timestamp: ts(12, 1),
      attachments: [
        {
          id: 'att-2',
          filename: 'dashboard_screenshot.png',
          contentType: 'image/png',
          sizeBytes: 890000,
        },
      ],
    },
    {
      senderId: 0,
      content:
        "The dashboard looks great! I see the user analytics section is coming along nicely. I'll flag the financial discrepancies and prepare a summary email for the accounting team.",
      timestamp: ts(12, 1, 10),
    },
    {
      senderId: CONTACT_ID,
      content: 'Here are the raw data exports too.',
      timestamp: ts(12, 2),
      attachments: [
        {
          id: 'att-2b',
          filename: 'revenue_data.xlsx',
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          sizeBytes: 134000,
        },
        { id: 'att-2c', filename: 'user_metrics.csv', contentType: 'text/csv', sizeBytes: 56000 },
      ],
    },
    {
      senderId: 0,
      content:
        "Perfect, I've loaded both files. The revenue data confirms the 12% growth. User metrics show a 23% increase in DAU and a 15% improvement in retention. These are strong numbers for the investor update.",
      timestamp: ts(12, 2, 8),
    },
  ]);

  // -----------------------------------------------------------------
  // Day 11 ago — first call (Unify Meet)
  // -----------------------------------------------------------------
  const exchangeA = 1001;
  await seedTranscriptBatch(owner.apiKey, owner.id, assistant.agentId, [
    {
      senderId: CONTACT_ID,
      content: 'Hey Luna, can we discuss the project timeline?',
      timestamp: ts(11, 0),
      medium: 'unify_meet',
      exchangeId: exchangeA,
    },
    {
      senderId: 0,
      content:
        'Sure! Based on the current progress, I think we can have the MVP ready by end of month. The frontend is about 80% complete.',
      timestamp: ts(11, 0, 3),
      medium: 'unify_meet',
      exchangeId: exchangeA,
    },
    {
      senderId: CONTACT_ID,
      content: 'That sounds good. What about the API integration?',
      timestamp: ts(11, 0, 6),
      medium: 'unify_meet',
      exchangeId: exchangeA,
    },
    {
      senderId: 0,
      content:
        'The API integration is the main blocker. We need the authentication endpoints finalized first. I estimate 3-4 days once we have those.',
      timestamp: ts(11, 0, 9),
      medium: 'unify_meet',
      exchangeId: exchangeA,
    },
    {
      senderId: CONTACT_ID,
      content: 'And the third-party integrations?',
      timestamp: ts(11, 0, 12),
      medium: 'unify_meet',
      exchangeId: exchangeA,
    },
    {
      senderId: 0,
      content:
        'Stripe integration is done. We still need to set up the email provider (SendGrid) and the analytics SDK. Both have good documentation, I estimate 2 days total.',
      timestamp: ts(11, 0, 15),
      medium: 'unify_meet',
      exchangeId: exchangeA,
    },
  ]);
  await seedTranscriptBatch(owner.apiKey, owner.id, assistant.agentId, [
    {
      senderId: CONTACT_ID,
      content: 'Good call! Can you send me the meeting notes?',
      timestamp: ts(11, 1),
    },
    {
      senderId: 0,
      content:
        'Here are the meeting notes from our project timeline discussion:\n\n1. MVP target: end of month\n2. Frontend: ~80% complete\n3. API integration: blocked on auth endpoints (3-4 days estimate)\n4. Stripe: done, SendGrid + analytics: 2 days\n5. Action items: Finalize auth API spec by Friday',
      timestamp: ts(11, 1, 5),
    },
  ]);

  // -----------------------------------------------------------------
  // Days 10–9 ago — technical deep dives (bulk)
  // -----------------------------------------------------------------
  for (let day = 10; day >= 9; day--) {
    const dayTopics = TOPICS.slice((10 - day) * 5, (10 - day) * 5 + 5);
    const batch: TranscriptEntry[] = [];
    dayTopics.forEach((topic, i) => {
      batch.push({ senderId: CONTACT_ID, content: topic.q, timestamp: ts(day, i * 2) });
      batch.push({ senderId: 0, content: topic.a, timestamp: ts(day, i * 2, 10) });
    });
    await seedTranscriptBatch(owner.apiKey, owner.id, assistant.agentId, batch);
  }

  // -----------------------------------------------------------------
  // Day 8 ago — code review with attachments
  // -----------------------------------------------------------------
  await seedTranscriptBatch(owner.apiKey, owner.id, assistant.agentId, [
    {
      senderId: CONTACT_ID,
      content: 'Can you review this code? I refactored the authentication module.',
      timestamp: ts(8, 0),
      attachments: [
        {
          id: 'att-3',
          filename: 'auth-service.ts',
          contentType: 'text/typescript',
          sizeBytes: 12400,
        },
      ],
    },
    {
      senderId: 0,
      content:
        "I've reviewed the auth-service.ts file. The refactoring looks solid! A few suggestions:\n\n1. Consider using a token refresh strategy with exponential backoff\n2. The password hashing should use bcrypt with at least 12 rounds\n3. Add rate limiting to the login endpoint\n\nOverall, the code quality is much better than the previous version.",
      timestamp: ts(8, 0, 20),
    },
    {
      senderId: CONTACT_ID,
      content:
        "Great feedback! I'll implement those changes. What do you think about using JWT vs session tokens?",
      timestamp: ts(8, 1),
    },
    {
      senderId: 0,
      content:
        "For your use case, I'd recommend JWT with short expiry (15 min access tokens) combined with refresh tokens stored in HTTP-only cookies. This gives you stateless auth for API calls while maintaining security. Session tokens would work too but add database overhead for token lookups.",
      timestamp: ts(8, 1, 12),
    },
    {
      senderId: CONTACT_ID,
      content: "Here's the updated middleware after your suggestions.",
      timestamp: ts(8, 2),
      attachments: [
        {
          id: 'att-3b',
          filename: 'auth-middleware.ts',
          contentType: 'text/typescript',
          sizeBytes: 8200,
        },
      ],
    },
    {
      senderId: 0,
      content:
        'Much better! The middleware now properly validates JWT signatures, checks token expiry, and handles refresh token rotation. One minor thing: add a try-catch around the jwt.verify call to return a proper 401 instead of a 500 on malformed tokens.',
      timestamp: ts(8, 2, 15),
    },
  ]);

  // -----------------------------------------------------------------
  // Days 7–6 ago — more technical discussions (bulk)
  // -----------------------------------------------------------------
  for (let day = 7; day >= 6; day--) {
    const dayTopics = TOPICS.slice((7 - day + 2) * 5, (7 - day + 2) * 5 + 5);
    const batch: TranscriptEntry[] = [];
    dayTopics.forEach((topic, i) => {
      batch.push({ senderId: CONTACT_ID, content: topic.q, timestamp: ts(day, i * 2) });
      batch.push({ senderId: 0, content: topic.a, timestamp: ts(day, i * 2, 10) });
    });
    if (batch.length > 0) {
      await seedTranscriptBatch(owner.apiKey, owner.id, assistant.agentId, batch);
    }
  }

  // -----------------------------------------------------------------
  // Day 5 ago — second call + follow-up
  // -----------------------------------------------------------------
  const exchangeB = 1002;
  await seedTranscriptBatch(owner.apiKey, owner.id, assistant.agentId, [
    {
      senderId: CONTACT_ID,
      content: "Luna, let's do a quick standup call.",
      timestamp: ts(5, 0),
      medium: 'unify_meet',
      exchangeId: exchangeB,
    },
    {
      senderId: 0,
      content:
        "Good morning! Yesterday I completed the API spec documentation and started on the integration tests. Today I'll focus on the authentication flow.",
      timestamp: ts(5, 0, 3),
      medium: 'unify_meet',
      exchangeId: exchangeB,
    },
    {
      senderId: CONTACT_ID,
      content: 'Perfect. Any blockers?',
      timestamp: ts(5, 0, 5),
      medium: 'unify_meet',
      exchangeId: exchangeB,
    },
    {
      senderId: 0,
      content:
        'No blockers currently. The only risk is the third-party OAuth provider — their sandbox has been intermittently slow. I have a fallback plan using mock responses for development.',
      timestamp: ts(5, 0, 8),
      medium: 'unify_meet',
      exchangeId: exchangeB,
    },
  ]);
  await seedTranscriptBatch(owner.apiKey, owner.id, assistant.agentId, [
    {
      senderId: CONTACT_ID,
      content: "Thanks for the update. Here's the updated requirements doc.",
      timestamp: ts(5, 1),
      attachments: [
        {
          id: 'att-4',
          filename: 'requirements_v2.pdf',
          contentType: 'application/pdf',
          sizeBytes: 156000,
        },
      ],
    },
    {
      senderId: 0,
      content:
        "I've reviewed the updated requirements. Looks like there are 3 new user stories added. I'll update the sprint backlog accordingly. Estimated effort: 8 story points total.",
      timestamp: ts(5, 1, 10),
    },
  ]);

  // -----------------------------------------------------------------
  // Days 4–3 ago — daily operational chats (bulk, ~40 messages)
  // -----------------------------------------------------------------
  for (let day = 4; day >= 3; day--) {
    const batch: TranscriptEntry[] = [];
    const chats = DAILY_CHATS.slice((4 - day) * 4, (4 - day) * 4 + 4);
    chats.forEach((chat, i) => {
      batch.push({ senderId: CONTACT_ID, content: chat.q, timestamp: ts(day, i * 2) });
      batch.push({ senderId: 0, content: chat.a, timestamp: ts(day, i * 2, 8) });
    });
    // Fill rest with varied filler
    for (let i = chats.length; i < 10; i++) {
      const topic = TOPICS[((4 - day) * 10 + i) % TOPICS.length];
      batch.push({
        senderId: CONTACT_ID,
        content: topic.q,
        timestamp: ts(day, chats.length * 2 + (i - chats.length)),
      });
      batch.push({
        senderId: 0,
        content: topic.a,
        timestamp: ts(day, chats.length * 2 + (i - chats.length), 10),
      });
    }
    await seedTranscriptBatch(owner.apiKey, owner.id, assistant.agentId, batch);
  }

  // -----------------------------------------------------------------
  // Day 2 ago — third call + sprint planning
  // -----------------------------------------------------------------
  const exchangeC = 1003;
  await seedTranscriptBatch(owner.apiKey, owner.id, assistant.agentId, [
    {
      senderId: CONTACT_ID,
      content: "Let's do a sprint planning call, Luna.",
      timestamp: ts(2, 0),
      medium: 'unify_meet',
      exchangeId: exchangeC,
    },
    {
      senderId: 0,
      content:
        "Ready! I've prepared the backlog. We have 42 story points of work and 3 developers available. I suggest targeting 30 points with a 20% buffer.",
      timestamp: ts(2, 0, 3),
      medium: 'unify_meet',
      exchangeId: exchangeC,
    },
    {
      senderId: CONTACT_ID,
      content: 'What are the highest priority items?',
      timestamp: ts(2, 0, 5),
      medium: 'unify_meet',
      exchangeId: exchangeC,
    },
    {
      senderId: 0,
      content:
        "Top priorities:\n1. Payment webhook reliability (8 pts)\n2. Dashboard performance fix (5 pts)\n3. User onboarding flow (8 pts)\n4. API rate limiting (3 pts)\n5. Email notification templates (5 pts)\n\nThat's 29 points, fits within our target.",
      timestamp: ts(2, 0, 8),
      medium: 'unify_meet',
      exchangeId: exchangeC,
    },
    {
      senderId: CONTACT_ID,
      content: "Sounds good. Let's go with that plan.",
      timestamp: ts(2, 0, 10),
      medium: 'unify_meet',
      exchangeId: exchangeC,
    },
    {
      senderId: 0,
      content:
        "Great, I'll create all the tickets now and assign them based on expertise. Sprint starts tomorrow.",
      timestamp: ts(2, 0, 12),
      medium: 'unify_meet',
      exchangeId: exchangeC,
    },
  ]);
  await seedTranscriptBatch(owner.apiKey, owner.id, assistant.agentId, [
    {
      senderId: CONTACT_ID,
      content: "Here's the sprint planning template I want us to use going forward.",
      timestamp: ts(2, 1),
      attachments: [
        {
          id: 'att-5',
          filename: 'sprint_template.pdf',
          contentType: 'application/pdf',
          sizeBytes: 89000,
        },
      ],
    },
    {
      senderId: 0,
      content:
        "Thanks! I've integrated the template into our Notion workspace. Each sprint will now have a standardized page with velocity tracking, burndown chart, and retrospective notes.",
      timestamp: ts(2, 1, 10),
    },
    {
      senderId: CONTACT_ID,
      content: 'Perfect. Also, can you prepare the investor update slides?',
      timestamp: ts(2, 2),
    },
    {
      senderId: 0,
      content:
        "I'll draft the investor update with these sections:\n1. Product milestones (MVP progress, user growth)\n2. Engineering velocity (sprint completion rates)\n3. Financial summary (MRR, burn rate, runway)\n4. Hiring plan (current team + Q1 targets)\n\nShould have a draft ready by tomorrow morning.",
      timestamp: ts(2, 2, 15),
    },
  ]);

  // -----------------------------------------------------------------
  // Day 1 ago — busy day with many messages
  // -----------------------------------------------------------------
  const day1Batch: TranscriptEntry[] = [];
  for (let i = 0; i < 12; i++) {
    const chat = DAILY_CHATS[i % DAILY_CHATS.length];
    day1Batch.push({
      senderId: CONTACT_ID,
      content:
        i < DAILY_CHATS.length
          ? chat.q
          : `Quick question #${i + 1}: ${TOPICS[i % TOPICS.length].q}`,
      timestamp: ts(1, Math.floor(i / 2), (i % 2) * 30),
    });
    day1Batch.push({
      senderId: 0,
      content: i < DAILY_CHATS.length ? chat.a : TOPICS[i % TOPICS.length].a,
      timestamp: ts(1, Math.floor(i / 2), (i % 2) * 30 + 5),
    });
  }
  await seedTranscriptBatch(owner.apiKey, owner.id, assistant.agentId, day1Batch);

  // -----------------------------------------------------------------
  // Today — recent messages
  // -----------------------------------------------------------------
  await seedTranscriptBatch(owner.apiKey, owner.id, assistant.agentId, [
    {
      senderId: CONTACT_ID,
      content: "Good morning Luna! How's the authentication module coming along?",
      timestamp: ts(0, 0),
    },
    {
      senderId: 0,
      content:
        "Good morning! The authentication module is nearly complete. I've implemented JWT tokens with refresh flow, bcrypt hashing with 12 rounds, and rate limiting. Currently writing the integration tests. Should be ready for review by this afternoon.",
      timestamp: ts(0, 0, 3),
    },
    {
      senderId: CONTACT_ID,
      content:
        'Awesome! Can you also look into the performance issue with the dashboard? Users reported slow loading times.',
      timestamp: ts(0, 1),
    },
    {
      senderId: 0,
      content:
        "I'll investigate the dashboard performance after finishing the auth tests. Initial guess: it might be the analytics queries — we're fetching all-time data without pagination. I'll profile it and share findings.",
      timestamp: ts(0, 1, 8),
    },
    {
      senderId: CONTACT_ID,
      content:
        'That makes sense. Let me know what you find. Also, the client wants a demo by Friday.',
      timestamp: ts(0, 2),
    },
    {
      senderId: 0,
      content:
        "Noted — Friday demo. I'll prioritize the visible features and make sure the auth flow and dashboard are polished. We can use mock data for any incomplete API endpoints during the demo.",
      timestamp: ts(0, 2, 5),
    },
    {
      senderId: CONTACT_ID,
      content:
        'One more thing — can you check the latest deployment logs? Some users are reporting 502 errors.',
      timestamp: ts(0, 3),
    },
    {
      senderId: 0,
      content:
        "Checking now... Found it. The 502s are coming from the /api/analytics endpoint. The query is timing out because it's scanning the entire events table without an index on the timestamp column. I'll add the index and deploy a fix within the hour.",
      timestamp: ts(0, 3, 4),
    },
    {
      senderId: CONTACT_ID,
      content: 'Great, thanks for the quick turnaround on that.',
      timestamp: ts(0, 4),
    },
    {
      senderId: 0,
      content:
        "No problem! Index has been added and deployed. The /api/analytics endpoint now responds in ~200ms instead of 8+ seconds. I'll monitor for the next hour to make sure it's stable.",
      timestamp: ts(0, 4, 3),
    },
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
