import { verificationSteps } from "@/domain/verification";
import type { Review } from "./verification-workspace";
export function SubmittedDetails({ review }: { review: Review }) {
  return (
    <div className="submitted-sections">
      {verificationSteps.map((step, i) => {
        const entries = Object.entries(review.snapshot.details).filter(
          ([id]) =>
            review.requirement_fields.find((f) => f.id === id)?.step === i,
        );
        return entries.length ? (
          <details key={step} open={i === 0}>
            <summary>
              {i + 1}. {step}
            </summary>
            <dl>
              {entries.map(([id, value]) => (
                <div key={id}>
                  <dt>
                    {review.requirement_fields.find((f) => f.id === id)
                      ?.label || id}
                  </dt>
                  <dd>
                    {review.requirement_fields.find((f) => f.id === id)
                      ?.type === "document" ? (
                      <a
                        href={"/api/documents/" + encodeURIComponent(value)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View private evidence ↗
                      </a>
                    ) : (
                      value || "Not supplied"
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </details>
        ) : null;
      })}
      {Object.entries(review.snapshot.details)
        .filter(([id]) => !review.requirement_fields.some((f) => f.id === id))
        .map(([id, value]) => (
          <p key={id}>
            {id}: {value}
          </p>
        ))}
    </div>
  );
}
