import { loadingContent } from "@/domain/fallbacks";
export function LoadingScreen() {
  return <div className="tpa-loading" role="status" aria-live="polite" style={{ padding: "64px 24px", textAlign: "center", color: "#122c42", fontFamily: "Arial, sans-serif" }}><span aria-hidden="true" style={{ display: "block", width: 32, height: 4, background: "#b78c43", margin: "0 auto 20px" }} /><strong>{loadingContent.title}</strong><p style={{ color: "#52616b" }}>{loadingContent.description}</p></div>;
}
