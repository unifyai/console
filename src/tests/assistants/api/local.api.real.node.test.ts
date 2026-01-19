/**
 * Real GitHub API tests for Local Desktop Install/Download routes
 *
 * These tests hit the actual GitHub API to verify:
 * 1. README files exist in each OS branch (ubuntu, win, macos)
 * 2. Release assets are downloadable for each OS
 * 3. API contracts are stable
 *
 * Run with: npm run test:real
 *
 * Requirements:
 *   1. DEVBOT_GITHUB_TOKEN set in .env.test
 *   2. Dev server running (npm run dev) for route tests
 *
 * @group real
 */

// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import {
  skipIfServerNotReachable,
  realTestOptions,
  realTestOptionsExtended,
} from '@/tests/assistants/api/fixtures/api-actions';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
const GITHUB_API_URL = 'https://api.github.com';
const REPO_OWNER = 'unifyai';
const REPO_NAME = 'unify-desktop-assistant';

/**
 * Get the GitHub token from environment
 */
function getGitHubToken(): string {
  const token = process.env.DEVBOT_GITHUB_TOKEN;
  if (!token) {
    throw new Error('DEVBOT_GITHUB_TOKEN is not set in .env.test');
  }
  return token;
}

/**
 * Check if GitHub token is available
 */
function hasGitHubToken(): boolean {
  return !!process.env.DEVBOT_GITHUB_TOKEN;
}

