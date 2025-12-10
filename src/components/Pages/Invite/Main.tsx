"use client";

import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/UI/button";
import Link from "next/link";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { ResponseProps } from "@/types/common";

interface MainProps {
  token: string;
  onAccept: (token: string) => Promise<void | ResponseProps | any>;
}

const Main = ({ token, onAccept }: MainProps) => {
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [message, setMessage] = useState("");
  const processedRef = useRef(false);

  useEffect(() => {
    // Prevent double-execution in React Strict Mode
    if (processedRef.current) return;
    processedRef.current = true;

    const processInvite = async () => {
      try {
        const result = await onAccept(token);

        if (result && typeof result === "object" && "detail" in result) {
          setStatus("error");
          setMessage(result.detail as string);
        } else {
          setStatus("success");
        }
      } catch (error) {
        setStatus("error");
        setMessage("An unexpected error occurred.");
      }
    };

    processInvite();
  }, [token, onAccept]);

  return (
    <div className="max-w-md w-full text-center space-y-6 p-8 rounded-xl border bg-card shadow-sm">
      <div className="flex justify-center mb-4">
        <span className="font-bold text-2xl">Unify</span>
      </div>

      {status === "processing" && (
        <>
          <Loader2 className="h-16 w-16 text-primary mx-auto animate-spin" />
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Joining Organization...</h1>
            <p className="text-muted-foreground">Please wait while we process your invitation.</p>
          </div>
        </>
      )}

      {status === "success" && (
        <>
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Welcome!</h1>
            <p className="text-muted-foreground">You have successfully joined the organization.</p>
          </div>
          <div className="pt-4">
            <Link href="/organization">
              <Button className="w-full">Go to Organization</Button>
            </Link>
          </div>
        </>
      )}

      {status === "error" && (
        <>
          <XCircle className="h-16 w-16 text-destructive mx-auto" />
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Invitation Failed</h1>
            <p className="text-muted-foreground">{message}</p>
          </div>
          <div className="pt-4">
            <Link href="/organization">
              <Button variant="outline" className="w-full">Return to Console</Button>
            </Link>
          </div>
        </>
      )}
    </div>
  );
};

export default Main;