
import { Button } from "@/components/UI/button"
import { ReactNode } from "react";
import { MouseEventHandler } from "react";
export default function BaseButton ({text, icon, variant, disabled = false, type, size = "sm", onClick, className}: {
    text?: string,
    variant?: "default" | "primary" | "secondary" | "destructive" | "outline" | "ghost" | "link",
    icon?: ReactNode,
    disabled?: boolean,
    type?: "submit" | "reset" | "button" | undefined,
    size?: "icon" | "default" | "sm" | "lg" | null | undefined,
    onClick?: MouseEventHandler<HTMLButtonElement>,
    className?: string
}) {
  return (
    <Button disabled={disabled} variant={variant} size={size} type={type} onClick={onClick} className={className}>
      {icon} {text}
    </Button>
  )
}
