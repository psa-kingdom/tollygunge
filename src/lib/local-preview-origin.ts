export function localPreviewAlias(base: URL, environment?: string): string | undefined {
  if (environment !== "local" || base.protocol !== "http:") return;
  if (!["localhost", "127.0.0.1"].includes(base.hostname)) return;

  const alias = new URL(base.origin);
  alias.hostname = base.hostname === "localhost" ? "127.0.0.1" : "localhost";
  return alias.origin;
}
