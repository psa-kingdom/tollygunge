import "server-only";
import { localPreviewAlias } from "./local-preview-origin";

export function isSameOrigin(request: Request) {
  const configured = process.env.BETTER_AUTH_URL;
  const origin = request.headers.get("origin");
  if (!configured || !origin) return false;

  const base = new URL(configured);
  if (origin === base.origin) return true;

  const alias = localPreviewAlias(base, process.env.TPA_DEPLOYMENT_ENV);
  return origin === alias && request.headers.get("host") === new URL(alias).host;
}
