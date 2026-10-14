import { FallbackScreen } from "@/components/fallback-screen";
export const metadata = { title: "Page not found | TPA", robots: { index: false, follow: false } };
export default function GlobalNotFound() {
  return <html lang="en"><body style={{ margin: 0 }}><FallbackScreen kind="notFound" /></body></html>;
}
