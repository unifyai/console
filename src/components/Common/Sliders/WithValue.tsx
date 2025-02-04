import { Label } from "@/components/UI/label";
import { Input } from "@/components/UI/input";
import { Slider } from "@/components/UI/slider";

const SliderWithValue = ({label, ticks, value, setValue, max, min}: {
    label: string
    ticks: number[],
    value: number,
    setValue: (value: number) => void
    max?: number,
    min?: number
}) => {

  const maximum = max ? max : Math.max(...ticks);
  const minimum = min ? min : Math.min(...ticks);

  const onChange = (e: any) => {
    const value = +e.currentTarget.value as number
    if (value < minimum)
      setValue(minimum)
    else if (value > maximum)
      setValue(maximum)
    else setValue(value)
  }
  return (
    <div className="flex flex-col gap-2 p-2 pb-4">
        <div className="flex items-center gap-10 justify-between">            
            <Label>{label}</Label>
            <Input 
              min={minimum}
              max={maximum}
              type="number" 
              value={value} 
              onChange={onChange}
              className="h-8 max-w-[80px]"
            />
        </div>
        <div className="flex flex-col grow w-full px-2">
            <span
                className="mb-2 flex w-full items-center justify-between gap-2 text-xs font-medium text-muted-foreground"
                aria-hidden="true"
            >
                <span>{minimum}</span>
                <span>{maximum}</span>
            </span>
            <Slider
                className="w-full"
                value={[value]}
                onValueChange={(value) => setValue(value[0])}
                min={minimum}
                max={maximum}
                aria-label="Slider with input"
            />
        </div>
    </div>
  );
}

export default SliderWithValue;
