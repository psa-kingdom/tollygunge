import { redirect } from "next/navigation";
import { currentActor } from "@/lib/actor";
export const dynamic = "force-dynamic";
export default async function Join() {
  const actor = await currentActor();
  redirect(actor ? "/member/application" : "/signup");
}
