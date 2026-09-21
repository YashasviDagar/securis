import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";

/**
 * Securis - Not found page
 *
 * Rendered for unknown routes. It offers a real link back to the dashboard.
 *
 * Connection: global 404 handler for the App Router.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6">
      <EmptyState
        icon={SearchX}
        title="Page not found"
        description="The route you requested does not exist in the Securis console."
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard">Return to dashboard</Link>
          </Button>
        }
      />
    </div>
  );
}
