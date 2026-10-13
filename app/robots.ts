import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/dashboard", "/admin", "/auth/", "/payment/", "/previews/"] }, sitemap: "https://www.ardttemp.org/sitemap.xml" };
}
