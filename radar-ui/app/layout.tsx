import type { Metadata, Viewport } from "next";
import { Inter, Orbitron, Share_Tech_Mono } from "next/font/google";
import PostHogProvider from "../components/PostHogProvider";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const shareTechMono = Share_Tech_Mono({
  variable: "--font-share-tech-mono",
  subsets: ["latin"],
  weight: ["400"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://metrivant.com"),
  title: {
    default: "Metrivant — Competitive Intelligence",
    template: "%s — Metrivant",
  },
  description:
    "Monitor competitors across market sectors, detecting high-confidence signals of strategic change to inform critical business decisions and maintain competitive advantage.",
  openGraph: {
    type:        "website",
    siteName:    "Metrivant",
    title:       "Metrivant — Competitive Intelligence",
    description: "Monitor competitors across market sectors, detecting high-confidence signals of strategic change to inform critical business decisions and maintain competitive advantage.",
    url:         "https://metrivant.com",
    images: [{ url: "/opengraph-image.png", width: 1200, height: 630, alt: "Metrivant — Competitive Intelligence" }],
  },
  twitter: {
    card:        "summary_large_image",
    title:       "Metrivant — Competitive Intelligence",
    description: "Monitor competitors across market sectors, detecting high-confidence signals of strategic change to inform critical business decisions and maintain competitive advantage.",
    images:      ["/opengraph-image.png"],
  },
  icons: {
    icon:  [{ url: "/favicon.ico" }],
    apple: [{ url: "/apple-icon.png" }],
  },
  robots: {
    index:  true,
    follow: true,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Metrivant",
  url: "https://metrivant.com",
  description:
    "Monitor competitors across market sectors, detecting high-confidence signals of strategic change to inform critical business decisions and maintain competitive advantage.",
  logo: "https://metrivant.com/opengraph-image.png",
  sameAs: [],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="classic" suppressHydrationWarning>
      <body className={`${inter.variable} ${orbitron.variable} ${shareTechMono.variable} font-[family-name:var(--font-inter)] antialiased`}>
        {/* Theme flash prevention — runs before React hydration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('metrivant-theme');if(t==='hud')document.documentElement.setAttribute('data-theme','hud')}catch(e){}`,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  );
}
