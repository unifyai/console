import * as React from "react";
import * as d3Chromatic from "d3-scale-chromatic";
import { cn } from "@/lib/utils";
import ActionButton from "@/components/Common/Buttons/Action";
import { BasePopover } from "../Popovers/Base";
import { Dialog, DialogContent, DialogTrigger } from "@/components/UI/dialog";
import { Palette } from "lucide-react";

// Prepare the data structure
const d3CategoricalSchemeNames = [
    'schemeCategory10', 'schemeAccent', 'schemeDark2', 'schemePaired','schemePastel1', 'schemePastel2', 'schemeSet1', 'schemeSet2','schemeSet3', 'schemeTableau10'
] as const;
type CategoricalSchemeName = typeof d3CategoricalSchemeNames[number];
const colorSchemes = d3CategoricalSchemeNames.map(name => {
    let palette: string[] | undefined;
    const schemeData = d3Chromatic[name];
    if (Array.isArray(schemeData)) {
        palette = schemeData as string[];
    } else if (typeof schemeData === 'object' && schemeData !== null) {
        const lengths = Object.keys(schemeData).map(Number).sort((a, b) => b - a);
        if (lengths.length > 0) {
            palette = (schemeData as any)[lengths[0]] as string[];
        }
    }

    return {
        name: name,
        displayName: name.replace('scheme', ''),
        palette: palette || [], // Ensure palette is always an array
    };
}).filter(scheme => scheme.palette.length > 0); // Filter out any potentially undefined/empty schemes

// --- ColorSchemePicker Component ---
interface ColorSchemePickerProps {
    /** The currently selected scheme name (controlled component) */
    value?: CategoricalSchemeName | string;
    /** Callback function when the selection changes */
    onChange?: (value: CategoricalSchemeName) => void;
    /** Placeholder text for the trigger button when no value is selected */
    placeholder?: string;
     /** Optional additional className for the PopoverContent */
    contentClassName?: string;
    /** Optional className for the container of each scheme row inside the popover */
    rowClassName?: string;
    /** Optional className for the palette container within each row */
    paletteClassName?: string;
     /** Optional className for individual color swatches */
    swatchClassName?: string;
    /** Whether to use Dialog instead of Popover (for dropdown nesting conflicts) */
    useDialog?: boolean;
}
export function ColorSchemePicker({
    value,
    onChange,
    placeholder = "Select a color scheme",
    contentClassName,
    rowClassName,
    paletteClassName,
    swatchClassName,
    useDialog = false
}: ColorSchemePickerProps) {
    const [isOpen, setIsOpen] = React.useState(false);

    // Memoize the selected scheme details
    const selectedScheme = React.useMemo(() => {
        return colorSchemes.find(s => s.name === value);
    }, [value]);

    // Handler for when a scheme is clicked in the popover/dialog
    const handleSchemeSelect = (schemeName: CategoricalSchemeName) => {
        if (onChange) {
            onChange(schemeName);
        }
        setIsOpen(false);
    };

    const colorSchemeContent = (
        <div className="grid gap-2">
            {colorSchemes.map((scheme) => (
                <button
                    key={scheme.name}
                    onClick={() => handleSchemeSelect(scheme.name)}
                    className={cn(
                        "flex items-center justify-between w-full text-left p-2 rounded-md hover:bg-accent cursor-pointer text-sm",
                        value === scheme.name && "bg-accent font-semibold",
                        rowClassName
                    )}
                    aria-label={`Select ${scheme.displayName} color scheme`}
                >
                    {/* Display user-friendly name */}
                    <span className="mr-4 flex-shrink-0">{scheme.displayName}</span>

                    {/* Display color palette swatches */}
                    <div className={cn("flex space-x-1 overflow-hidden justify-end flex-wrap", paletteClassName)}>
                        {scheme.palette.map((color, index) => (
                            <div
                                key={`${scheme.name}-swatch-${index}`}
                                className={cn(
                                    "h-4 w-4 rounded-sm flex-shrink-0",
                                    swatchClassName
                                )}
                                style={{ backgroundColor: color }}
                                title={color}
                            />
                        ))}
                    </div>
                </button>
            ))}
        </div>
    );

    if (useDialog) {
        return (
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogTrigger asChild>
                    <ActionButton icon={<Palette/>} tooltip={placeholder} side="left"/>
                </DialogTrigger>
                <DialogContent className="w-[25rem] max-h-[30rem] overflow-auto">
                    <div className="pb-4">
                        <h3 className="text-lg font-semibold mb-4">Select Color Scheme</h3>
                        {colorSchemeContent}
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <BasePopover 
            open={isOpen} 
            setOpen={setIsOpen}
            button={<ActionButton icon={<Palette/>} tooltip={placeholder} side="left"/>}
        >
            {colorSchemeContent}
        </BasePopover>
    );
}