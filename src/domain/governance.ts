import { record, text, uuid } from "./operations";
export const governanceGroups = [
  "executive",
  "subcommittee",
  "founding",
] as const;
export type GovernanceProfile = {
  name: string;
  role: string;
  group: (typeof governanceGroups)[number];
  committee: string;
  profession: string;
  biography: string;
  term: string;
  order: number;
  portraitId: string | null;
};
export function governanceProfile(value: unknown): GovernanceProfile {
  const input = record(value),
    group = String(input.group);
  if (!(governanceGroups as readonly string[]).includes(group))
    throw new Error("Choose a profile group.");
  const order = Number(input.order);
  if (!Number.isSafeInteger(order) || order < 0 || order > 999)
    throw new Error("Use an order between 0 and 999.");
  return {
    name: text(input.name, "Name", 120, 2),
    role: text(input.role, "Association role", 120, 2),
    group: group as GovernanceProfile["group"],
    committee: text(
      input.committee ?? "",
      "Committee name",
      120,
      group === "subcommittee" ? 2 : 0,
    ),
    profession: text(input.profession ?? "", "Profession", 160),
    biography: text(input.biography ?? "", "Biography", 1200),
    term: text(input.term ?? "", "Term", 80),
    order,
    portraitId: input.portraitId ? uuid(input.portraitId) : null,
  };
}
