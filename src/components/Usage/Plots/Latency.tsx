import { LatencyDataProps } from "@/types/usage";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";


export function LatencyPlot({data}:{data:LatencyDataProps[]}){  
    const renderTooltipContent = (o:any) => {
        const { payload, label } = o;
        return (
          <div className="bg-background px-2 py-2 round-md border-1 shadow-sm text-medium">
            <ul className="list">
              {payload.map((entry:any, index:any) => (
                <li key={`item-${index}`} style={{ color: entry.color }}>
                  {`${entry.name == "generation_time_p50" ? "50" : "95"}% of answers took ${Math.round(entry.value)}ms to generate`}
                </li>
              ))}
            </ul>
          </div>
        );
      };
    return(
        <ResponsiveContainer width="100%" height="100%">
        <BarChart width={500} height={300} data={data} syncId="Id">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={"ts"} textAnchor="end" angle={-5}  tick={{fontSize: "10px"}}  tickMargin={10}/>
            <YAxis unit="ms" orientation="right" tick={{fontSize: "10px"}}/>7
            <Tooltip content={renderTooltipContent}/>
            <Bar stackId={"latency"} type="monotone" dataKey={"generation_time_p50"} fill={"#9ca3af"} />
            <Bar stackId={"latency"} type="monotone" dataKey={"generation_time_p95"} fill={"#008000"} radius={[20,20,0,0]}/>
        </BarChart>
        </ResponsiveContainer>
    );
  }
