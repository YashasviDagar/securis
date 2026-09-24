import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RuleDetailView } from "@/components/detection-rules/rule-detail";
import { requirePermission } from "@/auth/current-user";
import { getRuleById } from "@/server/services/rule-service";

export const metadata: Metadata = { title: "Detection Rule · Securis" };

/**
 * /detection-rules/[id] - Detection rule detail.
 *
 * Server component. Shows the rule's condition and the alerts it produced.
 * Administrator-only.
 *
 * Connection: server/services/rule-service.ts (getRuleById).
 */

export const dynamic = "force-dynamic";

export default async function DetectionRuleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("rules:write");

  const { id } = await params;
  const rule = await getRuleById(id);
  if (!rule) notFound();

  return <RuleDetailView rule={rule} canWrite />;
}
