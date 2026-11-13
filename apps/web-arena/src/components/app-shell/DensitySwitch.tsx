"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/shadcn/toggle-group";
import { type Density, useDensity } from "@/lib/density";
import { cn } from "@/lib/utils";

const ITEM =
  "h-8 rounded-[1px] border-0 px-3 font-sans text-[12.5px] leading-none font-medium text-bone-2 shadow-none transition-colors duration-200 hover:bg-transparent hover:text-bone focus-visible:ring-0 data-[state=on]:bg-bone data-[state=on]:text-ink data-[spacing=0]:first:rounded-l-[1px] data-[spacing=0]:last:rounded-r-[1px]";

/**
 * Simple / Pro, styled like the landing's Plain / Precise control: two joined
 * buttons in one 1px outline, the pressed one filled bone.
 */
export function DensitySwitch({ className }: { className?: string }) {
  const [density, setDensity] = useDensity();
  return (
    <ToggleGroup
      type="single"
      value={density}
      // Radix sends "" when the pressed item is clicked again; keep the choice.
      onValueChange={(v) => v && setDensity(v as Density)}
      aria-label="Density"
      title="Simple shows the essentials. Pro reveals every advanced panel."
      className={cn("h-[34px] gap-0 rounded-[2px] border border-rule-2 p-px shadow-none", className)}
    >
      <ToggleGroupItem value="simple" className={ITEM}>
        Simple
      </ToggleGroupItem>
      <ToggleGroupItem value="pro" className={ITEM}>
        Pro
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
