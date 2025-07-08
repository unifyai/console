"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import LoadingScreen from "@/components/Layout/LoadingScreen";
import { getCurrentUser } from "@/lib/user/user";
import { User } from "@/types/user";

const initializeUser = async (): Promise<User> => {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Not found");
  }
  return user;
};

export default function Home() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const redirectUser = async () => {
      try {
        const user = await initializeUser();
        const redirectUrl = "/interfaces";
        router.push(redirectUrl);
      } catch (error) {
        console.error("Error initializing user:", error);
        router.push("/login");
      } finally {
        setIsLoading(false);
      }
    };

    redirectUser();
  }, [router]);

  return isLoading ? <LoadingScreen /> : null;
}
