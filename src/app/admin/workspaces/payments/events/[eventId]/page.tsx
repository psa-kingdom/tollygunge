import { notFound, redirect } from "next/navigation";
import { currentActor } from "@/lib/actor";
import { hasPermission } from "@/domain/access";
import { financeEventExists } from "@/lib/finance-events";
import { FinanceWorkspace } from "@/components/payments-workspace";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Event finance",
  robots: { index: false, follow: false },
};
export default async function EventFinancePage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  if (!hasPermission(actor.roles, "payments:manage")) notFound();
  const { eventId } = await params;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      eventId,
    ) ||
    !(await financeEventExists(eventId))
  )
    notFound();
  return (
    <main id="main" className="workspace-main workspace-page">
      <div className="workspace-body" data-workspace="payments">
        <FinanceWorkspace eventId={eventId} />
      </div>
    </main>
  );
}
