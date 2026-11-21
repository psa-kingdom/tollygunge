import type { ContentBody } from "./operations";
import type { Assignment, ProfileGroup } from "./people";

export const memberSectors = [
  { id: "founding", label: "Founding Members", page: "about", section: 2 },
  {
    id: "executive",
    label: "Executive Committee",
    page: "governance",
    section: 0,
  },
  {
    id: "subcommittees",
    label: "Sub-Committees",
    page: "governance",
    section: 1,
  },
] as const;

export function memberSector(group: ProfileGroup, groups: ProfileGroup[]) {
  const placement = group.parent_id
    ? groups.find((g) => g.id === group.parent_id)?.draft
    : group.draft;
  return memberSectors.find(
    (s) => s.page === placement?.page && s.section === placement.section,
  );
}

export function moveMemberPlacement(
  assignments: Assignment[],
  sourceIds: string[],
  targetId: string,
  order: number,
): Assignment[] {
  if (sourceIds.includes(targetId)) return assignments;
  const source = assignments.find((a) => sourceIds.includes(a.groupId));
  if (!source)
    throw Error(
      "This profile is no longer in the source group. Refresh and try again.",
    );
  const remaining = assignments.filter((a) => !sourceIds.includes(a.groupId));
  return remaining.some((a) => a.groupId === targetId)
    ? remaining
    : [...remaining, { ...source, groupId: targetId, order }];
}

export function showMemberSection(
  page: string,
  section: number,
  people: { published: { page: string; section: number } }[],
) {
  return (
    !memberSectors.some((s) => s.page === page && s.section === section) ||
    people.some(
      (p) => p.published.page === page && p.published.section === section,
    )
  );
}
export function peopleFallback(
  page: string,
  data: ContentBody,
  people: { published: { page: string; section: number } }[],
): ContentBody {
  const sections = data.sections.map((s) => ({ ...s }));
  for (const p of people) {
    if (p.published.page !== page) continue;
    const i = p.published.section;
    if (!sections[i]) continue;
    if (page === "about" && i === 2)
      sections[i].text =
        "Meet the professionals who helped establish our association.";
    if (page === "governance" && i === 0)
      sections[i].text =
        "Association-confirmed leadership profiles and responsibilities.";
    if (page === "governance" && i === 1)
      sections[i].text =
        "Working groups and their association responsibilities.";
  }
  return { ...data, sections };
}
