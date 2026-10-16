import type { MetadataRoute } from "next";

/** "Add to home screen": the app opens on its own start page, in Folio's colours. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Folio",
    short_name: "Folio",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f1ea",
    theme_color: "#1a1a1a",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
