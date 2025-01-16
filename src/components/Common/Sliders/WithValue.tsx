import { Label } from "@/components/UI/label";
import { Slider } from "@/components/UI/slider";

const SliderWithValue = ({ticks, value, setValue}: {
    ticks: number[],
    value: number,
    setValue: (value: number) => void
}) => {

  const max = Math.max(...ticks);
  const min = Math.min(...ticks);

  return (
    <div className="flex flex-col gap-2 p-2">
        <div className="flex items-center gap-2 justify-between">            
            <Label>Current:</Label>
            <output className="text-sm font-medium tabular-nums">{value}</output>
        </div>
        <Slider value={[value]} max={max} min={min} aria-label="Slider with ticks" onValueChange={(v) => setValue(v[0])} />
    </div>
  );
}

export default SliderWithValue;
