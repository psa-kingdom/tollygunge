import { releaseVersion } from "./release";

export const issuePrompt = "What did you expect?\n\nWhat happened?\n\nSteps to reproduce:\n1. \n";
/** Keep only known route templates; never forward search terms, tokens or record IDs. */
export function diagnosticRoute(path: string | null | undefined) {
  if (!path) return "/other";
  const pathname = path.split(/[?#]/, 1)[0];
  if (/^\/admin\/workspaces\/[a-z-]+$/.test(pathname)) return pathname;
  if (/^\/events\/[^/]+$/.test(pathname)) return "/events/[id]";
  if (/^\/resources\/[^/]+$/.test(pathname)) return "/resources/[slug]";
  if (/^\/admin\/content\/[^/]+$/.test(pathname)) return "/admin/content/[id]";
  return ["/", "/about", "/governance", "/membership", "/events", "/resources", "/contact", "/privacy", "/login", "/signup", "/join", "/forgot-password", "/reset-password", "/invitation", "/email-verification", "/admin", "/member", "/account", "/account/profile", "/member/application", "/member/events", "/member/inquiries", "/member/security", "/member/payments"].includes(pathname) ? pathname : "/other";
}
export function browserFamily(agent: string) {
  if (/Edg\//.test(agent)) return "Edge";
  if (/Firefox\//.test(agent)) return "Firefox";
  if (/Chrome\//.test(agent)) return "Chrome";
  if (/Safari\//.test(agent)) return "Safari";
  return "Other browser";
}
export function issueDiagnostics(path: string, agent: string, width: number, height: number) {
  return `Version: ${releaseVersion}\nPage: ${diagnosticRoute(path)}\nBrowser: ${browserFamily(agent)}\nViewport: ${Math.round(width)} × ${Math.round(height)}`;
}
export function issueMessage(message: string, diagnostics: string, include: boolean) {
  return include ? `${message.trim()}\n\nOptional technical context:\n${diagnostics}` : message;
}
