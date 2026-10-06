export function managedStorageCredentials(
  env: Record<string, string | undefined>,
) {
  const accountId = env.R2_ACCOUNT_ID;
  const accessKeyId = env.R2_ACCESS_KEY_ID;
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
  if (!env.R2_BUCKET_NAME || !accountId || !accessKeyId || !secretAccessKey)
    return undefined;
  if (!/^[a-f0-9]{32}$/i.test(accountId)) return undefined;
  return { accountId, accessKeyId, secretAccessKey };
}

export function storageMode(env: Record<string, string | undefined>) {
  if (managedStorageCredentials(env)) return "managed";
  if (
    env.NODE_ENV !== "production" &&
    env.R2_BUCKET_NAME &&
    env.CLOUDFLARE_CREDENTIAL_FILE
  )
    return "local-file";
  return undefined;
}
