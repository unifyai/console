/**
 * Tile View Page
 *
 * Public page that renders a self-contained HTML tile from a shared token.
 * No authentication required - the token provides access.
 * Supports embed mode (embed=true) for iframe usage in dashboards and chat.
 */

import { Metadata } from 'next';
import { fetchTileData } from '@/lib/tileData';
import { TileViewer } from '@/components/Pages/Tile/TileViewer';

interface PageProps {
  params: { token: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const result = await fetchTileData(params.token);
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://console.unify.ai';

  if (!result.success) {
    return {
      title: 'Tile Not Found',
      description: 'This tile is no longer available.',
    };
  }

  const title = result.data.title || 'Tile View';
  const pageUrl = `${baseUrl}/tile/view/${params.token}`;

  return {
    title,
    description: result.data.description || `Interactive visualization tile: ${title}`,
    openGraph: {
      type: 'website',
      title,
      description: result.data.description || `Interactive visualization tile: ${title}`,
      url: pageUrl,
      siteName: 'Unify Console',
    },
  };
}

function TileNotFoundMessage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <div className="max-w-md px-6 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <svg
            className="h-8 w-8 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 2a10 10 0 100 20 10 10 0 000-20z"
            />
          </svg>
        </div>
        <h1 className="text-display text-semibold mb-2">Tile Not Found</h1>
        <p className="text-muted-foreground">This tile has been deleted or the link is invalid.</p>
      </div>
    </main>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <div className="max-w-md px-6 text-center">
        <div className="bg-destructive/10 mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full">
          <svg
            className="h-8 w-8 text-destructive"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h1 className="text-display text-semibold mb-2">Unable to Load Tile</h1>
        <p className="text-muted-foreground">{message}</p>
      </div>
    </main>
  );
}

export default async function TileViewPage({ params, searchParams }: PageProps) {
  const result = await fetchTileData(params.token);
  const embed = searchParams.embed === 'true';

  if (!result.success) {
    if (result.error.status === 404) {
      return <TileNotFoundMessage />;
    }
    return <ErrorMessage message={result.error.error} />;
  }

  const { data } = result;

  if (!data.htmlContent) {
    return <ErrorMessage message="This tile has no content." />;
  }

  return (
    <main className="h-screen overflow-hidden bg-background">
      <TileViewer
        token={params.token}
        title={data.title}
        htmlContent={data.htmlContent}
        hasDataBindings={data.hasDataBindings}
        dataBindingsJson={data.dataBindingsJson}
        onDataScript={data.onDataScript}
        embed={embed}
      />
    </main>
  );
}
