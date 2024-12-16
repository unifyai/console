import { LatencyDataProps } from "@/types/usage";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export function LatencyPlot({ data }: { data: LatencyDataProps[] }) {
  const renderTooltipContent = (o: any) => {
    const { payload, label } = o;
    if (!payload || payload.length === 0) {
      return null;
    }
    return (
      <div className="bg-background px-2 py-2 rounded-md border shadow-sm text-medium">
        <p className="text-xs text-muted-foreground">{formatTooltipLabel(label)}</p>
        <ul className="list">
          {payload.map((entry: any, index: any) => {
            let quantile = "";
            if (entry.dataKey === "generation_time_p50") quantile = "50th";
            else if (entry.dataKey === "generation_time_p95") quantile = "95th";
            return (
              <li key={`item-${index}`} style={{ color: entry.color }}>
                {`${quantile} percentile: ${Math.round(entry.value)} ms`}
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  const formatXAxis = (tickItem: any) => {
    const date = new Date(tickItem);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    });
  };

  const formatTooltipLabel = (label: any) => {
    const date = new Date(label);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hour12: false,
    });
  };

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart
        data={data}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="ts"
          tickFormatter={formatXAxis}
          textAnchor="end"
          angle={-45}
          tick={{ fontSize: "10px" }}
          tickMargin={10}
          height={70}
        />
        <YAxis unit="ms" orientation="right" tick={{ fontSize: "10px" }} />
        <Tooltip content={renderTooltipContent} />
        <Legend verticalAlign="top" height={36} />
        <Line
          type="monotone"
          dataKey="generation_time_p50"
          stroke="var(--primary)"
          dot={false}
          name="50th Percentile"
          strokeWidth={2}
        />
        <Line
          type="monotone"
          dataKey="generation_time_p95"
          stroke="var(--secondary)"
          dot={false}
          name="95th Percentile"
          strokeWidth={2}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}