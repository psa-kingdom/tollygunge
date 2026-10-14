"use client";
import { FallbackScreen } from "@/components/fallback-screen";
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <FallbackScreen kind="error" retry={retry} reference={error.digest} />;
}
