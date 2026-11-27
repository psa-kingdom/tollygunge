import { verificationSteps } from "@/domain/verification";
import type { Review } from "./verification-workspace";
import styles from "./member-review.module.css";
export function SubmittedDetails({
  review,
  compact = false,
}: {
  review: Review;
  compact?: boolean;
}) {
  return (
    <div className={compact ? styles.submittedReview : "submitted-sections"}>
      {verificationSteps.map((step, i) => {
        const entries = Object.entries(review.snapshot.details).filter(
          ([id]) =>
            review.requirement_fields.find((f) => f.id === id)?.step === i,
        );
        if (!entries.length) return null;
        const values = (
          <dl>
            {entries.map(([id, value]) => {
              const field = review.requirement_fields.find((f) => f.id === id);
              const wide =
                field?.type === "multiline" ||
                id === "declaration" ||
                value.length > 100;
              return (
                <div
                  key={id}
                  className={
                    compact && wide ? styles.reviewWideField : undefined
                  }
                >
                  <dt>{field?.label || id}</dt>
                  <dd>
                    {value && field?.type === "document" ? (
                      <a
                        href={"/api/documents/" + encodeURIComponent(value)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View private evidence
                      </a>
                    ) : field?.type === "checkbox" && value ? (
                      value === "true" ? (
                        "Yes"
                      ) : (
                        "No"
                      )
                    ) : (
                      value || "Not supplied"
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        );
        return (
          <section key={step}>
            <h3>{step}</h3>
            {values}
          </section>
        );
      })}
      {Object.entries(review.snapshot.details)
        .filter(([id]) => !id.endsWith("Structured") && !review.requirement_fields.some((f) => f.id === id))
        .map(([id, value]) => (
          <p key={id}>
            {id}: {value}
          </p>
        ))}
    </div>
  );
}
