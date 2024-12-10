import { TokensDataProps } from "@/types/usage";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";


export function TokensBreakdownPlot({data}:{data:TokensDataProps[]}){
    const renderTooltipContent = (o:any) => {
        const { payload, label } = o;
        return (
          <div className="bg-background px-2 py-2 round-md border-1 shadow-sm text-medium">
            <ul className="list">
              {payload.map((entry:any, index:any) => (
                <li key={`item-${index}`} style={{ color: entry.color }}>
                  {`${entry.value}${entry.name == "total_completion_tokens" ? " output tokens" : " input tokens"}`}
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
          <YAxis orientation="right" tick={{fontSize: "10px"}}/>
          <Tooltip content={renderTooltipContent}/>
          <Bar type="monotone" dataKey={"total_completion_tokens"} fill={"#008000"} radius={[20,20,0,0]}/>
          <Bar type="monotone" dataKey={"total_prompt_tokens"} fill={"#9ca3af"} radius={[20,20,0,0]}/>
        </BarChart>
      </ResponsiveContainer>
    );
}