/**
 * Table View Page
 *
 * Public page that renders an interactive read-only table from a shared token.
 * No authentication required - the token provides access.
 */

import { Metadata } from 'next';
import { TableViewer } from '@/components/Pages/Table/TableViewer';
import type { TableDataResponse, TableDataError } from '@/types/tableView';

interface PageProps {
  params: { token: string };
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
  const result = await getTableData(params.token);
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
  const ogImageUrl = `${baseUrl}/api/og/table/${params.token}.png`;
  const pageUrl = `${baseUrl}/table/view/${params.token}`;

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
    <main className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <div className="mb-4 text-6xl">📊</div>
        <h1 className="text-display text-semibold mb-2 text-foreground">Table Not Found</h1>
        <p className="text-muted-foreground">
          This table view may have been deleted or the link is invalid.
        </p>
      </div>
    </main>
  );
}

/**
 * Error message component
 */
function ErrorMessage({ message }: { message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <div className="mb-4 text-6xl">⚠️</div>
        <h1 className="text-display text-semibold mb-2 text-foreground">Error Loading Table</h1>
        <p className="text-muted-foreground">{message}</p>
      </div>
    </main>
  );
}

/**
 * Empty data message component
 */
function EmptyDataMessage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <div className="mb-4 text-6xl">📭</div>
        <h1 className="text-display text-semibold mb-2 text-foreground">No Data</h1>
        <p className="text-muted-foreground">
          No data available for this table view. The project may be empty or the filters returned no
          results.
        </p>
      </div>
    </main>
  );
}

export default async function TableViewPage({ params }: PageProps) {
  const result = await getTableData(params.token);

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
    <main className="min-h-screen bg-background">
      <TableViewer
        token={params.token}
        config={tableData.config}
        initialData={tableData.data}
        fields={tableData.fields}
        metadata={tableData.metadata}
        initialPagination={tableData.pagination}
      />
    </main>
  );
}
