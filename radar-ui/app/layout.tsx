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
    "Detect competitor moves before they matter. Metrivant monitors pricing, product changes, and strategy signals in real time.",
  openGraph: {
    type:        "website",
    siteName:    "Metrivant",
    title:       "Metrivant — Competitive Intelligence Radar",
    description: "See competitor moves before the market does.",
    url:         "https://metrivant.com",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Metrivant — Competitive Intelligence Radar" }],
  },
  twitter: {
    card:        "summary_large_image",
    title:       "Metrivant — Competitive Intelligence Radar",
    description: "Detect competitor moves before they matter.",
    images:      ["/og-image.png"],
  },
  icons: {
    icon:  [{ url: "/favicon.ico" }],
    apple: [{ url: "/apple-touch-icon.png" }],
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
