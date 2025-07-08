"use client";

import { ZoomIn } from "lucide-react";
import ActionButton from "@/components/Common/Buttons/Action";

const PlotZoom = ({
  interactive = true,
  plotType,
  zoomEnabled,
  setZoomEnabled,
}: {
  interactive?: boolean;
  plotType: string;
  zoomEnabled: boolean;
  setZoomEnabled: ((enabled: boolean) => void) | undefined;
}) => {
  const isZoomSupported = plotType && ["Scatter Plot", "Line Chart"].includes(plotType);
  const disabled = !interactive || !isZoomSupported || !setZoomEnabled;
  const tooltip = `${zoomEnabled ? "Disable zooming" : isZoomSupported ? "Enable zooming" : "Zooming not supported"}`;
  const icon = <ZoomIn/>;
  const variant = zoomEnabled ? "primary" : undefined;
  const handleCheckedChange = (isChecked: boolean) => {
    if (!interactive || !isZoomSupported || !setZoomEnabled) return;
    setZoomEnabled(isChecked);
  };
  const onClick = () => handleCheckedChange(!zoomEnabled);
  return (
    <ActionButton 
        tooltip={tooltip} 
        side={"left"}
        icon={icon} 
        variant={variant} 
        disabled={disabled} 
        onClick={onClick}
    />
  );
};

export default PlotZoom;