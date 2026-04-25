import "server-only";

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth/auth-options";

export async function getAppSession() {
  return getServerSession(authOptions);
}

export async function requireAppSession() {
  const session = await getAppSession();

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=%2Fapp");
  }

  return session;
}
