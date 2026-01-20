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
      const errorData: TableDataError = await res.json().catch(() => ({ error: 'Unknown error' }));
      return {
        success: false,
        error: errorData.error || `HTTP ${res.status}`,
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

  if (!result.success) {
    return {
      title: 'Table Not Found',
      description: 'This table view is no longer available.',
    };
  }

  return {
    title: result.data.metadata?.title || 'Table View',
    description: `Data from ${result.data.metadata?.projectName || 'project'}`,
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
        <h1 className="mb-2 text-2xl font-semibold text-foreground">Table Not Found</h1>
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
        <h1 className="mb-2 text-2xl font-semibold text-foreground">Error Loading Table</h1>
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
        <h1 className="mb-2 text-2xl font-semibold text-foreground">No Data</h1>
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
