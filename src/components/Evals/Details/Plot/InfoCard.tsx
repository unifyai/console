import { formatNumber } from "@/utils/formatNumber";
import { InfoCardData, InfoCardPosition } from "@/types/evals/plot";

const InfoCard = ({position, data, dimensions, margins}:{
    position: InfoCardPosition, 
    data: InfoCardData,
    dimensions: {width: number, height: number},
    margins: number[]
  }) => {
      const plotHeight = dimensions.height;
      const plotWidth = dimensions.width;
      const [marginTop, marginRight, marginBottom, marginLeft] = margins;
      return (
          <div 
              className="absolute z-10 shadow-md rounded-lg bg-background py-4 px-6 flex flex-col gap-2 max-w-[500px] max-h-[300px] overflow-hidden"
              style={{ 
                  top: position.y < plotHeight / 2 
                      ? position.y + 0.01 * plotHeight + marginBottom
                      : position.y - 0.1 * plotHeight - marginTop,
                  left: position.x < plotWidth / 2 
                      ? position.x + 0.01 * plotWidth + marginLeft
                      : position.x - 0.1 * plotWidth - marginRight
              }}
          >
              <div className="flex flex-col">
                  <div className="flex flex-row gap-5 justify-between">
                      <p className="font-semibold">{data.x.name}</p>
                      <p className="truncate ... whitespace-pre-wrap max-w-[400px]">
                        {typeof data.x.value === "number" ? formatNumber(data.x.value) : data.x.value}
                      </p>
                  </div>
                  <div className="flex flex-row gap-5 justify-between">
                      <p className="font-semibold">{data.y.name}</p>
                      <p className="truncate ... whitespace-pre-wrap max-w-[400px]">
                        {formatNumber(data.y.value)}
                      </p>
                  </div>
              </div>
          </div>
      );
  };

export default InfoCard;
