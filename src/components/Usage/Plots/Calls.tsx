import { CallsDataProps } from "@/types/usage";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";


export function CallsPlot({data}:{data: CallsDataProps[]}) {
    const renderTooltipContent = (o:any) => {
        const { payload, label } = o;
        return (
          <div className="bg-background px-2 py-2 round-md border-1 shadow-sm text-medium">
            <ul className="list">
              {payload.map((entry:any, index:any) => (
                <li key={`item-${index}`} style={{ color: entry.color }}>
                  {`${entry.value} calls`}
                </li>
              ))}
            </ul>
          </div>
        );
      }; 
    return (
       <ResponsiveContainer width="100%" height="100%">
         <LineChart width={500} height={300} data={data} syncId="Id">
           <CartesianGrid strokeDasharray="3 3" />
           <XAxis dataKey={"ts"} textAnchor="end" angle={-5}  tick={{fontSize: "10px"}}  tickMargin={10}/>
           <YAxis orientation="right" tick={{fontSize: "10px"}}/>
           <Tooltip content={renderTooltipContent}/>
           <Line type="monotone" dataKey={"request_count"} stroke="#008000" activeDot={{ r: 8 }}/>
         </LineChart>
       </ResponsiveContainer>
    );
} 