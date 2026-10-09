import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import {
  Recycle,
  GraduationCap,
  HeartHandshake,
  FlaskConical,
  ArrowDownRight,
} from "lucide-react";
import { locale, supabase } from "@/lib/supabase";
import { content } from "@/lib/content";
import existing from "@/lib/existing-content.json";
import { text, type Locale } from "@/lib/domain";
import PublicForm from "@/components/PublicForm";
import { AuthTools, AuthHome } from "@/components/SiteFrame";
const icons = [Recycle, FlaskConical, GraduationCap, HeartHandshake];
function Pillars({ l }: { l: Locale }) {
  return (
    <div className="grid four">
      {content[l].pillars.map(([title, body], i) => {
        const Icon = icons[i];
        return (
          <article className="card" key={title}>
            <div className="icon">
              <Icon size={24} />
            </div>
            <span className="number">0{i + 1}</span>
            <h3>{title}</h3>
            <p>{body}</p>
          </article>
        );
      })}
    </div>
  );
}
function CTA({ l }: { l: Locale }) {
  return (
    <div className="cta">
      <div>
        <h2>
          {text(l, "Chaque engagement compte.", "Every contribution matters.")}
        </h2>
        <p className="lead">
          {text(
            l,
            "Votre temps, vos compétences, votre soutien : agissons ensemble.",
            "Your time, your skills, your support: let’s take action together.",
          )}
        </p>
      </div>
      <Link className="button" href="/join">
        {text(l, "Nous rejoindre", "Join us")}
      </Link>
    </div>
  );
}
export default async function PublicPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug = [] } = await params;
  const route = slug.join("/");
  const l = await locale();
  const c = content[l];
  const t = (fr: string, en: string) => text(l, fr, en);
  if (route === "gallery") {
    const db = await supabase();
    const { data: mediaRows } = await db
      .from("gallery_media")
      .select("id,media_type,title_fr,title_en,description_fr,description_en,object_path,poster_path,created_at")
      .eq("published", true)
      .order("created_at", { ascending: false })
      .limit(24);
    const galleryItems = (mediaRows || []).map((item) => ({
      ...item,
      url: db.storage.from("gallery-media").getPublicUrl(item.object_path).data.publicUrl,
      poster_url: item.poster_path
        ? db.storage.from("gallery-media").getPublicUrl(item.poster_path).data.publicUrl
        : null,
    }));
    return (
      <>
        <section className="gallery-intro">
          <div className="container gallery-intro-grid">
            <div>
              <p className="eyebrow">ARDTTEMP · {t("Sur le terrain", "On the ground")}</p>
              <h1>{t("ARDTTEMP en image", "ARDTTEMP in pictures")}</h1>
              <p className="lead">
                {t(
                  "Découvrez une action de collecte et de sensibilisation menée avec l’engagement de nos bénévoles.",
                  "See a collection and awareness activity made possible by our volunteers’ commitment.",
                )}
              </p>
            </div>
            <span className="gallery-counter" aria-label={t("Médias publiés", "Published media")}>
              {String(galleryItems.length + 1).padStart(2, "0")} <small>/{String(galleryItems.length + 1).padStart(2, "0")} {t("médias", "items")}</small>
            </span>
          </div>
        </section>
        <section className="section gallery-section">
          <div className="container">
            <article className="gallery-feature">
              <div className="gallery-photo">
                <Image
                  src="/home-collecte.webp"
                  alt={t(
                    "Des bénévoles en gilets réfléchissants participent à une collecte de déchets.",
                    "Volunteers in reflective vests take part in a waste collection activity.",
                  )}
                  fill
                  priority
                  sizes="(max-width: 900px) 100vw, 60vw"
                />
              </div>
              <div className="gallery-copy">
                <p className="eyebrow">{t("Collecte & sensibilisation", "Collection & awareness")}</p>
                <h2>{t("Agir ensemble pour un environnement plus propre.", "Working together for a cleaner environment.")}</h2>
                <p>
                  {t(
                    "Sur le terrain, les bénévoles se mobilisent pour ramasser les déchets et encourager des gestes responsables dans nos communautés.",
                    "On the ground, volunteers work together to collect waste and encourage responsible habits in our communities.",
                  )}
                </p>
                <Link className="button secondary" href="/activities">
                  {t("Voir nos actions", "See our work")}
                </Link>
              </div>
            </article>
            {galleryItems.length > 0 && (
              <div className="gallery-media-grid" aria-label={t("Photos et vidéos récentes", "Recent photos and videos")}>
                {galleryItems.map((item) => (
                  <article className="gallery-media-card" key={item.id}>
                    <div className="gallery-media-visual">
                      {item.media_type === "video" ? (
                        <video
                          src={item.url}
                          poster={item.poster_url || undefined}
                          controls
                          playsInline
                          preload="none"
                        />
                      ) : (
                        <img
                          src={item.url}
                          alt={l === "fr" ? item.title_fr : item.title_en}
                          loading="lazy"
                          decoding="async"
                        />
                      )}
                    </div>
                    <div className="gallery-media-caption">
                      <h3>{l === "fr" ? item.title_fr : item.title_en}</h3>
                      {(l === "fr" ? item.description_fr : item.description_en) && (
                        <p>{l === "fr" ? item.description_fr : item.description_en}</p>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
            <p className="gallery-note">
              {t(
                "Cette galerie s’enrichira au fil des prochaines activités d’ARDTTEMP.",
                "This gallery will grow with ARDTTEMP’s upcoming activities.",
              )}
            </p>
          </div>
        </section>
        <section className="section pale">
          <div className="container">
            <CTA l={l} />
          </div>
        </section>
      </>
    );
  }
  if (!route)
    return (
      <>
        <section className="home-hero">
          <div className="container">
            <div className="home-hero-grid">
              <div className="home-hero-copy">
                <h1>
                  {l === "fr" ? (
                    <>
                      <span>Transformons notre</span>
                      <span className="home-heading-accent">environnement</span>
                      <span>ensemble.</span>
                    </>
                  ) : (
                    <>
                      <span>Let’s transform our</span>
                      <span className="home-heading-accent">environment</span>
                      <span>together.</span>
                    </>
                  )}
                </h1>
                <p className="lead">{c.mission}</p>
                <div className="actions">
                  <Link className="button secondary" href="/register">
                    {t("Nous rejoindre", "Join us")}
                    <ArrowDownRight size={17} aria-hidden="true" />
                  </Link>
                  <Link className="button hero-login" href="/login">{t("Mon espace membre", "My member area")}</Link>
                </div>
              </div>
            </div>
            <div className="home-facts">
              <div className="fact">
                <span className="fact-index">01</span>
                <strong>2024</strong>
                <span>{t("Année de création", "Founded")}</span>
              </div>
              <div className="fact">
                <span className="fact-index">02</span>
                <strong>04</strong>
                <span>{t("Piliers d’action", "Action pillars")}</span>
              </div>
              <div className="fact">
                <span className="fact-index">03</span>
                <strong>03</strong>
                <span>
                  {t(
                    "Régions pour le projet éducatif",
                    "Regions for the education project",
                  )}
                </span>
              </div>
            </div>
          </div>
        </section>
        <section className="section">
          <div className="container">
            <div className="section-head">
              <div>
                <p className="eyebrow">{t("Notre mission", "Our mission")}</p>
                <h2>
                  {t(
                    "L’écologie au service\nde la solidarité.",
                    "Ecology in the service\nof solidarity.",
                  )}
                </h2>
              </div>
              <p>
                {t(
                  "La transformation des déchets plastiques crée des ressources pour les communautés et finance notre engagement social.",
                  "Transforming plastic waste creates resources for communities and funds our social commitment.",
                )}
              </p>
            </div>
            <Pillars l={l} />
          </div>
        </section>
        <section className="section pale">
          <div className="container">
            <p className="eyebrow">{t("Notre procédé", "Our process")}</p>
            <h2>
              {t(
                "Une nouvelle vie pour le plastique.",
                "A new life for plastic.",
              )}
            </h2>
            <div className="process">
              {c.process.map((s, i) => (
                <article key={s}>
                  <span className="number">0{i + 1}</span>
                  <h3>{s}</h3>
                  <p>{c.processBody[i]}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section className="section">
          <div className="container">
            <div className="project">
              <div>
                <p className="eyebrow">
                  {t(
                    "Projet phare · Insertion & éducation",
                    "Flagship project · Education & inclusion",
                  )}
                </p>
                <h2>{c.project}</h2>
                <p className="lead">{c.projectBody}</p>
                <div className="actions">
                  <Link className="button light" href="/donate">
                    {t("Soutenir ce projet", "Support this project")}
                  </Link>
                </div>
              </div>
              <div className="project-aside">
                <strong>CEPE · BEPC</strong>
                <p>Probatoire · Baccalauréat</p>
                <p style={{ marginTop: 25 }}>
                  {t("Centre · Est · Adamaoua", "Centre · East · Adamawa")}
                </p>
              </div>
            </div>
          </div>
        </section>
        <section className="section pale">
          <div className="container">
            <p className="eyebrow">{t("Nos valeurs", "Our values")}</p>
            <h2>
              {t(
                "Un engagement qui nous rassemble.",
                "A commitment that brings us together.",
              )}
            </h2>
            <div className="values">
              {c.values.map((v) => (
                <span key={v}>{v}</span>
              ))}
            </div>
          </div>
        </section>
        <section className="section">
          <div className="container">
            <CTA l={l} />
          </div>
        </section>
      </>
    );
  const titles: Record<string, string> = {
    about: t("Qui sommes-nous ?", "Who are we?"),
    activities: t("Nos programmes d’action", "Our programmes"),
    join: t("Rejoignez le mouvement", "Join the movement"),
    donate: t(
      "Votre soutien change les choses.",
      "Your support makes a difference.",
    ),
    contact: t("Construisons ensemble.", "Let’s build together."),
    news: t("Les nouvelles d’ARDTTEMP", "News from ARDTTEMP"),
    privacy: t("Données personnelles", "Privacy"),
    terms: t("Statuts & modalités d’adhésion", "Statutes & membership terms"),
  };
  if (
    ["login", "register", "forgot-password", "reset-password"].includes(route)
  ) {
    const kind =
      route === "forgot-password"
        ? "forgot"
        : route === "reset-password"
          ? "reset"
          : (route as "login" | "register");
    const headings = {
      login: t("Se connecter", "Sign in"),
      register: t("Créer mon compte", "Create my account"),
      forgot: t("Mot de passe oublié ?", "Forgot your password?"),
      reset: t("Définir mon mot de passe", "Set my password"),
    };
    const descriptions = {
      login: t("Retrouvez votre espace personnel et suivez votre engagement.", "Access your personal space and follow your contribution."),
      register: t("Rejoignez ARDTTEMP en tant que Membre, Bénévole ou Volontaire.", "Join ARDTTEMP as a Member, Volunteer or Field volunteer."),
      forgot: t("Indiquez l’adresse e-mail de votre compte pour recevoir un lien de récupération.", "Enter your account email to receive a recovery link."),
      reset: t("Choisissez un mot de passe personnel d’au moins 12 caractères.", "Choose a personal password of at least 12 characters."),
    };
    const resetUser = kind === "reset" ? await (await supabase()).auth.getUser() : null;
    const illustrated = kind === "login" || kind === "register";
    return <div className={`auth-stage${illustrated ? " auth-illustrated" : ""}`}>
      {illustrated && <aside className="auth-story" aria-label={t("Notre engagement", "Our commitment")}>
        <Image src="/auth-community.webp" alt={t("Des bénévoles mobilisés pour une opération de collecte et de recyclage.", "Volunteers taking part in a collection and recycling activity.")} fill sizes="(max-width: 760px) 100vw, 440px" priority />
        <div className="auth-story-copy">
          <p className="auth-story-label">ARDTTEMP</p>
          <h2>{t("Transformons notre environnement ensemble.", "Let’s transform our environment together.")}</h2>
          <p>{t("Chaque engagement compte. Le vôtre commence ici.", "Every contribution matters. Yours starts here.")}</p>
        </div>
      </aside>}
      <section className={`auth-shell auth-${kind}`} aria-labelledby="auth-title">
        <AuthTools locale={l} />
        <p className="auth-kicker">{t("Espace membre", "Member area")}</p>
        <h1 id="auth-title">{headings[kind]}</h1>
        <p className="auth-description">{descriptions[kind]}</p>
        {kind === "reset" && !resetUser?.data.user ? <div className="auth-expired">
          <p className="notice warning" role="status">{t("Ce lien n’est plus valide. Demandez un nouveau lien pour définir votre mot de passe.", "This link is no longer valid. Request a new link to set your password.")}</p>
          <Link href="/forgot-password" className="button">{t("Recevoir un nouveau lien", "Get a new link")}</Link>
          <Link href="/login" className="link">{t("Retour à la connexion", "Back to sign in")}</Link>
        </div> : <Suspense><PublicForm kind={kind} locale={l} /></Suspense>}
      </section>
      <AuthHome locale={l} />
    </div>;
  }
  if (route.startsWith("news/") && slug.length === 2) {
    const db = await supabase();
    const { data: n, error } = await db
      .from("news")
      .select("*")
      .eq("id", slug[1])
      .eq("published", true)
      .single();
    if (error || !n) notFound();
    return (
      <>
        <section className="page-intro">
          <div className="container prose">
            <p className="eyebrow">{t("Actualités", "News")}</p>
            <h1>{n["title_" + l]}</h1>
            <p>{new Date(n.created_at).toLocaleDateString(l)}</p>
          </div>
        </section>
        <article className="section">
          <div className="container prose article-body">
            {n["content_" + l]}
          </div>
        </article>
      </>
    );
  }
  if (!(route in titles)) notFound();
  return (
    <>
      <section className="page-intro">
        <div className="container">
          <p className="eyebrow">
            ARDTTEMP ·{" "}
            {t("Environnement & solidarité", "Environment & solidarity")}
          </p>
          <h1>{titles[route]}</h1>
          <p className="lead">
            {route === "about"
              ? c.name
              : route === "activities"
                ? c.mission
                : route === "donate"
                  ? t(
                      "Les dons complètent les revenus de notre atelier pour financer la collecte, la transformation et les programmes sociaux.",
                      "Donations complement our workshop income to fund collection, transformation and social programmes.",
                    )
                  : route === "join"
                    ? t(
                        "Donnez du temps, partagez vos compétences ou soutenez nos actions.",
                        "Give your time, share your skills or support our work.",
                      )
                    : route === "contact"
                      ? t(
                          "Une question, un partenariat ou une idée ? Échangeons.",
                          "A question, partnership or idea? Let’s talk.",
                        )
                      : ""}
          </p>
        </div>
      </section>
      <section className="section">
        <div className="container">
          {(route === "about" || route === "activities") && (
            <>
              <div className="prose">
                {existing[l][route]
                  .filter((x) => x.tag !== "h1")
                  .map((x, i) =>
                    x.tag === "h2" ? (
                      <h2 key={i}>{x.text}</h2>
                    ) : x.tag === "h3" || x.tag === "h4" ? (
                      <h3 key={i}>{x.text}</h3>
                    ) : (
                      <p key={i}>{x.text}</p>
                    ),
                  )}
              </div>
              <div style={{ marginTop: 45 }}>
                <CTA l={l} />
              </div>
            </>
          )}
          {route === "join" && (
            <>
              <div className="grid three">
                {(["membre", "benevole", "volontaire"] as const).map((r, i) => (
                  <article className="card" key={r}>
                    <span className="number">0{i + 1}</span>
                    <h2 style={{ fontSize: "1.6rem", marginTop: 15 }}>
                      {r === "membre"
                        ? t("Membre actif", "Active member")
                        : r === "benevole"
                          ? t("Bénévole", "Volunteer")
                          : t("Volontaire", "Field volunteer")}
                    </h2>
                    <p>
                      {r === "membre"
                        ? t(
                            "Participez à la vie associative, aux décisions et aux actions de terrain.",
                            "Participate in association life, decisions and field activities.",
                          )
                        : r === "benevole"
                          ? t(
                              "Donnez de votre temps aux collectes, à la sensibilisation et au soutien des familles.",
                              "Give your time to collection, awareness and family support.",
                            )
                          : t(
                              "Engagez-vous dans les missions et groupes de travail de l’association.",
                              "Get involved in the association’s missions and working groups.",
                            )}
                    </p>
                    <p>
                      {t("Seuil de récompense : ", "Reward threshold: ")}
                      {i === 0 ? "1 200" : "2 500"} {t("points", "points")}
                    </p>
                    <div className="actions">
                      <Link className="button" href="/register">
                        {t("M’inscrire", "Register")}
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
              <div className="card" style={{ marginTop: 28 }}>
                <h3>
                  {t("Membre bienfaiteur / partenaire", "Benefactor / partner")}
                </h3>
                <p>
                  {t(
                    "Entreprises, institutions et particuliers peuvent soutenir nos programmes financièrement ou matériellement.",
                    "Companies, institutions and individuals can support our programmes financially or with resources.",
                  )}
                </p>
                <div className="actions">
                  <Link className="button secondary" href="/donate">
                    {t("Faire un don", "Donate")}
                  </Link>
                  <Link className="button outline" href="/contact">
                    {t("Proposer un partenariat", "Become a partner")}
                  </Link>
                </div>
              </div>
              <div className="prose" style={{ marginTop: 35 }}>
                <h2>{t("Comment ça marche", "How it works")}</h2>
                <p>
                  {t(
                    "Inscription → confirmation email → examen de la demande → approbation, matricule et 50 points → participation aux activités.",
                    "Registration → email confirmation → application review → approval, membership ID and 50 points → participation in activities.",
                  )}
                </p>
                <details>
                  <summary>
                    {t(
                      "Faut-il payer une cotisation pour devenir bénévole ?",
                      "Is there a fee to become a volunteer?",
                    )}
                  </summary>
                  <p>
                    {t(
                      "Non. Les modalités spécifiques aux membres actifs et bienfaiteurs sont présentées lors de l’entretien d’intégration.",
                      "No. Specific terms for active members and benefactors are presented during the onboarding discussion.",
                    )}
                  </p>
                </details>
                <details>
                  <summary>
                    {t(
                      "Puis-je contribuer depuis une autre région ?",
                      "Can I contribute from another region?",
                    )}
                  </summary>
                  <p>
                    {t(
                      "Oui. Notre équipe étudie avec vous les possibilités de contribution à distance et de développement de nouvelles antennes.",
                      "Yes. Our team will discuss remote contributions and the development of new local branches with you.",
                    )}
                  </p>
                </details>
              </div>
            </>
          )}
          {route === "contact" && (
            <div className="grid two">
              <Suspense>
                <PublicForm kind="contact" locale={l} />
              </Suspense>
              <aside className="contact-aside">
                <h2>{t("Restons en contact", "Get in touch")}</h2>
                <p>
                  Rue 7.949, Efoulan
                  <br />
                  Yaoundé, Cameroun
                </p>
                <p>
                  <a className="link" href="tel:+237655508511">
                    +237 655 50 85 11
                  </a>
                  <br />
                  <a className="link" href="tel:+237654145434">
                    +237 654 14 54 34
                  </a>
                </p>
                <p>
                  <a className="link" href="mailto:partnership@ardttemp.org">
                    partnership@ardttemp.org
                  </a>
                </p>
              </aside>
            </div>
          )}
          {route === "donate" && (
            <div className="grid two">
              <Suspense>
                <PublicForm kind="donate" locale={l} />
              </Suspense>
              <aside className="contact-aside">
                <h2>
                  {t("Où va votre don ?", "Where does your donation go?")}
                </h2>
                <p>
                  {t(
                    "Collecte et sensibilisation, fonctionnement de l’atelier et programmes sociaux, dont « Un Jeune un Diplôme ».",
                    "Collection and awareness, workshop operations and social programmes, including “One Young Person, One Diploma”.",
                  )}
                </p>
                <h3 style={{ marginTop: 28 }}>
                  {t(
                    "Des moyens de paiement adaptés",
                    "Flexible payment options",
                  )}
                </h3>
                <p>
                  MTN MoMo · Orange Money
                  <br />
                  {t(
                    "Virement bancaire · Espèces au siège",
                    "Bank transfer · Cash at our office",
                  )}
                </p>
                <p>
                  {t(
                    "Pour un don mensuel, l’équipe vous contactera afin d’organiser les versements.",
                    "For monthly donations, the team will contact you to arrange payments.",
                  )}
                </p>
                <a className="link" href="mailto:partnership@ardttemp.org">
                  {t(
                    "Demander les coordonnées de paiement",
                    "Request payment instructions",
                  )}
                </a>
              </aside>
            </div>
          )}
          {route === "news" && <News l={l} />}
          {route === "privacy" && (
            <div className="prose">
              <h2>
                {t(
                  "Vos données, pour votre engagement",
                  "Your data, for your participation",
                )}
              </h2>
              <p>
                {t(
                  "ARDTTEMP utilise vos coordonnées pour gérer votre demande d’adhésion, votre compte, vos rapports, vos groupes et vos dons. Les photos et documents d’activités sont accessibles aux personnes autorisées.",
                  "ARDTTEMP uses your contact details to manage your application, account, reports, groups and donations. Activity photos and documents are accessible to authorised people.",
                )}
              </p>
              <p>
                {t(
                  "Les services techniques utilisés sont Supabase, Vercel et Resend. Les cookies de session et de langue servent au fonctionnement du site.",
                  "Technical services used are Supabase, Vercel and Resend. Session and language cookies support website functionality.",
                )}
              </p>
              <p>
                {t(
                  "Pour demander l’accès, la correction ou la suppression de vos données, écrivez à projets@ardttemp.org. Les justificatifs de dons et les éléments soumis à une obligation de conservation peuvent être conservés par l’association.",
                  "To request access, correction or deletion of your data, write to projets@ardttemp.org. Donation records and records subject to retention obligations may be retained by the association.",
                )}
              </p>
            </div>
          )}
          {route === "terms" && (
            <div className="prose">
              <h2>
                {t(
                  "Consulter les statuts officiels",
                  "Read the official statutes",
                )}
              </h2>
              <p>
                {t(
                  "Pour obtenir les statuts et le règlement intérieur officiels avant votre adhésion, contactez partnership@ardttemp.org. Aucun document officiel n’a été fourni pour publication sur cette page.",
                  "To obtain the official statutes and internal rules before joining, contact partnership@ardttemp.org. No official document has been supplied for publication on this page.",
                )}
              </p>
              <h2>
                {t(
                  "Fonctionnement de l’espace membre",
                  "How the member area works",
                )}
              </h2>
              <p>
                {t(
                  "L’inscription est examinée par l’équipe. Seuls les comptes approuvés participent aux groupes et envoient des rapports. L’approbation attribue un matricule et 50 points. Les rapports validés rapportent 5, 10, 15 ou 20 points.",
                  "Applications are reviewed by the team. Only approved accounts participate in groups and submit reports. Approval grants a membership ID and 50 points. Approved reports earn 5, 10, 15 or 20 points.",
                )}
              </p>
              <p>
                {t(
                  "Les seuils de récompense sont de 1 200 points pour les membres et de 2 500 pour les bénévoles et volontaires. Les récompenses sont soumises à validation, sans remise à zéro des points.",
                  "Reward thresholds are 1,200 points for members and 2,500 for volunteers and field volunteers. Rewards require approval and points are retained.",
                )}
              </p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
async function News({ l }: { l: Locale }) {
  const db = await supabase();
  const { data, error } = await db
    .from("news")
    .select("id,title_fr,title_en,content_fr,content_en,created_at")
    .eq("published", true)
    .order("created_at", { ascending: false });
  if (error)
    return (
      <p className="notice error">
        {text(
          l,
          "Les actualités sont temporairement indisponibles.",
          "News is temporarily unavailable.",
        )}
      </p>
    );
  if (!data?.length)
    return (
      <div className="empty">
        {text(
          l,
          "Nos prochaines actualités seront publiées ici.",
          "Our next updates will appear here.",
        )}
      </div>
    );
  return (
    <div className="grid three">
      {data.map((n) => (
        <article className="card news-card" key={n.id}>
          <time>{new Date(n.created_at).toLocaleDateString(l)}</time>
          <h2>{n[("title_" + l) as "title_fr" | "title_en"]}</h2>
          <p>
            {n[("content_" + l) as "content_fr" | "content_en"].slice(0, 180)}…
          </p>
          <div className="actions">
            <Link className="link" href={"/news/" + n.id}>
              {text(l, "Lire l’article", "Read article")}
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}
