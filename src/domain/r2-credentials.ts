// Only parse in server processes. Never persist the parsed values or include them in errors.
export function parseR2Credentials(source: string) {
  const accountId = source.match(
    /([a-f0-9]{32})\.r2\.cloudflarestorage\.com/i,
  )?.[1];
  const accessKeyId = source.match(
    /access\s*key\s*(?:id)?\s*[:=]?\s*[`"']?\s*([A-Za-z0-9_-]{20,})/i,
  )?.[1];
  const secretAccessKey = source.match(
    /secret\s*(?:access\s*)?key\s*[:=]?\s*[`"']?\s*([A-Za-z0-9_-]{30,})/i,
  )?.[1];
  if (!accountId || !accessKeyId || !secretAccessKey)
    throw new Error("Private storage credentials are incomplete.");
  return { accountId, accessKeyId, secretAccessKey };
}
