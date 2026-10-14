import type { Metadata } from "next";
import "./globals.css";
import "./premium.css";
import { appearanceBootstrap } from "@/domain/appearance";
import {publishedSettings} from '@/lib/website-content';
import { sharedDefaults } from '@/domain/website-settings';
export const dynamic='force-dynamic';
export async function generateMetadata():Promise<Metadata> {
  // Metadata must not prevent the independent error/404 shell from rendering.
  const settings=await publishedSettings('shared').catch(() => sharedDefaults);
  return {
  title: {
    default: settings.defaultTitle,
    template: `%s | ${settings.titleSuffix}`,
  },
  description:
    settings.defaultDescription,
};}
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preload" href="/design/fonts/jakarta-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/design/fonts/cormorant-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <script dangerouslySetInnerHTML={{ __html: appearanceBootstrap }} />
      </head>
      <body className="tpa-premium">
        <noscript>
          <style>{".tpa-loading { display: none; }"}</style>
          <section className="no-script-notice" aria-labelledby="no-script-title">
            <p className="eyebrow">Tollygunge Professional Association</p>
            <h1 id="no-script-title">Enable JavaScript to continue.</h1>
            <p>Turn on JavaScript in your browser, then reload this page to browse TPA and use the member portal.</p>
          </section>
        </noscript>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
