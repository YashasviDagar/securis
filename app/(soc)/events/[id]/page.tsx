import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EventDetailView } from "@/components/events/event-detail";
import { requirePermission } from "@/auth/current-user";
import { getEventById } from "@/server/services/event-service";

export const metadata: Metadata = { title: "Event · Securis" };

/**
 * /events/[id] - Event detail.
 *
 * Server component. Loads the full event record plus its related alerts and
 * incidents. Unknown ids render the 404 page.
 *
 * Connection: server/services/event-service.ts (getEventById).
 */

export const dynamic = "force-dynamic";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("events:read");

  const { id } = await params;
  const event = await getEventById(id);
  if (!event) notFound();

  return <EventDetailView event={event} />;
}
