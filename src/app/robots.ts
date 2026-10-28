import type { MetadataRoute } from "next";
import { siteOrigin } from "@/domain/public-metadata";
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/admin", "/member", "/account", "/preview/", "/invitation", "/reset-password", "/email-verification", "/newsletter/", "/unsubscribe"] }, sitemap: `${siteOrigin}/sitemap.xml` };
}
