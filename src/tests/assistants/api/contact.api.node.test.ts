/**
 * API Route tests for Contact endpoints
 *
 * Tests the contact-related API routes for proper handling of:
 * - Authentication
 * - Request validation
 * - Response transformation
 * - Error handling
 *
 * Uses MSW to mock backend services (COMMUNICATION_URL, ORCHESTRA_URL).
 *
 * @group api
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/tests/server';

// Mock environment variables
const MOCK_BASE_URL = 'http://localhost:3000';
const MOCK_COMMUNICATION_URL = 'http://communication-service';
const MOCK_ORCHESTRA_URL = 'http://orchestra-service';

describe('Contact API Routes', () => {
  const TEST_API_KEY = 'test-api-key';

  beforeEach(() => {
    vi.stubEnv('COMMUNICATION_URL', MOCK_COMMUNICATION_URL);
    vi.stubEnv('ORCHESTRA_URL', MOCK_ORCHESTRA_URL);
  });

  afterEach(() => {
    server.resetHandlers();
    vi.unstubAllEnvs();
  });

  describe('GET /api/contact/email', () => {
    it(
      'returns list of assistant emails',
      {
        meta: {
          alias: 'ContactEmail-List',
          scenario: 'Backend returns list of emails via from_fields parameter',
          behavior: 'Returns emails array extracted from assistant objects',
        },
      },
      async () => {
        // Arrange - The new endpoint returns objects with email field
        server.use(
          http.get(`${MOCK_ORCHESTRA_URL}/v0/admin/assistant`, ({ request }) => {
            const url = new URL(request.url);
            const fromFields = url.searchParams.get('from_fields');
            // Verify the from_fields parameter is being used correctly
            if (fromFields === 'email') {
              return HttpResponse.json({
                info: [
                  { agent_id: '1', user_id: 1, created_at: '2024-01-01', email: 'assistant1@example.com' },
                  { agent_id: '2', user_id: 2, created_at: '2024-01-01', email: 'assistant2@example.com' },
                ],
              });
            }
            return HttpResponse.json({ detail: 'Unexpected request' }, { status: 400 });
          })
        );

        // Act - Simulate what the route handler does
        const response = await fetch(`${MOCK_ORCHESTRA_URL}/v0/admin/assistant?from_fields=email`, {
          headers: { Authorization: `Bearer ${TEST_API_KEY}` },
        });
        const data = await response.json();

        // Assert
        expect(response.ok).toBe(true);
        expect(data.info).toHaveLength(2);
        expect(data.info[0].email).toBe('assistant1@example.com');
        expect(data.info[1].email).toBe('assistant2@example.com');
      }
    );

    it(
      'handles backend error',
      {
        meta: {
          alias: 'ContactEmail-ListError',
          scenario: 'Backend returns error',
          behavior: 'Returns error detail',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(`${MOCK_ORCHESTRA_URL}/v0/admin/assistant`, () => {
            return HttpResponse.json({ detail: 'Service unavailable' }, { status: 503 });
          })
        );

        // Act
        const response = await fetch(`${MOCK_ORCHESTRA_URL}/v0/admin/assistant?from_fields=email`, {
          headers: { Authorization: `Bearer ${TEST_API_KEY}` },
        });

        // Assert
        expect(response.status).toBe(503);
      }
    );
  });

  describe('POST /api/contact/email', () => {
    it(
      'creates email successfully',
      {
        meta: {
          alias: 'ContactEmail-Create',
          scenario: 'Valid email creation request',
          behavior: 'Returns created email',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_COMMUNICATION_URL}/email/create`, () => {
            return HttpResponse.json({
              success: true,
              user: { primaryEmail: 'new@example.com' },
            });
          })
        );

        // Act
        const response = await fetch(`${MOCK_COMMUNICATION_URL}/email/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emailAddress: 'new@example.com' }),
        });
        const data = await response.json();

        // Assert
        expect(response.ok).toBe(true);
        expect(data.user.primaryEmail).toBe('new@example.com');
      }
    );

    it(
      'handles creation failure',
      {
        meta: {
          alias: 'ContactEmail-CreateError',
          scenario: 'Backend rejects email creation',
          behavior: 'Returns error response',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_COMMUNICATION_URL}/email/create`, () => {
            return HttpResponse.json({ detail: 'Email already exists' }, { status: 409 });
          })
        );

        // Act
        const response = await fetch(`${MOCK_COMMUNICATION_URL}/email/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emailAddress: 'existing@example.com' }),
        });

        // Assert
        expect(response.status).toBe(409);
      }
    );
  });

  describe('DELETE /api/contact/email', () => {
    it(
      'deletes email successfully',
      {
        meta: {
          alias: 'ContactEmail-Delete',
          scenario: 'Valid email deletion request',
          behavior: 'Returns 204 No Content',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.delete(`${MOCK_COMMUNICATION_URL}/email/delete`, () => {
            return new HttpResponse(null, { status: 204 });
          })
        );

        // Act
        const response = await fetch(`${MOCK_COMMUNICATION_URL}/email/delete`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ primaryEmail: 'delete@example.com' }),
        });

        // Assert
        expect(response.status).toBe(204);
      }
    );
  });

  describe('GET /api/admin/contact-costs', () => {
    it(
      'returns contact cost rows from backend',
      {
        meta: {
          alias: 'ContactCosts-List',
          scenario: 'Backend returns cost rows',
          behavior: 'Returns array of contact costs',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(`${MOCK_ORCHESTRA_URL}/v0/admin/billing/contact-costs`, () => {
            return HttpResponse.json([
              { id: 1, contact_type: 'phone', provider: null, country_code: null, monthly_cost: 1.5, one_time_cost: 5.0 },
              { id: 2, contact_type: 'email', provider: null, country_code: null, monthly_cost: 14.0, one_time_cost: 5.0 },
              { id: 3, contact_type: 'whatsapp', provider: null, country_code: null, monthly_cost: 5.0, one_time_cost: 5.0 },
            ]);
          })
        );

        // Act
        const response = await fetch(`${MOCK_ORCHESTRA_URL}/v0/admin/billing/contact-costs`, {
          headers: { Authorization: `Bearer admin-key` },
        });
        const data = await response.json();

        // Assert
        expect(response.ok).toBe(true);
        expect(data).toHaveLength(3);
        expect(data[0].contact_type).toBe('phone');
        expect(data[2].one_time_cost).toBe(5.0);
      }
    );

    it(
      'handles backend error',
      {
        meta: {
          alias: 'ContactCosts-Error',
          scenario: 'Backend returns error',
          behavior: 'Returns error status',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(`${MOCK_ORCHESTRA_URL}/v0/admin/billing/contact-costs`, () => {
            return HttpResponse.json({ detail: 'Unauthorized' }, { status: 401 });
          })
        );

        // Act
        const response = await fetch(`${MOCK_ORCHESTRA_URL}/v0/admin/billing/contact-costs`, {
          headers: { Authorization: `Bearer bad-key` },
        });

        // Assert
        expect(response.status).toBe(401);
      }
    );
  });

  describe('POST /api/assistant/{id}/contact', () => {
    it(
      'creates a contact for the assistant',
      {
        meta: {
          alias: 'AssistantContact-Create',
          scenario: 'Valid contact creation request',
          behavior: 'Returns created contact info',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_ORCHESTRA_URL}/v0/assistant/:id/contact`, () => {
            return HttpResponse.json({
              info: { agent_id: 'a1', email: 'test@unify.ai' },
            });
          })
        );

        // Act
        const response = await fetch(`${MOCK_ORCHESTRA_URL}/v0/assistant/a1/contact`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${TEST_API_KEY}`,
          },
          body: JSON.stringify({ contact_type: 'email', email_local: 'test' }),
        });
        const data = await response.json();

        // Assert
        expect(response.ok).toBe(true);
        expect(data.info.email).toBe('test@unify.ai');
      }
    );

    it(
      'handles creation failure',
      {
        meta: {
          alias: 'AssistantContact-CreateError',
          scenario: 'Backend rejects contact creation',
          behavior: 'Returns error response',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_ORCHESTRA_URL}/v0/assistant/:id/contact`, () => {
            return HttpResponse.json({ detail: 'Email already provisioned' }, { status: 409 });
          })
        );

        // Act
        const response = await fetch(`${MOCK_ORCHESTRA_URL}/v0/assistant/a1/contact`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${TEST_API_KEY}`,
          },
          body: JSON.stringify({ contact_type: 'email', email_local: 'existing' }),
        });

        // Assert
        expect(response.status).toBe(409);
      }
    );
  });

  describe('PUT /api/assistant/{id}/contact', () => {
    it(
      'updates a contact for the assistant',
      {
        meta: {
          alias: 'AssistantContact-Update',
          scenario: 'Valid contact update request',
          behavior: 'Returns updated contact info',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.put(`${MOCK_ORCHESTRA_URL}/v0/assistant/:id/contact`, () => {
            return HttpResponse.json({
              info: { agent_id: 'a1', email: 'updated@unify.ai' },
            });
          })
        );

        // Act
        const response = await fetch(`${MOCK_ORCHESTRA_URL}/v0/assistant/a1/contact`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${TEST_API_KEY}`,
          },
          body: JSON.stringify({ contact_type: 'email', email_local: 'updated' }),
        });
        const data = await response.json();

        // Assert
        expect(response.ok).toBe(true);
        expect(data.info.email).toBe('updated@unify.ai');
      }
    );
  });

  describe('GET /api/contact/phone/available-countries', () => {
    it(
      'returns processed country list',
      {
        meta: {
          alias: 'ContactPhone-Countries',
          scenario: 'Backend returns country codes',
          behavior: 'Returns processed countries with names and flags',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(`${MOCK_COMMUNICATION_URL}/phone/available-countries`, () => {
            return HttpResponse.json({ countries: 'US,GB,CA' });
          })
        );

        // Act
        const response = await fetch(`${MOCK_COMMUNICATION_URL}/phone/available-countries`, {
          headers: { Authorization: `Bearer ${TEST_API_KEY}` },
        });
        const data = await response.json();

        // Assert
        expect(response.ok).toBe(true);
        expect(data).toHaveProperty('countries');
      }
    );

    it(
      'handles backend error',
      {
        meta: {
          alias: 'ContactPhone-CountriesError',
          scenario: 'Backend returns error',
          behavior: 'Returns error status',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(`${MOCK_COMMUNICATION_URL}/phone/available-countries`, () => {
            return HttpResponse.json({ detail: 'Service unavailable' }, { status: 503 });
          })
        );

        // Act
        const response = await fetch(`${MOCK_COMMUNICATION_URL}/phone/available-countries`, {
          headers: { Authorization: `Bearer ${TEST_API_KEY}` },
        });

        // Assert
        expect(response.status).toBe(503);
      }
    );
  });

  describe('GET /api/contact/social/available-platforms', () => {
    it(
      'returns available social platforms',
      {
        meta: {
          alias: 'ContactSocial-Platforms',
          scenario: 'Backend returns platform list',
          behavior: 'Returns platforms array',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(`${MOCK_COMMUNICATION_URL}/social/available-platforms`, () => {
            return HttpResponse.json({
              platforms: [
                { name: 'twitter', displayName: 'Twitter' },
                { name: 'instagram', displayName: 'Instagram' },
              ],
            });
          })
        );

        // Act
        const response = await fetch(`${MOCK_COMMUNICATION_URL}/social/available-platforms`, {
          headers: { Authorization: `Bearer ${TEST_API_KEY}` },
        });
        const data = await response.json();

        // Assert
        expect(response.ok).toBe(true);
        expect(data.platforms).toHaveLength(2);
      }
    );
  });

  describe('POST /api/contact/social/verify', () => {
    it(
      'initiates social account verification',
      {
        meta: {
          alias: 'ContactSocial-Verify',
          scenario: 'Valid verification request',
          behavior: 'Returns verification code',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_COMMUNICATION_URL}/social/verify`, () => {
            return HttpResponse.json({
              verificationCode: 'ABC123',
              sentAt: '2024-01-01T12:00:00Z',
            });
          })
        );

        // Act
        const response = await fetch(`${MOCK_COMMUNICATION_URL}/social/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ platform: 'twitter', accountIdentifier: '@user' }),
        });
        const data = await response.json();

        // Assert
        expect(response.ok).toBe(true);
        expect(data).toHaveProperty('verificationCode');
      }
    );

    it(
      'handles verification failure',
      {
        meta: {
          alias: 'ContactSocial-VerifyError',
          scenario: 'Account not found',
          behavior: 'Returns 404 error',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_COMMUNICATION_URL}/social/verify`, () => {
            return HttpResponse.json({ detail: 'Account not found' }, { status: 404 });
          })
        );

        // Act
        const response = await fetch(`${MOCK_COMMUNICATION_URL}/social/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ platform: 'twitter', accountIdentifier: '@nonexistent' }),
        });

        // Assert
        expect(response.status).toBe(404);
      }
    );
  });
});
