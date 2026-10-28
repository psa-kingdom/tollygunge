/** Presentation follows metric meaning, including when staff permissions reorder cards. */
export function dashboardMetricPresentation(label: string, count: number) {
  const treatments: Record<string, { icon: string; tone: string }> = {
    "Total members": { icon: "people", tone: "blue" },
    "Active members": { icon: "shield", tone: "success" },
    "Membership issues": { icon: "file", tone: "warning" },
    "Profiles needing review": { icon: "profile", tone: "warning" },
    "Invitations held": { icon: "mail", tone: "warning" },
    "Payments needing verification": { icon: "wallet", tone: "warning" },
    "Upcoming events": { icon: "calendar", tone: "teal" },
    "Upcoming registrations": { icon: "calendar", tone: "blue" },
  };
  const treatment = treatments[label] ?? { icon: "chart", tone: "neutral" };
  return { ...treatment, tone: count === 0 ? "neutral" : treatment.tone };
}
