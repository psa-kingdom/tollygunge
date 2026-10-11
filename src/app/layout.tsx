import type { Metadata } from "next";
import { DM_Sans, Manrope } from "next/font/google";
import "./globals.css";
import { appearanceBootstrap } from "@/domain/appearance";
const dmSans = DM_Sans({ subsets: ["latin"], display: "swap", variable: "--font-dm-sans" });
const manrope = Manrope({ subsets: ["latin"], display: "swap", variable: "--font-manrope" });
export const metadata: Metadata = {
  title: {
    default: "TPA — A community for what comes next",
    template: "%s | TPA",
  },
  description:
    "Tollygunge Professional Association. Connect, learn, collaborate, grow and contribute.",
};
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
