import { NextRequest, NextResponse } from 'next/server';

const VALID_OS = ['ubuntu', 'windows', 'macos'] as const;
type ValidOS = (typeof VALID_OS)[number];

// Map OS to expected file extension in release assets
const OS_TO_EXTENSION: Record<ValidOS, string> = {
  ubuntu: '.deb',
  windows: '.exe',
  macos: '.pkg',
};

interface GitHubAsset {
  id: number;
  name: string;
  browser_download_url: string;
  size: number;
  content_type: string;
}

interface GitHubRelease {
  tag_name: string;
  assets: GitHubAsset[];
}

/**
 * GET /api/assistant/local/download?os=ubuntu|windows|macos
 *
 * Streams the binary from the latest GitHub release for the specified OS.
 * This proxies the request through the server to hide the GitHub token
 * and direct GitHub URLs from the client.
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
    console.error('[API /api/assistant/local/download] DEVBOT_GITHUB_TOKEN not configured');
    return NextResponse.json(
      { detail: 'Server configuration error: GitHub token not found.' },
      { status: 500 }
    );
  }

  const expectedExtension = OS_TO_EXTENSION[os as ValidOS];
  const isStaging = process.env.ORCHESTRA_URL?.toLowerCase().includes('staging') ?? false;

  try {
    // Step 1: Get the latest release
    const releaseUrl =
      'https://api.github.com/repos/unifyai/unify-desktop-assistant/releases/latest';
    const releaseResponse = await fetch(releaseUrl, {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'unify-console',
      },
      cache: 'no-store',
    });

    if (!releaseResponse.ok) {
      console.error(
        `[API /api/assistant/local/download] Failed to fetch releases: ${releaseResponse.status}`
      );
      return NextResponse.json(
        { detail: 'Failed to fetch release information from GitHub' },
        { status: releaseResponse.status }
      );
    }

    const release: GitHubRelease = await releaseResponse.json();

    // Step 2: Find the asset matching the OS and environment. Both the staging
    // and prod builds share the OS extension, so we additionally require the
    // "staging" substring on staging and forbid it on prod.
    const asset = release.assets.find((a) => {
      const name = a.name.toLowerCase();
      if (!name.endsWith(expectedExtension)) return false;
      return isStaging ? name.includes('staging') : !name.includes('staging');
    });

    if (!asset) {
      console.error(
        `[API /api/assistant/local/download] No ${
          isStaging ? 'staging ' : ''
        }${expectedExtension} asset found in release ${release.tag_name}`
      );
      return NextResponse.json(
        {
          detail: `No ${isStaging ? 'staging ' : ''}${os} binary (${expectedExtension}) found in the latest release`,
        },
        { status: 404 }
      );
    }

    // Step 3: Download the asset using the asset ID (authenticated download)
    const assetDownloadUrl = `https://api.github.com/repos/unifyai/unify-desktop-assistant/releases/assets/${asset.id}`;
    const assetResponse = await fetch(assetDownloadUrl, {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: 'application/octet-stream',
        'User-Agent': 'unify-console',
      },
    });

    if (!assetResponse.ok) {
      console.error(
        `[API /api/assistant/local/download] Failed to download asset: ${assetResponse.status}`
      );
      return NextResponse.json(
        { detail: 'Failed to download binary from GitHub' },
        { status: assetResponse.status }
      );
    }

    // Step 4: Stream the binary to the client
    const headers = new Headers();
    headers.set('Content-Type', 'application/octet-stream');
    headers.set('Content-Disposition', `attachment; filename="${asset.name}"`);
    if (asset.size) {
      headers.set('Content-Length', asset.size.toString());
    }

    // Stream the response body directly
    return new NextResponse(assetResponse.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('[API /api/assistant/local/download] Error:', error);
    return NextResponse.json({ detail: 'Failed to connect to GitHub API' }, { status: 500 });
  }
}
