import { NextRequest, NextResponse } from 'next/server';

const VALID_OS = ['ubuntu', 'windows', 'macos'] as const;
type ValidOS = (typeof VALID_OS)[number];

/**
 * GET /api/assistant/local/install?os=ubuntu|windows|macos
 *
 * Fetches the README.md from the unify-desktop-assistant repository
 * for the specified OS branch. This proxies the request through the
 * server to hide the GitHub token from the client.
 */
export async function GET(request: NextRequest) {
  const os = request.nextUrl.searchParams.get('os');

  // Validate OS parameter
  if (!os || !VALID_OS.includes(os as ValidOS)) {
    return NextResponse.json(
      { detail: `Invalid or missing 'os' parameter. Must be one of: ${VALID_OS.join(', ')}` },
      { status: 400 }
    );
  }

  // Check for GitHub token
  const githubToken = process.env.DEVBOT_GITHUB_TOKEN;
  if (!githubToken) {
    console.error('[API /api/assistant/local/install] DEVBOT_GITHUB_TOKEN not configured');
    return NextResponse.json(
      { detail: 'Server configuration error: GitHub token not found.' },
      { status: 500 }
    );
  }

  // Map OS to branch name (windows -> win)
  const branch = os === 'windows' ? 'win' : os;

  const githubApiUrl = `https://api.github.com/repos/unifyai/unify-desktop-assistant/contents/README.md?ref=${branch}`;

  try {
    const response = await fetch(githubApiUrl, {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: 'application/vnd.github.v3.raw',
        'User-Agent': 'unify-console',
      },
      // Don't cache to always get latest
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error(
        `[API /api/assistant/local/install] GitHub API error: ${response.status} ${response.statusText}`
      );

      if (response.status === 404) {
        return NextResponse.json(
          { detail: `README not found for ${os} (branch: ${branch})` },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { detail: `Failed to fetch instructions from GitHub: ${response.statusText}` },
        { status: response.status }
      );
    }

    const content = await response.text();

    return NextResponse.json({ content }, { status: 200 });
  } catch (error) {
    console.error('[API /api/assistant/local/install] Error:', error);
    return NextResponse.json({ detail: 'Failed to connect to GitHub API' }, { status: 500 });
  }
}
