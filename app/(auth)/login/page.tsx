import type { Metadata } from "next";
import Link from "next/link";
import { Info, ShieldHalf } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Sign in · Securis" };

/**
 * /login - Authentication entry point.
 *
 * Phase 1 status: the secure authentication system (Argon2id password hashing,
 * database-backed sessions, login rate limiting and RBAC) is implemented in
 * Phase 3. Rather than shipping a login form that silently does nothing, this
 * screen honestly reports its status and offers a working link into the
 * console.
 *
 * Phase 3 replaces this file with the real credentials form posting to the
 * server-side session endpoint.
 */
export default function LoginPage() {
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

      <CardContent className="space-y-4">
        <Alert>
          <Info className="size-4" aria-hidden="true" />
          <AlertTitle>Authentication arrives in Phase 3</AlertTitle>
          <AlertDescription>
            Secure sign-in with hashed credentials, server-side sessions and
            role-based access control is implemented in Phase 3. Until then the
            console runs in unauthenticated foundation mode.
          </AlertDescription>
        </Alert>

        <Button asChild className="w-full">
          <Link href="/dashboard">Open the console</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
