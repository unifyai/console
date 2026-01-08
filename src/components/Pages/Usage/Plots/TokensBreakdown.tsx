import { TokensDataProps } from '@/types/usage';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

function convertDataToNumericTimestamps(data: TokensDataProps[]) {
  return data.map((d) => ({
    ...d,
    ts: new Date(d.ts).getTime(),
  }));
}

export function TokensBreakdownPlot({ data }: { data: TokensDataProps[] }) {
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
          {payload.map((entry: any, index: any) => (
            <li key={`item-${index}`} style={{ color: entry.color }}>
              {`${entry.value} ${
                entry.dataKey === 'totalCompletionTokens' ? 'output tokens' : 'input tokens'
              }`}
            </li>
          ))}
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
      <BarChart data={numericData}>
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
        <YAxis orientation="right" tick={{ fontSize: '10px' }} />
        <Tooltip content={renderTooltipContent} />
        <Legend verticalAlign="top" height={36} />
        <Bar dataKey="totalPromptTokens" stackId="a" fill="var(--secondary)" name="Input Tokens" />
        <Bar
          dataKey="totalCompletionTokens"
          stackId="a"
          fill="var(--primary)"
          name="Output Tokens"
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
