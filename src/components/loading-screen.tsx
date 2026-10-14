import { loadingContent } from "@/domain/fallbacks";
export function LoadingScreen() {
  return <div className="tpa-loading" role="status" aria-live="polite"><span aria-hidden="true" /><strong>{loadingContent.title}</strong><p>{loadingContent.description}</p></div>;
}
