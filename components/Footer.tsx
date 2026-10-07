import Link from "next/link";
import Newsletter from "./Newsletter";
import { type Locale, text } from "@/lib/domain";
export default function Footer({ locale: l }: { locale: Locale }) {
  const t = (fr: string, en: string) => text(l, fr, en);
  return (
    <footer>
      <div className="container footer-grid">
        <div>
          <strong className="footer-brand">ARDTTEMP</strong>
          <p>
            {t(
              "Transformons notre Environnement Ensemble",
              "Let’s Transform Our Environment Together",
            )}
          </p>
          <p>
            {t(
              "Recherche, solidarité et développement durable au Cameroun depuis 2024.",
              "Research, solidarity and sustainable development in Cameroon since 2024.",
            )}
          </p>
        </div>
        <div>
          <h3>{t("L’association", "Association")}</h3>
          <Link href="/about">{t("Qui sommes-nous", "About us")}</Link>
          <Link href="/activities">{t("Programmes", "Programmes")}</Link>
          <Link href="/news">{t("Actualités", "News")}</Link>
          <Link href="/join">{t("Nous rejoindre", "Join us")}</Link>
        </div>
        <div>
          <h3>Contact</h3>
          <p>
            Rue 7.949, Efoulan
            <br />
            Yaoundé, Cameroun
          </p>
          <a href="tel:+237655508511">+237 655 50 85 11</a>
          <a href="tel:+237654145434">+237 654 14 54 34</a>
          <a href="mailto:partnership@ardttemp.org">partnership@ardttemp.org</a>
        </div>
        <div>
          <h3>{t("Agir avec nous", "Get involved")}</h3>
          <Newsletter l={l} />
          <Link href="/donate">
            {t("Soutenir nos actions", "Support our work")}
          </Link>
          <Link href="/register">{t("Devenir membre", "Become a member")}</Link>
          <Link href="/contact">
            {t("Proposer un partenariat", "Partner with us")}
          </Link>
          <a href="mailto:projets@ardttemp.org">
            {t("Administration du site", "Website administration")}
          </a>
          <Link href="/privacy">{t("Données personnelles", "Privacy")}</Link>
          <Link href="/terms">
            {t("Statuts & règlement", "Statutes & rules")}
          </Link>
        </div>
      </div>
      <div className="container footer-bottom">
        © {new Date().getFullYear()} ARDTTEMP{" "}
        <span>
          {t(
            "Environnement. Ressources. Dignité.",
            "Environment. Resources. Dignity.",
          )}
        </span>
      </div>
    </footer>
  );
}
