import type { ContentBody } from "./operations";
import type { PersonBody } from "./people";
export type ArticleEntry = {
  id: string;
  slug: string;
  kind: "insight" | "news";
  draft: ContentBody;
  published: ContentBody | null;
  version: number;
  archived_at?: string | null;
  updated_at?: string;
};
export const emptyArticle: ContentBody = {
  title: "",
  intro: "",
  sections: [{ title: "Overview", text: "" }],
  sourceUrl: "",
  attribution: "",
};
export function articleSlug(title: string) {
  return title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100)
    .replace(/-$/g, "");
}
export function publicationState(entry: {
  archived_at?: string | null;
  published: unknown;
}) {
  return entry.archived_at
    ? "Archived"
    : entry.published
      ? "Published"
      : "Draft";
}
// Send only website presentation fields. The server merges the patch with the
// stored profile so private contact and membership details remain intact.
export function publicProfilePatch(body: PersonBody) {
  return {
    name: body.name,
    ...(body.publicEmail === undefined ? {} : { publicEmail: body.publicEmail }),
    ...(body.publicMobile === undefined ? {} : { publicMobile: body.publicMobile }),
    ...(body.publicDesignation === undefined ? {} : { publicDesignation: body.publicDesignation }),
    biography: body.biography,
    biographyRich: body.biographyRich ?? null,
    portraitId: body.portraitId,
    portraitKind: body.portraitKind,
  };
}
