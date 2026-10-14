import { GovernancePortrait } from "./governance-portrait";
import { RichContent } from "./rich-content";
import type { PersonBody } from "@/domain/people";
import {biographyHeading} from '@/domain/website-settings';
export type PublicGovernanceEntry = {
  id: string;
  published: PersonBody & {
    role: string;
    term: string;
    order: number;
    page: string;
    section: number;
    groupName: string;
    parentName?: string;
    assignmentLabel?: string;
    subgroup?: boolean;
    groupOrder?: number;
    verified?: boolean;
  };
  portrait_available: boolean;
  portrait_alt: string | null;
};
export function PublicGovernance({
  entries,
  biographyTemplate='About {name}',
}: {
  entries: PublicGovernanceEntry[];
  biographyTemplate?:string;
}) {
  return (
    <div className="people-roster">
      {entries.map(({ id, published: p, portrait_available, portrait_alt }) => (
        <article className="person-card" key={id}>
          <div className="person-card-identity">
            <GovernancePortrait
              name={p.name}
              alt={portrait_alt ?? p.name}
              src={
                p.portraitId && portrait_available
                  ? p.portraitKind === "profile"
                    ? `/api/profile-portraits/${p.portraitId}`
                    : `/media/${p.portraitId}`
                  : undefined
              }
            />
            <div>
              <span className="eyebrow">
                {[p.parentName, p.groupName].filter(Boolean).join(" / ")}
              </span>
              <h3
                className={
                  p.nameSize ? `content-title-${p.nameSize}` : undefined
                }
              >
                {p.name}
              </h3>
              <p className="person-role">{p.role}</p>
              {p.assignmentLabel && <small>{p.assignmentLabel}</small>}
              {p.term && <small>Term: {p.term}</small>}
              {p.verified && (
                <small className="person-verified">
                  ✓ Profile reviewed by TPA
                </small>
              )}
            </div>
          </div>
          {(p.profession || p.jobTitle || p.organization || p.city) && (
            <p className="person-profession">
              {[p.profession, p.jobTitle, p.organization, p.city]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          {p.biography && (
            <p>
              {p.biography.match(/^.{60,}?[.!?](?=\s|$)/)?.[0] ?? p.biography}
            </p>
          )}
          {p.biography && (
            <details className="person-biography">
              <summary>{biographyHeading(p.name,p.biographyTitle,biographyTemplate)}</summary>
              <RichContent document={p.biographyRich} text={p.biography} />
            </details>
          )}
          {!!p.links?.filter((l) => l.public).length && (
            <nav
              aria-label={`${p.name} profile links`}
              className="person-links"
            >
              {p.links
                .filter((l) => l.public)
                .map((l) => (
                  <a
                    key={l.url}
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${p.name}: ${l.label}`}
                  >
                    <span aria-hidden="true">
                      {
                        (
                          {
                            X: "𝕏",
                            LinkedIn: "in",
                            GitHub: "GH",
                            Instagram: "◎",
                            Facebook: "f",
                            Discord: "D",
                            Medium: "M",
                            Portfolio: "↗",
                            Website: "↗",
                          } as Record<string, string>
                        )[l.platform]
                      }
                    </span>
                    {l.label}
                  </a>
                ))}
            </nav>
          )}
        </article>
      ))}
    </div>
  );
}
