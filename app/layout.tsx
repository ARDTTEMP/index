import type { Metadata } from "next";
import "./globals.css";
import {headers} from "next/headers";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SiteFrame from "@/components/SiteFrame";
import { locale } from "@/lib/supabase";
export const metadata: Metadata = {
  metadataBase: new URL("https://www.ardttemp.org"),
  title: {
    default: "ARDTTEMP — Transformons notre Environnement Ensemble",
    template: "%s | ARDTTEMP",
  },
  applicationName: "ARDTTEMP",
  openGraph: { type: "website", siteName: "ARDTTEMP", locale: "fr_CM", title: "ARDTTEMP — Transformons notre Environnement Ensemble", description: "Recyclage des plastiques, éducation et solidarité au Cameroun.", images: [{ url: "/logo.png", alt: "ARDTTEMP" }] },
  twitter: { card: "summary", title: "ARDTTEMP", images: ["/logo.png"] },
  description:
    "Association camerounaise de recherche et de transformation écologique des matières plastiques. Collecte, éducation et solidarité.",
};
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const l = await locale();
  const shopDomain=(await headers()).get("host")?.split(":")[0] === "shop.ardttemp.org";
  return (
    <html lang={l}>
      <body>
        <SiteFrame shopDomain={shopDomain} header={<Header locale={l} shopDomain={shopDomain} />} footer={<Footer locale={l} />}>
          {children}
        </SiteFrame>
      </body>
    </html>
  );
}
