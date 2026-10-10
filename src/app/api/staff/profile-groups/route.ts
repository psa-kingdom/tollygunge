import { randomUUID } from "node:crypto";
import {
  authorized,
  operation,
  jsonBody,
  transaction,
  audit,
  OperationError,
} from "@/lib/operation-api";
import { record, uuid, version } from "@/domain/operations";
import { groupBody } from "@/domain/people";
export async function POST(request: Request) {
  return operation(async () => {
    const actor = await authorized(request, "content:publish", true),
      input = record(await jsonBody(request));
    return transaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(894212038)");
      const action = String(input.action),
        id = input.id ? uuid(input.id) : randomUUID();
      if (!["save", "publish", "archive", "restore"].includes(action))
        throw new OperationError("Choose a group action.");
      const row = input.id
        ? (
            await client.query(
              "SELECT * FROM tpa.profile_groups WHERE id=$1 FOR UPDATE",
              [id],
            )
          ).rows[0]
        : null;
      if (
        row
          ? row.version !== version(input.version)
          : version(input.version) !== 0 || action !== "save"
      )
        throw new OperationError(
          "This group changed. Reload before continuing.",
          409,
        );
      if (action === "save") {
        const body = groupBody(input.body),
          parent = input.parentId ? uuid(input.parentId) : null;
        if (row?.published && parent !== row.parent_id)
          throw new OperationError(
            "Published groups retain their hierarchy. Create a new subgroup and reassign people instead.",
          );
        if (parent) {
          const p = (
            await client.query("SELECT * FROM tpa.profile_groups WHERE id=$1", [
              parent,
            ])
          ).rows[0];
          if (!p || p.archived || p.parent_id || parent === id)
            throw new OperationError("Choose an active top-level parent.");
          if (
            (
              await client.query(
                "SELECT 1 FROM tpa.profile_groups WHERE parent_id=$1",
                [id],
              )
            ).rowCount
          )
            throw new OperationError(
              "A group with subgroups cannot become a subgroup.",
            );
        }
        if (
          row &&
          parent !== row.parent_id &&
          (
            await client.query(
              "SELECT 1 FROM tpa.person_assignments WHERE group_id=$1",
              [id],
            )
          ).rowCount
        )
          throw new OperationError(
            "Reassign active people before changing the group parent.",
          );
        if (row)
          await client.query(
            "UPDATE tpa.profile_groups SET draft=$2,parent_id=$3,version=version+1,updated_at=now() WHERE id=$1",
            [id, body, parent],
          );
        else
          await client.query(
            "INSERT INTO tpa.profile_groups(id,draft,parent_id) VALUES($1,$2,$3)",
            [id, body, parent],
          );
      } else if (action === "archive") {
        if (
          (
            await client.query(
              "SELECT 1 FROM tpa.profile_groups WHERE parent_id=$1 AND NOT archived",
              [id],
            )
          ).rowCount ||
          (
            await client.query(
              "SELECT 1 FROM tpa.person_assignments WHERE group_id=$1",
              [id],
            )
          ).rowCount ||
          (
            await client.query(
              "SELECT 1 FROM tpa.people WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(draft->'assignments','[]')) a WHERE a->>'groupId'=$1) OR EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(published->'assignments','[]')) a WHERE a->>'groupId'=$1)",
              [id],
            )
          ).rowCount
        )
          throw new OperationError(
            "Remove active assignments and archive subgroups first.",
          );
        await client.query(
          "UPDATE tpa.profile_groups SET archived=true,version=version+1 WHERE id=$1",
          [id],
        );
      } else if (action === "restore")
        await client.query(
          "UPDATE tpa.profile_groups SET archived=false,version=version+1 WHERE id=$1",
          [id],
        );
      else {
        if (row.archived)
          throw new OperationError("Restore the group before publishing.");
        if (
          row.parent_id &&
          !(
            await client.query(
              "SELECT 1 FROM tpa.profile_groups WHERE id=$1 AND published IS NOT NULL AND NOT archived",
              [row.parent_id],
            )
          ).rowCount
        )
          throw new OperationError("Publish the parent first.");
        await client.query(
          "UPDATE tpa.profile_groups SET published=draft,version=version+1 WHERE id=$1",
          [id],
        );
      }
      await audit(client, actor.id, `group.${action}`, id);
      return (
        await client.query("SELECT * FROM tpa.profile_groups WHERE id=$1", [id])
      ).rows[0];
    });
  });
}
