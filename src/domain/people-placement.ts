import type { ContentBody } from "./operations";
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
