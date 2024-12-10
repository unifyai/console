import { ThroughputDataProps } from "@/types/usage";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";


export function ThroughputPlot({data}:{data:ThroughputDataProps[]}){  
    const renderTooltipContent = (o:any) => {
        const { payload, label } = o;
        return (
          <div className="bg-background px-2 py-2 round-md border-1 shadow-sm text-medium">
            <ul className="list">
              {payload.map((entry:any, index:any) => (
                <li key={`item-${index}`} style={{ color: entry.color }}>
                  {`${entry.name == "tokens_per_sec_p50" ? "50" : "95"}% of answers hit ${Math.round(entry.value)} tks/sec`}
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
            <YAxis unit="Tks/sec" orientation="right" tick={{fontSize: "10px"}}/>
            <Tooltip content={renderTooltipContent}/>
            <Bar stackId={"throughput"} type="monotone" dataKey={"tokens_per_sec_p50"} fill={"#9ca3af"} />
            <Bar stackId={"throughput"} type="monotone" dataKey={"tokens_per_sec_p95"} fill={"#008000"} radius={[20,20,0,0]}/>
        </BarChart>
        </ResponsiveContainer>
    );
}