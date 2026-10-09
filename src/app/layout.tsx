import type { Metadata } from "next";
import "./globals.css";
import { appearanceBootstrap } from "@/domain/appearance";
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
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
