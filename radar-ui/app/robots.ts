import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/pricing", "/login", "/signup"],
        disallow: ["/app/", "/api/"],
      },
    ],
    sitemap: "https://metrivant.com/sitemap.xml",
  };
}
