import type { MetadataRoute } from "next";
export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/about", "/activities", "/news", "/gallery", "/donate", "/join", "/contact"].map(path => ({ url: `https://www.ardttemp.org${path}`, changeFrequency: path === "/news" ? "weekly" : "monthly" }));
}
