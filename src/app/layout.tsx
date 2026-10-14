import type { Metadata } from "next";
import { DM_Sans, Manrope } from "next/font/google";
import "./globals.css";
import { appearanceBootstrap } from "@/domain/appearance";
import {publishedSettings} from '@/lib/website-content';
import { sharedDefaults } from '@/domain/website-settings';
export const dynamic='force-dynamic';
const dmSans = DM_Sans({ subsets: ["latin"], display: "swap", variable: "--font-dm-sans" });
const manrope = Manrope({ subsets: ["latin"], display: "swap", variable: "--font-manrope" });
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
        <script dangerouslySetInnerHTML={{ __html: appearanceBootstrap }} />
      </head>
      <body className={`${dmSans.variable} ${manrope.variable}`}>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
