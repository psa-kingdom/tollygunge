import { authorized, operation, OperationError } from "@/lib/operation-api";
import { getDatabase } from "@/lib/database";
import { hasPermission } from "@/domain/access";
import { uuid } from "@/domain/operations";
import { readPrivateProof } from "@/lib/private-storage";
export async function GET(
  r: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let file: Response | undefined;
  const result = await operation(async () => {
    const actor = await authorized(r),
      id = uuid((await params).id),
      proof = (
        await getDatabase().query(
          "SELECT owner_id,content_type FROM tpa.finance_proofs WHERE id=$1",
          [id],
        )
      ).rows[0];
    if (
      !proof ||
      (proof.owner_id !== actor.id &&
        !hasPermission(actor.roles, "payments:manage"))
    )
      throw new OperationError("Proof not found.", 404);
    const stream = await readPrivateProof(id);
    file = new Response(stream, {
      headers: {
        "Content-Type": proof.content_type,
        "Content-Disposition": new URL(r.url).searchParams.has("download")
          ? "attachment"
          : "inline",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "sandbox; default-src 'none'",
      },
    });
    return { ok: true };
  });
  return file ?? result;
}
