/**
 * Dashboard View Page
 *
 * Public page that renders a dashboard (grid of tiles) from a shared token.
 * No authentication required - the token provides access.
 * Supports embed mode (embed=true) for iframe usage in chat.
 */

import { Metadata } from 'next';
import { fetchDashboardData } from '@/lib/dashboardData';
import { DashboardViewer } from '@/components/Pages/Dashboard/DashboardViewer';

interface PageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params;
  const result = await fetchDashboardData(token);
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://console.unify.ai';

  if (!result.success) {
    return {
      title: 'Dashboard Not Found',
      description: 'This dashboard is no longer available.',
    };
  }

  const title = result.data.title || 'Dashboard';
  const pageUrl = `${baseUrl}/dashboard/view/${token}`;

  return {
    title,
    description:
      result.data.description || `Interactive dashboard with ${result.data.tileCount} tiles`,
    openGraph: {
      type: 'website',
      title,
      description:
        result.data.description || `Interactive dashboard with ${result.data.tileCount} tiles`,
      url: pageUrl,
      siteName: 'Unify Console',
    },
  };
}

function DashboardNotFoundMessage() {
  return (
    <main className="brand-page-stencil-bg flex min-h-screen items-center justify-center bg-background">
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
        <h1 className="text-display text-semibold mb-2">Dashboard Not Found</h1>
        <p className="text-muted-foreground">
          This dashboard has been deleted or the link is invalid.
        </p>
      </div>
    </main>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <main className="brand-page-stencil-bg flex min-h-screen items-center justify-center bg-background">
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
        <h1 className="text-display text-semibold mb-2">Unable to Load Dashboard</h1>
        <p className="text-muted-foreground">{message}</p>
      </div>
    </main>
  );
}

export default async function DashboardViewPage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const resolvedSearchParams = await searchParams;
  const result = await fetchDashboardData(token);
  const embed = resolvedSearchParams.embed === 'true';

  if (!result.success) {
    if (result.error.status === 404) {
      return <DashboardNotFoundMessage />;
    }
    return <ErrorMessage message={result.error.error} />;
  }

  const { data } = result;

  return (
    <main className="brand-page-stencil-bg min-h-screen bg-background">
      <DashboardViewer
        token={token}
        title={data.title}
        description={data.description}
        tiles={data.tiles}
        embed={embed}
      />
    </main>
  );
}
