"use client";

import { Label } from "@/components/UI/label";
import { Switch } from "@/components/UI/switch";
import { TbEaseInOutControlPoints } from "react-icons/tb";
import Tooltip from "@/components/Common/Misc/Tooltip";

const triggerStyles = "flex flex-1 items-center gap-2 py-1 text-label hover:underline rounded transition-colors cursor-pointer";

const PlotRegression = ({
  interactive = true,
  plotType,
  showRegression,
  setShowRegression,
}: {
  interactive?: boolean;
  plotType: string;
  showRegression: string;
  setShowRegression: ((x: string) => void) | undefined;
}) => {
  // Only show regression option for Scatter Plots
  if (plotType !== "Scatter Plot") {
    return null;
  }

  const handleCheckedChange = (isChecked: boolean) => {
    if (!interactive || !setShowRegression) return;
    setShowRegression(isChecked ? "true" : "false");
  };

  const isChecked = showRegression === "true";

  return (
    <div className="flex items-center justify-between py-1.5">
      <Tooltip content="Draw the line of best fit, and one line per group if grouping is applied." side="left">
        <Label htmlFor="regression-switch" className={triggerStyles} style={{ opacity: interactive ? 1 : 0.7 }}>
          <TbEaseInOutControlPoints size={20} />
          <span>Regression Line</span>
        </Label>
      </Tooltip>
      <Switch
        id="regression-switch"
        checked={isChecked}
        onCheckedChange={handleCheckedChange}
        disabled={!interactive}
      />
    </div>
  );
};

export default PlotRegression;