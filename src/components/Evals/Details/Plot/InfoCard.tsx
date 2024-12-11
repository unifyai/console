import { LogProps, LogItemProps } from "@/types/evals/logs";

/* TODO: Replace with shadcn hovercard */

const InfoCard = ({position, data, dimensions, selectedXAxisProperty, selectedYAxisProperty, margins}:{
    position:{x: number, y:number}, 
    data: LogProps,
    selectedXAxisProperty: string,
    selectedYAxisProperty: string,
    dimensions: {width: number, height: number},
    margins: number[]
  }) => {
      const plotHeight = dimensions.height;
      const plotWidth = dimensions.width;
      const [marginTop, marginRight, marginBottom, marginLeft] = margins;
      return (
          <div 
              className="absolute z-10 rounded-lg bg-background py-4 px-6 flex flex-col gap-2 max-w-[500px] max-h-[300px] overflow-hidden"
              style={{ 
                  top: position.y < plotHeight / 2 
                      ? position.y + 0.01 * plotHeight + marginBottom
                      : position.y - 0.1 * plotHeight - marginTop,
                  left: position.x < plotWidth / 2 
                      ? position.x + 0.01 * plotWidth + marginLeft
                      : position.x - 0.1 * plotWidth - marginRight
              }}
          >
              <div className="flex flex-row gap-5 justify-between">
                  <p className="font-semibold">Log ID</p>
                  {data.id}
              </div>
              <div className="flex flex-col">
                  <div className="flex flex-row gap-5 justify-between">
                      <p className="font-semibold">{selectedXAxisProperty}</p>
                      <p className="truncate ... whitespace-pre-wrap max-w-[400px]">{
                        selectedXAxisProperty === "Log Time" ? data.ts :
                        data.entries[selectedXAxisProperty as keyof LogItemProps].toString().slice(0,80)
                      }</p>
                  </div>
                  <div className="flex flex-row gap-5 justify-between">
                      <p className="font-semibold">{selectedYAxisProperty}</p>
                      <p className="truncate ... whitespace-pre-wrap max-w-[400px]">{data.entries[selectedYAxisProperty as keyof LogItemProps].toString().slice(0,80)}</p>
                  </div>
              </div>
          </div>
      );
  };

export default InfoCard;
