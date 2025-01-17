import { Label } from "@/components/UI/label";
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
    <div className="flex flex-col gap-2 p-2">
        <div className="flex items-center gap-2 justify-between">            
            <Label>{label}</Label>
            <output className="text-sm font-medium tabular-nums">{value}</output>
        </div>
        <Slider value={[value]} max={maximum} min={minimum} aria-label="Slider with ticks" onValueChange={(v) => setValue(v[0])} />
    </div>
  );
}

export default SliderWithValue;
