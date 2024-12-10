import { cn } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/UI/card"
import { ReactNode } from "react"

interface CardProps extends React.ComponentProps<typeof Card> {
    title: string,
    description?: ReactNode,
    footer?: ReactNode
}

export default function BaseCard ({ title, description, footer, children, className, ...props }: CardProps) {
  return (
    <Card className={cn("w-full", className)} {...props}>
      <CardHeader>
        <CardTitle className="text-foreground">{title}</CardTitle>
        {description && <CardDescription className="text-muted-foreground">{description}</CardDescription>}
      </CardHeader>
      <CardContent className="grid gap-4 text-foreground">
        {children}
      </CardContent>
      {footer && <CardFooter> {footer} </CardFooter>}
    </Card>
  )
}
