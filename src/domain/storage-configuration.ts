export function managedStorageCredentials(
  env: Record<string, string | undefined>,
) {
  const accountId = env.R2_ACCOUNT_ID;
  const accessKeyId = env.R2_ACCESS_KEY_ID;
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
  if (
    env.R2_BUCKET_NAME !== "tpa-private-documents" ||
    !accountId ||
    !accessKeyId ||
    !secretAccessKey
  )
    return undefined;
  if (!/^[a-f0-9]{32}$/i.test(accountId)) return undefined;
  return { accountId, accessKeyId, secretAccessKey };
}

export function storageMode(env: Record<string, string | undefined>) {
  if (managedStorageCredentials(env)) return "managed";
  if (
    env.NODE_ENV !== "production" &&
    env.R2_BUCKET_NAME === "tpa-private-documents" &&
    env.CLOUDFLARE_CREDENTIAL_FILE
  )
    return "local-file";
  return undefined;
}

export function localStorageEndpoint(env: Record<string, string | undefined>) {
  if (!env.TPA_LOCAL_STORAGE_ENDPOINT) return undefined;
  const endpoint = new URL(env.TPA_LOCAL_STORAGE_ENDPOINT);
  const database = new URL(env.DATABASE_URL ?? "");
  if (
    env.TPA_DEPLOYMENT_ENV !== "local" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(endpoint.hostname) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(database.hostname) ||
    endpoint.protocol !== "http:" ||
    endpoint.username ||
    endpoint.password ||
    endpoint.pathname !== "/"
  ) {
    throw new Error(
      "Local storage requires a local deployment and loopback database and endpoint.",
    );
  }
  return endpoint.origin;
}
