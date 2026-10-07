import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  async redirects() {
    return [
      "about",
      "activities",
      "news",
      "donate",
      "join",
      "contact",
      "login",
      "register",
    ]
      .flatMap((p) => [
        { source: `/${p}.html`, destination: `/${p}`, permanent: true },
        {
          source: `/en/${p}.html`,
          destination: `/${p}?lang=en`,
          permanent: true,
        },
      ])
      .concat([
        { source: "/index.html", destination: "/", permanent: true },
        { source: "/en/index.html", destination: "/?lang=en", permanent: true },
      ]);
  },
};
export default config;
