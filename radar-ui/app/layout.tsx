import type { Metadata } from "next";
import { Inter } from "next/font/google";
import PostHogProvider from "../components/PostHogProvider";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://metrivant.com"),
  title: {
    default: "Metrivant — Competitive Intelligence Radar",
    template: "%s — Metrivant",
  },
  description:
    "Automated competitor monitoring. Detects meaningful changes across rival websites and surfaces them as structured intelligence.",
  openGraph: {
    type:        "website",
    siteName:    "Metrivant",
    title:       "Metrivant — Competitive Intelligence Radar",
    description: "Automated competitor monitoring. Detects meaningful changes across rival websites and surfaces them as structured intelligence.",
    url:         "https://metrivant.com",
  },
  twitter: {
    card:        "summary",
    title:       "Metrivant — Competitive Intelligence Radar",
    description: "Automated competitor monitoring. Detects meaningful changes across rival websites and surfaces them as structured intelligence.",
  },
  robots: {
    index:  true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-[family-name:var(--font-inter)] antialiased`}>
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  );
}
