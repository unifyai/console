/**
 * Table View Page
 *
 * Public page that renders an interactive read-only table from a shared token.
 * No authentication required - the token provides access.
 */

import { Metadata } from 'next';
import { BrandStatusCard } from '@/components/Brand';
import { TableViewer } from '@/components/Pages/Table/TableViewer';
import type { TableDataResponse, TableDataError } from '@/types/tableView';

interface PageProps {
  params: Promise<{ token: string }>;
}

type TableDataResult =
  | { success: true; data: TableDataResponse }
  | { success: false; error: string; expired: boolean; status: number };

/**
 * Fetch table data from the API
 */
async function getTableData(token: string): Promise<TableDataResult> {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';

  try {
    const res = await fetch(`${baseUrl}/api/table/data/${token}`, {
      cache: 'no-store',
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
      // Handle both {error: string} and {detail: array} formats
      let errorMessage = `HTTP ${res.status}`;
      if (typeof errorData.error === 'string') {
        errorMessage = errorData.error;
      } else if (Array.isArray(errorData.detail)) {
        errorMessage = errorData.detail
          .map((d: { msg?: string }) => d.msg || 'Validation error')
          .join(', ');
      } else if (typeof errorData.detail === 'string') {
        errorMessage = errorData.detail;
      }
      return {
        success: false,
        error: errorMessage,
        expired: errorData.expired || res.status === 410,
        status: res.status,
      };
    }

    const data: TableDataResponse = await res.json();
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: 'Failed to load table',
      expired: false,
      status: 500,
    };
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params;
  const result = await getTableData(token);
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://console.unify.ai';

  if (!result.success) {
    return {
      title: 'Table Not Found',
      description: 'This table view is no longer available.',
    };
  }

  const title = result.data.metadata?.title || 'Table View';
  const projectName = result.data.metadata?.projectName || 'project';
  const rowCount = result.data.pagination.totalCount;
  const columnCount = result.data.fields ? Object.keys(result.data.fields).length : 0;
  const description = `Interactive table with ${rowCount.toLocaleString()} rows and ${columnCount} columns from ${projectName}`;
  const ogImageUrl = `${baseUrl}/api/og/table/${token}.png`;
  const pageUrl = `${baseUrl}/table/view/${token}`;

  return {
    title,
    description,
    openGraph: {
      type: 'website',
      title,
      description,
      url: pageUrl,
      siteName: 'Unify Console',
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: `Preview of ${title}`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
    other: {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      'og:image:type': 'image/png',
    },
    alternates: {
      types: {
        'application/json+oembed': `${baseUrl}/api/oembed?url=${encodeURIComponent(pageUrl)}&format=json`,
        'text/xml+oembed': `${baseUrl}/api/oembed?url=${encodeURIComponent(pageUrl)}&format=xml`,
      },
    },
  };
}

/**
 * Table not found message component
 */
function TableNotFoundMessage() {
  return (
    <main className="brand-page-stencil-bg flex min-h-screen items-center justify-center bg-background">
      <BrandStatusCard
        className="mx-6 max-w-md p-8"
        eyebrow="Shared table"
        title="Table Not Found"
        description="This table view may have been deleted or the link is invalid."
        tone="neutral"
        icon={
          <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 10h18M3 14h18M7 6v12m10-12v12M5 6h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z"
            />
          </svg>
        }
      />
    </main>
  );
}

/**
 * Error message component
 */
function ErrorMessage({ message }: { message: string }) {
  return (
    <main className="brand-page-stencil-bg flex min-h-screen items-center justify-center bg-background">
      <BrandStatusCard
        className="mx-6 max-w-md p-8"
        eyebrow="Shared table"
        title="Error Loading Table"
        description={message}
        tone="danger"
        icon={
          <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        }
      />
    </main>
  );
}

/**
 * Empty data message component
 */
function EmptyDataMessage() {
  return (
    <main className="brand-page-stencil-bg flex min-h-screen items-center justify-center bg-background">
      <BrandStatusCard
        className="mx-6 max-w-md p-8"
        eyebrow="Shared table"
        title="No Data"
        description="No data available for this table view. The project may be empty or the filters returned no results."
        tone="neutral"
        icon={
          <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20 13V7a2 2 0 00-2-2H6a2 2 0 00-2 2v6m16 0v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4m16 0H4"
            />
          </svg>
        }
      />
    </main>
  );
}

export default async function TableViewPage({ params }: PageProps) {
  const { token } = await params;
  const result = await getTableData(token);

  // Handle errors
  if (!result.success) {
    if (result.status === 404 || result.expired) {
      return <TableNotFoundMessage />;
    }
    return <ErrorMessage message={result.error} />;
  }

  const { data: tableData } = result;

  // Handle empty data (but only if totalCount is 0 - page 1 might just have no data yet)
  if (tableData.pagination.totalCount === 0) {
    return <EmptyDataMessage />;
  }

  return (
    <main className="brand-page-stencil-bg min-h-screen bg-background">
      <TableViewer
        token={token}
        config={tableData.config}
        initialData={tableData.data}
        fields={tableData.fields}
        metadata={tableData.metadata}
        initialPagination={tableData.pagination}
      />
    </main>
  );
}
