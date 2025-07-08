"use client"

import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"
import { getSession, signOut } from "next-auth/react"
import { Button } from "@/components/UI/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/UI/tooltip"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/UI/alert-dialog"

const SignOutButton = () => {

  const router = useRouter();

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push("/login");
  }
  
  return (
    <AlertDialog>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <AlertDialogTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm"
                className="hover:bg-destructive hover:text-destructive-foreground transition-colors w-8 h-8"
              >
                <LogOut className="h-[1.2rem] w-[1.2rem]" />
                <span className="sr-only">Sign out</span>
              </Button>
            </AlertDialogTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>Sign out</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure you want to sign out?</AlertDialogTitle>
          <AlertDialogDescription>
            You will be redirected to the home page after signing out.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleSignOut}>Sign Out</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export default SignOutButton