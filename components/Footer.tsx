import Newsletter from "./Newsletter";
import { type Locale, text } from "@/lib/domain";
export default function Footer({ locale: l }: { locale: Locale }) {
 const t = (fr: string, en: string) => text(l, fr, en);
 return (
  <footer className="site-footer">
    <div className="container">
      <div className="footer-grid">
        <div>
          <a href="/" className="brand" style={{ color: '#fff', marginBottom: '1rem', display: 'inline-flex' }}>
            <img src="/logo.png" alt="Logo ARDTTEMP" className="brand-mark" width="50" height="50" loading="lazy" />
            <span className="brand-text">
              <strong style={{ color: '#fff' }}>ARDTTEMP</strong>
              <span style={{ color: '#a9c2b1' }}>{t('Transformons notre Environnement Ensemble', 'Let’s Transform Our Environment Together')}</span>
            </span>
          </a>
          <p>{t('Recherche et développement des techniques de transformation écologique des matières plastiques au Cameroun.', 'Research and development of ecological plastic transformation techniques in Cameroon.')}</p>
          <div className="social-row">
            <a href="#" aria-label="ARDTTEMP sur Facebook"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12a10 10 0 10-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.4h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0022 12z"/></svg></a>
            <a href="#" aria-label="ARDTTEMP sur Instagram"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1"/></svg></a>
            <a href="#" aria-label="ARDTTEMP sur LinkedIn"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M4.98 3.5a2.5 2.5 0 11-.02 5 2.5 2.5 0 01.02-5zM3 9h4v12H3V9zm7 0h3.8v1.7h.05c.53-1 1.83-2 3.77-2 4.03 0 4.78 2.6 4.78 6V21H18v-5.4c0-1.3-.02-3-1.85-3-1.85 0-2.13 1.4-2.13 2.9V21H10V9z"/></svg></a>
          </div>
        </div>

        <div>
          <h3>{t('Navigation', 'Navigation')}</h3>
          <ul className="footer-links">
            <li><a href="/about">{t('Qui sommes-nous', 'About us')}</a></li>
            <li><a href="/activities">{t('Nos activités', 'Our activities')}</a></li>
            <li><a href="/news">{t('Actualités', 'News')}</a></li>
            <li><a href="/join">{t('Adhérer', 'Join us')}</a></li>
            <li><a href="/donate">{t('Faire un don', 'Donate')}</a></li>
          </ul>
        </div>

        <div>
          <h3>Contact</h3>
          <ul className="footer-contact">
            <li>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" style={{ flexShrink: '0' }}><path d="M21 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3 19.5 19.5 0 01-6-6 19.8 19.8 0 01-3-8.7A2 2 0 013.2 2h3a2 2 0 012 1.7c.1.9.3 1.8.6 2.7a2 2 0 01-.5 2.1L7 9.8a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.5c.9.3 1.8.5 2.7.6a2 2 0 011.9 2.3z"/></svg>
              <span><a href="tel:+237655508511">+237 655 50 85 11</a><br /><a href="tel:+237654145434">+237 654 14 54 34</a></span>
            </li>
            <li>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" style={{ flexShrink: '0' }}><path d="M4 4h16v16H4z" opacity="0"/><path d="M21 8l-9 6-9-6M3 8v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2z"/></svg>
              <a href="mailto:partnership@ardttemp.org">partnership@ardttemp.org</a>
            </li>
            <li>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" style={{ flexShrink: '0' }}><path d="M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
              <span>Rue 7.949, Efoulan, Yaoundé, Cameroun</span>
            </li>
            
          </ul>
        </div>

        <div>
          <h3>{t('Restez informé', 'Stay informed')}</h3>
          <p>{t("Recevez nos actualités et l'avancée de nos projets directement par e-mail.", 'Receive our news and project updates directly by email.')}</p>
<Newsletter l={l} legacy />
        </div>
      </div>

      <div className="footer-bottom">
        <p>© <span>{new Date().getFullYear()}</span> ARDTTEMP. {t("Tous droits réservés.", "All rights reserved.")}</p>
        <p>{t('Site conçu avec engagement pour un Cameroun plus propre et plus solidaire.', 'A website built with commitment to a cleaner, more supportive Cameroon.')}</p>
      </div>
    </div>
  </footer>
 );
}
