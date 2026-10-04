import Link from "next/link";
import { notFound } from "next/navigation";
const workspaces: Record<string, string> = {
  events: "Event publishing, registration and attendance",
  content: "Drafts, media and publishing",
  crm: "Inquiries, assignments and follow-ups",
  communications: "Shared inbox, templates and campaigns",
  payments: "Transactions, receipts and staff-approved refunds",
};
export const metadata = { robots: { index: false, follow: false } };
export default async function Workspace({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  if (!workspaces[workspace]) notFound();
  return (
    <main id="main" className="content-page">
      <div className="page-heading">
        <span className="eyebrow">WORKSPACE PREVIEW</span>
        <h1 style={{ textTransform: "capitalize" }}>{workspace}</h1>
        <p>{workspaces[workspace]}</p>
        <div className="notice">
          This workspace is scheduled for a later delivery slice. No live
          records or operations are available.
        </div>
        <Link className="button" href="/admin">
          ← Return to members
        </Link>
      </div>
    </main>
  );
}
