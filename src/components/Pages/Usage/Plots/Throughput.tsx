import { ThroughputDataProps } from '@/types/usage';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

function convertDataToNumericTimestamps(data: ThroughputDataProps[]) {
  return data.map((d) => ({
    ...d,
    ts: new Date(d.ts).getTime(),
  }));
}

export function ThroughputPlot({ data }: { data: ThroughputDataProps[] }) {
  // Convert string timestamps to numeric (ms) timestamps
  const numericData = convertDataToNumericTimestamps(data);

  const renderTooltipContent = (o: any) => {
    const { payload, label } = o;
    if (!payload || payload.length === 0) {
      return null;
    }
    return (
      <div className="text-medium rounded-md border bg-background px-2 py-2 shadow-sm">
        <p className="text-xs text-muted-foreground">{formatTooltipLabel(label)}</p>
        <ul className="list">
          {payload.map((entry: any, index: any) => {
            let quantile = '';
            if (entry.dataKey === 'tokensPerSecP50') quantile = '50th';
            else if (entry.dataKey === 'tokensPerSecP95') quantile = '95th';
            return (
              <li key={`item-${index}`} style={{ color: entry.color }}>
                {`${quantile} percentile: ${Math.round(entry.value)} tokens/sec`}
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  const formatXAxis = (tickItem: number) => {
    const date = new Date(tickItem);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    });
  };

  const formatTooltipLabel = (label: number) => {
    const date = new Date(label);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false,
    });
  };

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={numericData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="ts"
          type="number"
          scale="time"
          domain={['auto', 'auto']}
          tickFormatter={formatXAxis}
          textAnchor="end"
          angle={-45}
          tick={{ fontSize: '10px' }}
          tickMargin={10}
          height={70}
        />
        <YAxis unit="tokens/sec" orientation="right" tick={{ fontSize: '10px' }} />
        <Tooltip content={renderTooltipContent} />
        <Legend verticalAlign="top" height={36} />
        <Line
          type="monotone"
          dataKey="tokensPerSecP50"
          stroke="var(--primary)"
          dot={false}
          name="50th Percentile"
          strokeWidth={2}
        />
        <Line
          type="monotone"
          dataKey="tokensPerSecP95"
          stroke="var(--secondary)"
          dot={false}
          name="95th Percentile"
          strokeWidth={2}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
