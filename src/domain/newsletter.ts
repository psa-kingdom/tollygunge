export const newsletterConsentVersion = "public-newsletter-events-v1";
export const newsletterConsent = "I agree to receive TPA newsletters and public event announcements by email. I can unsubscribe at any time.";
export const subscriptionRequested = "If this address can receive updates, a confirmation email will arrive shortly. Your subscription starts only after you confirm.";
export function subscriptionToken(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(value)) throw new Error("This subscription link is invalid. Request a new link.");
  return value;
}
