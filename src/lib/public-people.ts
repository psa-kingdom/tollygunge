import "server-only";
import { getDatabase } from "./database";
export async function publishedPeople() {
  const db = getDatabase();
  const groups = (
    await db.query(
      "SELECT * FROM tpa.profile_groups WHERE published IS NOT NULL AND NOT archived",
    )
  ).rows;
  const people = (
    await db.query(
      "SELECT p.id,p.published,(CASE WHEN p.published->>'portraitKind'='profile' THEN EXISTS(SELECT 1 FROM tpa.profile_portraits x WHERE x.id=(p.published->>'portraitId')::uuid AND x.person_id=p.id) ELSE EXISTS(SELECT 1 FROM tpa.public_media m WHERE m.id=(p.published->>'portraitId')::uuid AND m.published IS NOT NULL) END) AS portrait_available FROM tpa.people p WHERE p.published IS NOT NULL ORDER BY p.id",
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
              ...p,
              id: `${p.id}:${group.id}`,
              portrait_alt: p.published.name,
              published: {
                ...p.published,
                role: a.role,
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
