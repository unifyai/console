import { getCurrentUser } from "@/lib/user/user";
import { redirect } from "next/navigation";
import { Button } from "@/components/UI/button";
import Link from "next/link";
import { XCircle } from "lucide-react";
import Main from "@/components/Pages/Invite/Main";
import { acceptInviteAction } from "@/lib/user/organization";

interface InvitePageProps {
  searchParams: { token?: string };
}

export default async function InvitePage({ searchParams }: InvitePageProps) {
  const token = searchParams.token;

  // 1. Validate Token Presence
  if (!token) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
        <div className="max-w-md w-full text-center space-y-4 p-8 rounded-xl border bg-card shadow-sm">
            <XCircle className="h-12 w-12 text-destructive mx-auto" />
            <h1 className="text-2xl font-bold">Invalid Invitation</h1>
            <p className="text-muted-foreground">The invitation link is missing a token.</p>
            <Link href="/">
                <Button>Go Home</Button>
            </Link>
        </div>
      </div>
    );
  }

  // 2. Check Authentication
  const user = await getCurrentUser();

  if (!user) {
    // Redirect to login, ensuring we return to this invite page afterwards
    const callbackUrl = `/invite?token=${token}`;
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  // 3. Initialize Server Action with API Key
  const acceptAction = await acceptInviteAction(user.apiKey);

  // 4. Render Client View
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
        <Main token={token} onAccept={acceptAction} />
    </div>
  );
}