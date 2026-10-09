import "server-only";
import { currentActor } from "./actor";
import { hasPermission, type Permission } from "@/domain/access";
import { boundedBody } from "@/domain/request-body";
import { isSameOrigin } from "./request-policy";
import { getDatabase } from "./database";
import type { PoolClient } from "pg";
export class OperationError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export async function authorized(
  request: Request,
  permission?: Permission,
  write = false,
) {
  const actor = await currentActor(request.headers);
  if (!actor) throw new OperationError("Sign in to continue.", 401);
  if (permission && !hasPermission(actor.roles, permission))
    throw new OperationError("Access denied.", 403);
  if (write && !isSameOrigin(request))
    throw new OperationError("Request origin is not allowed.", 403);
  return actor;
}
export async function jsonBody(request: Request, limit = 96000) {
  try {
    return JSON.parse(
      new TextDecoder().decode(await boundedBody(request, limit)),
    );
  } catch {
    throw new OperationError("Invalid or oversized request.");
  }
}
export async function transaction<T>(work: (client: PoolClient) => Promise<T>) {
  const client = await getDatabase().connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
export async function audit(
  client: PoolClient,
  actor: string,
  action: string,
  id: string,
) {
  await client.query(
    "INSERT INTO tpa.audit_events(actor_user_id,action,entity_id) VALUES($1,$2,$3)",
    [actor, action, id],
  );
}
export async function operation(work: () => Promise<unknown>) {
  try {
    return Response.json(await work(), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof OperationError)
      return Response.json(
        { error: error.message },
        {
          status: error.status,
          headers: { "Cache-Control": "private, no-store" },
        },
      );
    // Validation messages are safe; database/provider diagnostics are never exposed.
    const code =
      typeof error === "object" && error && "code" in error
        ? error.code
        : undefined;
    if (code === "23505")
      return Response.json(
        { error: "This record already exists." },
        { status: 409 },
      );
    return Response.json(
      {
        error: code
          ? "Unable to save. Please try again."
          : "Check the submitted details.",
      },
      { status: code ? 503 : 400 },
    );
  }
}
