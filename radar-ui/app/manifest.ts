import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name:             "Metrivant",
    short_name:       "Metrivant",
    description:      "Competitive intelligence radar. Know when rivals move before you do.",
    start_url:        "/app",
    display:          "standalone",
    background_color: "#000200",
    theme_color:      "#000200",
    icons: [
      {
        src:   "/favicon.ico",
        sizes: "any",
        type:  "image/x-icon",
      },
    ],
  };
}
