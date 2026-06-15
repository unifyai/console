/**
 * Plot View Page
 *
 * Public page that renders an interactive plot from a shared token.
 * No authentication required - the token provides access.
 */

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PlotViewer } from '@/components/Pages/Plot/PlotViewer';
import { LogProps, LogFieldsResponseProps } from '@/types/interfaces/logs';
import { DataLabel, GroupedDataLabel } from '@/types/interfaces/plot';

interface PageProps {
  params: { token: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

interface PlotDataResponse {
  config: {
    type: string;
    xAxis: string;
    yAxis?: string;
    groupBy?: string;
    aggregate?: string;
    scaleX?: string;
    scaleY?: string;
    metric?: string;
    binCount?: number;
    showRegression?: boolean;
    sortBy?: string;
    sortOrder?: string;
    title?: string;
    xLabel?: string;
    yLabel?: string;
    // Axis customization - xLabel/yLabel apply to both axis and tooltip
    showXLabel?: boolean;
    showYLabel?: boolean;
    xTickFormat?: string;
    yTickFormat?: string;
  };
  data: LogProps[];
  fields: LogFieldsResponseProps;
  metadata: {
    title?: string;
    projectName: string;
    createdAt: string;
    createdBy?: string;
  };
  /** Pre-aggregated bar chart data from backend (optional) */
  preAggregatedBarData?: DataLabel[] | GroupedDataLabel[];
  /** Whether bar chart data uses secondary grouping */
  isGroupedBarChart?: boolean;
}

interface PlotDataError {
  error: string;
  expired?: boolean;
}

type PlotDataResult =
  | { success: true; data: PlotDataResponse }
  | { success: false; error: string; expired: boolean; status: number };

/**
 * Fetch plot data from the API
 */
async function getPlotData(token: string): Promise<PlotDataResult> {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';

  try {
    const res = await fetch(`${baseUrl}/api/plot/data/${token}`, {
      cache: 'no-store', // Always fresh
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

    const data: PlotDataResponse = await res.json();
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: 'Failed to load plot',
      expired: false,
      status: 500,
    };
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const result = await getPlotData(params.token);
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://console.unify.ai';

  if (!result.success) {
    return {
      title: 'Plot Not Found',
      description: 'This plot is no longer available.',
    };
  }

  const title = result.data.metadata?.title || 'Plot View';
  const projectName = result.data.metadata?.projectName || 'project';
  const plotType = result.data.config?.type || 'chart';
  const dataPoints = result.data.data?.length || 0;
  const description = `Interactive ${plotType} visualization with ${dataPoints.toLocaleString()} data points from ${projectName}`;
  const ogImageUrl = `${baseUrl}/api/og/plot/${params.token}.png`;
  const pageUrl = `${baseUrl}/plot/view/${params.token}`;

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
 * Plot not found/deleted message component
 */
function PlotNotFoundMessage() {
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
        <h1 className="text-display text-semibold mb-2">Plot Not Found</h1>
        <p className="text-muted-foreground">
          This plot has been deleted or the link is invalid. Please request a new link from the
          original source.
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
        <h1 className="text-display text-semibold mb-2">Unable to Load Plot</h1>
        <p className="text-muted-foreground">{message}</p>
      </div>
    </main>
  );
}

export default async function PlotViewPage({ params, searchParams }: PageProps) {
  const result = await getPlotData(params.token);
  const embed = searchParams.embed === 'true';

  // Handle errors
  if (!result.success) {
    if (result.status === 404 || result.expired) {
      return <PlotNotFoundMessage />;
    }
    return <ErrorMessage message={result.error} />;
  }

  const { data: plotData } = result;

  // Handle empty data - for bar charts with pre-aggregated data, check that too
  const hasPreAggregatedBarData =
    plotData.preAggregatedBarData && plotData.preAggregatedBarData.length > 0;
  const hasRawData = plotData.data && plotData.data.length > 0;

  if (!hasRawData && !hasPreAggregatedBarData) {
    return (
      <ErrorMessage message="No data available for this plot. The project may be empty or the filters returned no results." />
    );
  }

  return (
    <main className="brand-page-stencil-bg h-screen overflow-hidden bg-background">
      <PlotViewer
        config={plotData.config}
        data={plotData.data}
        fields={plotData.fields}
        title={plotData.metadata?.title}
        preAggregatedBarData={plotData.preAggregatedBarData}
        embed={embed}
      />
    </main>
  );
}
