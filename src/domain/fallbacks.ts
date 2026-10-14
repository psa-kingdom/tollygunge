type LocalPath = `/${string}`;
type FallbackContent = { label: string; title: string; description: string; action: { label: string; href: LocalPath } };
export const fallbacks = {
  notFound: { label: "404 · PAGE NOT FOUND", title: "A little off the beaten path.", description: "The page you’re looking for may have moved, or the address may be incomplete. Let’s help you find your way back to TPA.", action: { label: "Return to homepage", href: "/" } },
  error: { label: "TEMPORARILY UNAVAILABLE", title: "Let’s try that again.", description: "We couldn’t load this page. Please try again in a moment. If you were submitting a form or payment reference, check its status before submitting again.", action: { label: "Return to homepage", href: "/" } },
  denied: { label: "RESTRICTED WORKSPACE", title: "This area needs different access.", description: "Your account does not have permission to open this workspace. Return to your account, or contact TPA if you need help with your access.", action: { label: "Go to your account", href: "/account" } },
  expiredLink: { label: "PASSWORD RECOVERY", title: "This link is no longer available.", description: "The reset link is missing or has expired. Request a new link to continue securely.", action: { label: "Request a new reset link", href: "/forgot-password" } },
  unavailable: { label: "SERVICE UNAVAILABLE", title: "We can’t load this right now.", description: "Please try again later. You can return to the homepage or contact TPA for help.", action: { label: "Return to homepage", href: "/" } },
  emptyEvents: { label: "YOUR EVENTS", title: "Your next connection starts here.", description: "There are no published events or registration history to show yet. Check back for upcoming association events.", action: { label: "Explore TPA", href: "/" } },
} as const satisfies Record<string, FallbackContent>;
export type FallbackKind = keyof typeof fallbacks;
export const loadingContent = { title: "Loading your page…", description: "Please wait a moment." } as const;
