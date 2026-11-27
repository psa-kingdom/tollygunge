import {
  authorized,
  operation,
  transaction,
  jsonBody,
  audit,
  OperationError,
} from "@/lib/operation-api";
import { membershipPlans } from "@/lib/membership-plans";
import { text } from "@/domain/operations";

export async function GET(request: Request) {
  return operation(async () => {
    await authorized(request, "staff:manage");
    return { plans: await membershipPlans() };
  });
}

export async function POST(request: Request) {
  return operation(async () => {
    const actor = await authorized(request, "staff:manage", true);
    const input = await jsonBody(request, 32000);
    const action = input.action ?? "save";
    if (action !== "save")
      throw new OperationError(
        "Only Free, Patron and Life plans are supported. Edit an existing plan.",
      );
    if (
      !["Free", "Patron", "Life"].includes(input.code) ||
      !Number.isInteger(input.version)
    )
      throw new OperationError("Choose a membership plan.");
    return transaction(async (client) => {
      let name: string, benefits: string;
      try {
        name = text(input.name, "Plan name", 80, 1);
        benefits = text(input.benefits ?? "", "Plan benefits", 6000);
      } catch (error) {
        throw new OperationError((error as Error).message);
      }
      const amount = String(input.cost ?? "").trim();
      const gst = String(input.gst ?? "0").trim();
      if (!/^\d+(\.\d{1,2})?$/.test(amount) || !/^\d+(\.\d{1,2})?$/.test(gst))
        throw new OperationError(
          "Enter base cost and GST with up to two decimal places.",
        );
      const cost = Math.round(Number(amount) * 100),
        basisPoints = Math.round(Number(gst) * 100);
      if (
        !Number.isSafeInteger(cost) ||
        cost > 999999999 ||
        basisPoints > 10000 ||
        (input.code === "Free" && (cost !== 0 || basisPoints !== 0))
      )
        throw new OperationError(
          "Check the base cost and GST. The Free plan must total ₹0.",
        );
      const code = input.code;
      const result = await client.query(
        "UPDATE tpa.membership_plans SET name=$2,cost_paise=$3,gst_basis_points=$4,benefits=$5,cost_configured=true,version=version+1,updated_at=now() WHERE code=$1 AND version=$6 AND active RETURNING *",
        [code, name, cost, basisPoints, benefits, input.version],
      );
      if (!result.rowCount)
        throw new OperationError(
          "This plan changed in another tab. Reload before saving.",
          409,
        );
      await audit(client, actor.id, "membership.plan_updated", code);
      return { plan: result.rows[0] };
    });
  });
}
