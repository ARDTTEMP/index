import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  async redirects() {
    return [
      "about",
      "activities",
      "news",
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
        { source: "/donate", destination: "/join", permanent: true },
        { source: "/donate.html", destination: "/join", permanent: true },
        { source: "/en/donate.html", destination: "/join?lang=en", permanent: true },
        { source: "/index.html", destination: "/", permanent: true },
        { source: "/en/index.html", destination: "/?lang=en", permanent: true },
      ]);
  },
};
export default config;
