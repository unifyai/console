import { Sun, Moon, SunMoon } from "lucide-react"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { Button } from "@/components/UI/button"

const DarkModeToggle = () => {
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()

  useEffect(() => setMounted(true), [])

  if (!mounted) return null

  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark')
    else setTheme('light')
  }

  return (
    <Button 
      variant="ghost" 
      size="sm"
      onClick={cycleTheme}
      className="hover:bg-primary hover:text-primary-foreground relative"
    >
      <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 system:scale-0" />
      <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 system:scale-0" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}

export default DarkModeToggle