import { redirect } from "next/navigation";
import { currentActor } from "@/lib/actor";
export const dynamic = "force-dynamic";
export default async function Page() {
  const actor = await currentActor();
  redirect(!actor ? "/login" : actor.roles.length ? "/admin" : "/member");
}
