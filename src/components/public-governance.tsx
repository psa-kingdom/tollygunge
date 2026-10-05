import Image from "next/image";
import type { GovernanceProfile } from "@/domain/governance";
export type PublicGovernanceEntry = {
  id: string;
  published: GovernanceProfile;
  portrait_available: boolean;
  portrait_alt: string | null;
};
export function PublicGovernance({
  entries,
}: {
  entries: PublicGovernanceEntry[];
}) {
  return (
    <div className="governance-roster">
      {entries.map(
        ({ id, published: profile, portrait_available, portrait_alt }) => (
          <article className="governance-person" key={id}>
            {profile.portraitId && portrait_available ? (
              <Image
                unoptimized
                src={`/media/${profile.portraitId}`}
                width={88}
                height={88}
                alt={portrait_alt ?? profile.name}
              />
            ) : (
              <span className="governance-monogram" aria-hidden="true">
                {profile.name.slice(0, 1)}
              </span>
            )}
            <div>
              <h3>{profile.name}</h3>
              <p className="governance-role">
                {profile.role}
                {profile.committee ? ` · ${profile.committee}` : ""}
              </p>
              {profile.profession && <p>{profile.profession}</p>}
              {profile.biography && (
                <p className="prose-text">{profile.biography}</p>
              )}
              {profile.term && <small>Term: {profile.term}</small>}
            </div>
          </article>
        ),
      )}
    </div>
  );
}
