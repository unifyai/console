/* eslint-disable react-hooks/exhaustive-deps */
import React, { ReactNode, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/UI/popover';
import { Dialog, DialogContent, DialogTrigger } from '@/components/UI/dialog';
import { Pipette, Plus, RotateCcw } from 'lucide-react';
import { RgbaColorPicker } from 'react-colorful';
import { debounce } from '@/utils/misc/debounce';
import { Button } from '@/components/UI/button';
import { Input } from '@/components/UI/input';

const DEFAULT_CHILDREN = (
  <div className="from-[color:var(--role-green)]/20 via-[color:var(--role-purple)]/20 to-[color:var(--role-blue)]/20 flex aspect-square h-fit w-fit items-center justify-center rounded-full bg-gradient-to-br p-[0.2rem] md:p-[0.2vw]">
    <div className="flex aspect-square h-[2rem] items-center justify-center rounded-full bg-gradient-to-br from-[color:var(--role-green)] via-[color:var(--role-purple)] to-[color:var(--role-blue)] md:h-[2vw]">
      <Pipette className="aspect-square w-[1rem] text-[color:var(--ink)] md:w-[1vw]" />
    </div>
  </div>
);

// Get the primary color from CSS variables as default
const getDefaultColor = (): string => {
  try {
    const primaryColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--primary')
      .trim();
    if (primaryColor) {
      // Convert CSS color to hex if it's not already
      const div = document.createElement('div');
      div.style.color = primaryColor;
      document.body.appendChild(div);
      const computedColor = getComputedStyle(div).color;
      document.body.removeChild(div);

      // Convert rgb to hex
      const match = computedColor.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
      if (match) {
        const r = parseInt(match[1]);
        const g = parseInt(match[2]);
        const b = parseInt(match[3]);
        return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
      }
      return primaryColor.startsWith('#') ? primaryColor : 'var(--role-green-deep)';
    }
  } catch (e) {
    console.warn('Failed to get primary color from CSS variables');
  }
  return 'var(--role-green-deep)';
};

type TColorPicker = {
  value: string;
  onChange: (value: string) => void;
  handleAdd?: (value: string) => void;
  children?: React.ReactNode;
  useDialog?: boolean;
  showReset?: boolean;
  onReset?: () => void;
};

const ColorPicker: React.FC<TColorPicker> = ({
  value,
  onChange,
  handleAdd,
  children = DEFAULT_CHILDREN,
  useDialog = false,
  showReset = false,
  onReset,
}) => {
  // Ensure we always have a valid color value
  const safeValue = useMemo(() => {
    if (value && typeof value === 'string' && value.trim() !== '') {
      return value.trim();
    }
    return getDefaultColor();
  }, [value]);

  const color = useMemo(() => {
    const rgba = hexToRgba(safeValue);
    return { hex: safeValue, alpha: rgba ? rgba.a : 1 };
  }, [safeValue]);

  const debouncedOnChange = useMemo(
    () => debounce((newValue: string) => onChange(newValue), 50),
    [onChange]
  );

  const handleChangeAlpha = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newAlpha = parseFloat(e.target.value);
    const rgba = hexToRgba(color.hex);
    if (rgba) {
      const newHex = rgbaToHex(rgba.r, rgba.g, rgba.b, newAlpha);
      onChange(newHex);
    }
  };

  const handleChangeColor = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newColor: any = e.target.value;
    onChange(newColor);
  };

  function rgbaToHex(r: number, g: number, b: number, a: number = 1) {
    const toHex = (n: number) => {
      let hex = n.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };

    const alpha = isNaN(a) ? 255 : Math.round(a * 255);

    return `#${toHex(r)}${toHex(g)}${toHex(b)}${alpha === 255 ? '' : toHex(alpha)}`;
  }

  function hexToRgba(hex: string) {
    if (!hex) return null;
    hex = hex.replace(/^#/, '');

    if (hex.length === 3) {
      hex = hex
        .split('')
        .map((char) => char + char)
        .join('');
    }

    if (hex.length !== 6 && hex.length !== 8) return null;

    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const a = hex.length === 8 ? parseInt(hex.substring(6, 8), 16) / 255 : 1;

    return { r, g, b, a };
  }

  const handleColorChange = useCallback(
    (newColor: { r: number; g: number; b: number; a: number }) => {
      const { r, g, b, a } = newColor;
      const newHex = rgbaToHex(r, g, b, a);
      debouncedOnChange(newHex);
    },
    [debouncedOnChange]
  );

  const ColorPickerContent = () => (
    <div className="h-fit max-h-[25rem] w-[18rem]">
      <div className="flex size-full flex-col items-center justify-between">
        <RgbaColorPicker
          color={hexToRgba(color.hex) || { r: 42, g: 134, b: 42, a: 1 }}
          onChange={handleColorChange}
          className="aspect-square !w-full"
        />
        <div className="mt-[0.5rem] flex w-full flex-col items-center gap-[1.5rem] md:mt-[0.5vw] md:gap-[1.5vw]">
          <div className="flex h-[2.5rem] w-full items-center justify-center md:h-[2.5vw]">
            <label className="mr-[0.5rem] md:mr-[0.5vw]">HEX</label>
            <Input
              className="w-full !rounded-r-none !tracking-widest"
              value={color.hex}
              onChange={handleChangeColor}
            />
            <Input
              type="text"
              min="0"
              max="1"
              step="0.01"
              value={color.alpha.toFixed(2)}
              onChange={handleChangeAlpha}
              className="w-[5rem] !rounded-l-none !pr-0 tracking-widest md:w-[5vw]"
            />
          </div>
          <div className="flex w-full items-center gap-2">
            {handleAdd && (
              <Button className="flex-1 gap-0" onClick={() => handleAdd(safeValue)}>
                <Plus className="aspect-square h-4 md:h-[1.2vw]" />
                Add New Colour
              </Button>
            )}
            {showReset && onReset && (
              <Button variant="outline" size="sm" onClick={onReset} className="gap-1">
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (useDialog) {
    return (
      <Dialog>
        <DialogTrigger asChild>{children}</DialogTrigger>
        {typeof window !== 'undefined' &&
          createPortal(
            <DialogContent className="w-fit max-w-none">
              <ColorPickerContent />
            </DialogContent>,
            document.body
          )}
      </Dialog>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="center" side="top" className="w-fit max-w-none">
        <ColorPickerContent />
      </PopoverContent>
    </Popover>
  );
};

export default ColorPicker;
