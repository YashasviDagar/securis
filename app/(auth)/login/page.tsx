import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldHalf } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentSession } from "@/auth/current-user";

export const metadata: Metadata = { title: "Sign in · Securis" };

/**
 * /login - Authentication entry point.
 *
 * Server component. If a valid session already exists the operator is sent
 * straight to the dashboard, so the login form is never shown to an
 * authenticated user. The credential check itself happens in
 * `/api/auth/login` (see components/auth/login-form.tsx).
 *
 * Connection: auth/current-user.ts (session lookup) and the login API route.
 */
export default async function LoginPage() {
  const session = await getCurrentSession();
  if (session) {
    redirect("/dashboard");
  }

  return (
    <Card className="border-border/60 shadow-lg">
      <CardHeader className="items-center text-center">
        <div className="mb-1 flex size-10 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/30">
          <ShieldHalf className="size-5" aria-hidden="true" />
        </div>
        <CardTitle className="text-base">Sign in to Securis</CardTitle>
        <CardDescription>
          Security Information and Event Management console
        </CardDescription>
      </CardHeader>

      <CardContent>
        <LoginForm />
      </CardContent>
    </Card>
  );
}
