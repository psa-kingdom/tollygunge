import "server-only";
import type { PoolClient } from "pg";
import { getDatabase } from "./database";
import { publicPerson } from "@/domain/people";
export async function publishedPeople(personId: string | null = null, db: Pick<PoolClient, "query"> = getDatabase()) {
  const groups = (
    await db.query(
      "SELECT * FROM tpa.profile_groups WHERE published IS NOT NULL AND NOT archived",
    )
  ).rows;
  const people = (
    await db.query(
      "SELECT p.id,p.published,p.accepted,p.contact_email,p.mobile_normalized,(CASE WHEN p.published->>'portraitKind'='profile' THEN EXISTS(SELECT 1 FROM tpa.profile_portraits x WHERE x.id=(p.published->>'portraitId')::uuid AND x.person_id=p.id) ELSE EXISTS(SELECT 1 FROM tpa.public_media m WHERE m.id=(p.published->>'portraitId')::uuid AND m.published IS NOT NULL) END) AS portrait_available FROM tpa.people p WHERE p.published IS NOT NULL AND p.archived_at IS NULL AND ($1::uuid IS NULL OR p.id=$1) ORDER BY p.id",
      [personId],
    )
  ).rows;
  return people
    .flatMap((p) =>
      (p.published.assignments ?? []).flatMap(
        (a: {
          groupId: string;
          role: string;
          term: string;
          order: number;
          label?: string;
        }) => {
          const group = groups.find((g) => g.id === a.groupId);
          if (!group) return [];
          const parent = group.parent_id
            ? groups.find((g) => g.id === group.parent_id)
            : null;
          if (group.parent_id && !parent) return [];
          const placement = parent?.published ?? group.published;
          return [
            {
              portrait_available: p.portrait_available,
              id: `${p.id}:${group.id}`,
              portrait_alt: p.published.name,
              published: {
                ...publicPerson(p.published),
                ...(placement.page === "governance" ? {
                  email: p.published.publicEmail ?? (p.published.email || p.contact_email || p.accepted?.email || ""),
                  mobile: p.published.publicMobile ?? (p.published.mobile || p.published.phone || p.mobile_normalized || p.accepted?.mobile || p.accepted?.phone || ""),
                } : {}),
                ...(p.published.verified === true ? {verified:true} : {}),
                role: p.published.publicDesignation || a.role,
                assignmentLabel: a.label,
                term: a.term,
                order: a.order,
                groupName: group.published.name,
                parentName: parent?.published.name,
                subgroupOrder: parent ? group.published.order : -1,
                groupOrder: placement.order,
                page: placement.page,
                section: placement.section,
                subgroup: !!parent,
              },
            },
          ];
        },
      ),
    )
    .sort(
      (a, b) =>
        a.published.groupOrder - b.published.groupOrder ||
        a.published.subgroupOrder - b.published.subgroupOrder ||
        a.published.order - b.published.order ||
        a.published.name.localeCompare(b.published.name),
    );
}
