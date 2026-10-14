"use client";
import { FallbackScreen } from "@/components/fallback-screen";
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <html lang="en"><head><title>Temporarily unavailable | TPA</title><meta name="robots" content="noindex" /></head><body style={{ margin: 0 }}><FallbackScreen kind="error" retry={retry} reference={error.digest} /></body></html>;
}
