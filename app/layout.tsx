import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { locale } from "@/lib/supabase";
export const metadata: Metadata = {
  metadataBase: new URL("https://www.ardttemp.org"),
  title: {
    default: "ARDTTEMP — Transformons notre Environnement Ensemble",
    template: "%s | ARDTTEMP",
  },
  description:
    "Association camerounaise de recherche et de transformation écologique des matières plastiques. Collecte, éducation et solidarité.",
};
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const l = await locale();
  return (
    <html lang={l}>
      <body>
        <Header locale={l} />
        <main id="main">{children}</main>
        <Footer locale={l} />
      </body>
    </html>
  );
}