describe('@real Local Desktop API - GitHub Integration', () => {
  let GITHUB_TOKEN: string;

  beforeAll(async () => {
    if (!hasGitHubToken()) {
      console.warn('DEVBOT_GITHUB_TOKEN not set, skipping GitHub integration tests');
      return;
    }

    try {
      GITHUB_TOKEN = getGitHubToken();
    } catch {
      console.warn('Could not get GitHub token, skipping tests');
      return;
    }
  }, 10000);

  describe('GitHub API Direct Verification', () => {
    it.skipIf(!hasGitHubToken())(
      '@real README exists in ubuntu branch',
      realTestOptions,
      async () => {
        const response = await fetch(
          `${GITHUB_API_URL}/repos/${REPO_OWNER}/${REPO_NAME}/contents/README.md?ref=ubuntu`,
          {
            headers: {
              Authorization: `Bearer ${GITHUB_TOKEN}`,
              Accept: 'application/vnd.github.v3.raw',
              'User-Agent': 'unify-console-tests',
            },
          }
        );

        expect(response.ok).toBe(true);
        const content = await response.text();
        expect(content.length).toBeGreaterThan(0);
        // README should contain markdown heading
        expect(content).toMatch(/^#/m);
      }
    );

    it.skipIf(!hasGitHubToken())('@real README exists in win branch', realTestOptions, async () => {
      const response = await fetch(
        `${GITHUB_API_URL}/repos/${REPO_OWNER}/${REPO_NAME}/contents/README.md?ref=win`,
        {
          headers: {
            Authorization: `Bearer ${GITHUB_TOKEN}`,
            Accept: 'application/vnd.github.v3.raw',
            'User-Agent': 'unify-console-tests',
          },
        }
      );

      expect(response.ok).toBe(true);
      const content = await response.text();
      expect(content.length).toBeGreaterThan(0);
    });

    it.skipIf(!hasGitHubToken())(
      '@real README exists in macos branch',
      realTestOptions,
      async () => {
        const response = await fetch(
          `${GITHUB_API_URL}/repos/${REPO_OWNER}/${REPO_NAME}/contents/README.md?ref=macos`,
          {
            headers: {
              Authorization: `Bearer ${GITHUB_TOKEN}`,
              Accept: 'application/vnd.github.v3.raw',
              'User-Agent': 'unify-console-tests',
            },
          }
        );

        expect(response.ok).toBe(true);
        const content = await response.text();
        expect(content.length).toBeGreaterThan(0);
      }
    );

    it.skipIf(!hasGitHubToken())(
      '@real latest release exists with assets',
      realTestOptions,
      async () => {
        const response = await fetch(
          `${GITHUB_API_URL}/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`,
          {
            headers: {
              Authorization: `Bearer ${GITHUB_TOKEN}`,
              Accept: 'application/vnd.github+json',
              'User-Agent': 'unify-console-tests',
            },
          }
        );

        expect(response.ok).toBe(true);

        const release = await response.json();
        expect(release).toHaveProperty('tag_name');
        expect(release).toHaveProperty('assets');
        expect(Array.isArray(release.assets)).toBe(true);
        expect(release.assets.length).toBeGreaterThan(0);
      }
    );

    it.skipIf(!hasGitHubToken())(
      '@real release contains .deb asset for ubuntu',
      realTestOptions,
      async () => {
        const response = await fetch(
          `${GITHUB_API_URL}/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`,
          {
            headers: {
              Authorization: `Bearer ${GITHUB_TOKEN}`,
              Accept: 'application/vnd.github+json',
              'User-Agent': 'unify-console-tests',
            },
          }
        );

        expect(response.ok).toBe(true);

        const release = await response.json();
        const debAsset = release.assets.find((a: any) => a.name.endsWith('.deb'));

        expect(debAsset).toBeDefined();
        expect(debAsset.name).toContain('.deb');
        expect(debAsset.id).toBeDefined();
      }
    );

    it.skipIf(!hasGitHubToken())(
      '@real release contains .nupkg asset for windows',
      realTestOptions,
      async () => {
        const response = await fetch(
          `${GITHUB_API_URL}/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`,
          {
            headers: {
              Authorization: `Bearer ${GITHUB_TOKEN}`,
              Accept: 'application/vnd.github+json',
              'User-Agent': 'unify-console-tests',
            },
          }
        );

        expect(response.ok).toBe(true);

        const release = await response.json();
        const nupkgAsset = release.assets.find((a: any) => a.name.endsWith('.nupkg'));

        expect(nupkgAsset).toBeDefined();
        expect(nupkgAsset.name).toContain('.nupkg');
      }
    );

    it.skipIf(!hasGitHubToken())(
      '@real release contains .dmg asset for macos',
      realTestOptions,
      async () => {
        const response = await fetch(
          `${GITHUB_API_URL}/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`,
          {
            headers: {
              Authorization: `Bearer ${GITHUB_TOKEN}`,
              Accept: 'application/vnd.github+json',
              'User-Agent': 'unify-console-tests',
            },
          }
        );

        expect(response.ok).toBe(true);

        const release = await response.json();
        const dmgAsset = release.assets.find((a: any) => a.name.endsWith('.dmg'));

        expect(dmgAsset).toBeDefined();
        expect(dmgAsset.name).toContain('.dmg');
      }
    );

    it.skipIf(!hasGitHubToken())(
      '@real can download first chunk of .deb asset',
      realTestOptionsExtended,
      async () => {
        // First get the release to find the asset ID
        const releaseResponse = await fetch(
          `${GITHUB_API_URL}/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`,
          {
            headers: {
              Authorization: `Bearer ${GITHUB_TOKEN}`,
              Accept: 'application/vnd.github+json',
              'User-Agent': 'unify-console-tests',
            },
          }
        );

        expect(releaseResponse.ok).toBe(true);
        const release = await releaseResponse.json();
        const debAsset = release.assets.find((a: any) => a.name.endsWith('.deb'));
        expect(debAsset).toBeDefined();

        // Download the asset
        const assetResponse = await fetch(
          `${GITHUB_API_URL}/repos/${REPO_OWNER}/${REPO_NAME}/releases/assets/${debAsset.id}`,
          {
            headers: {
              Authorization: `Bearer ${GITHUB_TOKEN}`,
              Accept: 'application/octet-stream',
              'User-Agent': 'unify-console-tests',
            },
          }
        );

        expect(assetResponse.ok).toBe(true);

        // Just verify we can read the first chunk (don't download whole file)
        const reader = assetResponse.body?.getReader();
        if (reader) {
          const { value, done } = await reader.read();
          expect(done).toBe(false);
          expect(value).toBeDefined();
          expect(value!.length).toBeGreaterThan(0);
          await reader.cancel(); // Stop download after first chunk
        }
      }
    );
  });

  describe('API Route Tests (requires dev server)', () => {
    beforeAll(async () => {
      if (!hasGitHubToken()) {
        return;
      }
      await skipIfServerNotReachable();
    }, 10000);

    it.skipIf(!hasGitHubToken())(
      '@real GET /api/assistant/local/install returns README for ubuntu',
      realTestOptions,
      async () => {
        const response = await fetch(`${BASE_URL}/api/assistant/local/install?os=ubuntu`);

        expect(response.ok).toBe(true);

        const data = await response.json();
        expect(data).toHaveProperty('content');
        expect(typeof data.content).toBe('string');
        expect(data.content.length).toBeGreaterThan(0);
        // Should be markdown content
        expect(data.content).toMatch(/^#/m);
      }
    );

    it.skipIf(!hasGitHubToken())(
      '@real GET /api/assistant/local/install returns README for windows',
      realTestOptions,
      async () => {
        const response = await fetch(`${BASE_URL}/api/assistant/local/install?os=windows`);

        expect(response.ok).toBe(true);

        const data = await response.json();
        expect(data).toHaveProperty('content');
        expect(data.content.length).toBeGreaterThan(0);
      }
    );

    it.skipIf(!hasGitHubToken())(
      '@real GET /api/assistant/local/install returns README for macos',
      realTestOptions,
      async () => {
        const response = await fetch(`${BASE_URL}/api/assistant/local/install?os=macos`);

        expect(response.ok).toBe(true);

        const data = await response.json();
        expect(data).toHaveProperty('content');
        expect(data.content.length).toBeGreaterThan(0);
      }
    );

    it.skipIf(!hasGitHubToken())(
      '@real GET /api/assistant/local/install returns 400 for invalid OS',
      realTestOptions,
      async () => {
        const response = await fetch(`${BASE_URL}/api/assistant/local/install?os=invalid`);

        expect(response.status).toBe(400);

        const data = await response.json();
        expect(data).toHaveProperty('detail');
      }
    );

    it.skipIf(!hasGitHubToken())(
      '@real GET /api/assistant/local/install returns 400 for missing OS',
      realTestOptions,
      async () => {
        const response = await fetch(`${BASE_URL}/api/assistant/local/install`);

        expect(response.status).toBe(400);
      }
    );

    it.skipIf(!hasGitHubToken())(
      '@real GET /api/assistant/local/download streams binary for ubuntu',
      realTestOptionsExtended,
      async () => {
        const response = await fetch(`${BASE_URL}/api/assistant/local/download?os=ubuntu`);

        expect(response.ok).toBe(true);
        expect(response.headers.get('content-type')).toBe('application/octet-stream');

        const contentDisposition = response.headers.get('content-disposition');
        expect(contentDisposition).toContain('attachment');
        expect(contentDisposition).toContain('.deb');

        // Just read first chunk to verify streaming works
        const reader = response.body?.getReader();
        if (reader) {
          const { value, done } = await reader.read();
          expect(done).toBe(false);
          expect(value).toBeDefined();
          expect(value!.length).toBeGreaterThan(0);
          await reader.cancel();
        }
      }
    );

    it.skipIf(!hasGitHubToken())(
      '@real GET /api/assistant/local/download returns 400 for invalid OS',
      realTestOptions,
      async () => {
        const response = await fetch(`${BASE_URL}/api/assistant/local/download?os=invalid`);

        expect(response.status).toBe(400);
      }
    );
  });
});
