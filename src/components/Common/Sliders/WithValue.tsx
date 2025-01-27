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

  return (
    <div className="flex flex-col gap-2 p-2 pb-3">
        <div className="flex items-center gap-5 justify-between">            
            <Label>{label}</Label>
            <Input 
              type="number" 
              value={value} 
              onChange={(e) => setValue(+e.currentTarget.value)}
              className="h-8 max-w-[50px]"
            />
        </div>
        <Slider value={[value]} max={maximum} min={minimum} aria-label="Slider with ticks" onValueChange={(v) => setValue(v[0])} />
    </div>
  );
}

export default SliderWithValue;
