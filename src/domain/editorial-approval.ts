import { isDeepStrictEqual } from "node:util";
import { personBody, type PersonBody } from "./people";
const editorialFields = new Set([
  "biography",
  "biographyRich",
  "portraitId",
  "portraitKind",
  "assignments",
  "nameSize",
]);
export function editorialProfile(
  input: unknown,
  accepted: unknown,
): PersonBody {
  const proposed = personBody(input),
    previous = personBody(accepted);
  for (const key of new Set([
    ...Object.keys(proposed),
    ...Object.keys(previous),
  ])) {
    if (
      !editorialFields.has(key) &&
      !isDeepStrictEqual(
        proposed[key as keyof PersonBody],
        previous[key as keyof PersonBody],
      )
    )
      throw Error(
        "Editorial approval cannot change names, contact details or member information. Use the member/profile review workflow.",
      );
  }
  return proposed;
}
