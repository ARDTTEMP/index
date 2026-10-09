"use client";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  REGIONS,
  memberRoles,
  roleLabels,
  statusLabels,
  threshold,
  rewardProgress,
  isAdmin,
  text,
  type Locale,
  type Profile,
} from "@/lib/domain";
import { api } from "./PublicForm";
import MediaManager from "./MediaManager";
import NewsEditor from "./NewsEditor";
import { Avatar, AvatarUploader, DuesPanel } from "./PersonalFeatures";
import { optimizeImage } from "./MediaManager";
import { AuthTools } from "./SiteFrame";
import {
  LayoutDashboard,
  UserRound,
  FileText,
  UsersRound,
  Award,
  ShieldCheck,
  ClipboardCheck,
  ImageIcon,
  HeartHandshake,
  Newspaper,
  LogOut,
  ArrowUpRight,
  Leaf,
} from "lucide-react";
type Row = Record<string, any>;
export default function Workspace({
  initialProfile,
  view,
  locale: l,
}: {
  initialProfile: Profile;
  view: string;
  locale: Locale;
}) {
  const [profile, setProfile] = useState(initialProfile);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const router = useRouter();
  const t = (fr: string, en: string) => text(l, fr, en);
  const admin = isAdmin(profile.role) && profile.status === "approved";
  const groupId = view.startsWith("groups/") ? view.split("/")[1] : null;
  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const actual = groupId
          ? "messages"
          : view === "reports/new"
            ? "reports"
            : view;
        const r = await fetch(
          "/api/platform?view=" +
            encodeURIComponent(actual) +
            (groupId ? "&group=" + groupId : ""),
          { cache: "no-store" },
        );
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setProfile(d.profile);
        setData(d.data);
        setError("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error");
      } finally {
        setLoading(false);
      }
    },
    [view, groupId],
  );
  useEffect(() => {
    void load();
    const refresh = () => {
      if (document.visibilityState === "visible" && view !== "admin/news")
        void load(true);
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    const timer = setInterval(refresh, groupId ? 5000 : 15000);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [load, groupId]);
  async function act(body: Record<string, unknown>) {
    setError("");
    try {
      const r = await api(body);
      setNotice(
        body.op === "create_admin"
          ? t(
              "Invitation envoyée. L’administrateur pourra définir son mot de passe depuis le lien reçu.",
              "Invitation sent. The administrator can set a password from the link they receive.",
            )
          : r.invite_url || t("Modification enregistrée.", "Change saved."),
      );
      await load(true);
      return r;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      throw e;
    }
  }
  const status = (s: string) => (
    <span className={"badge " + s}>
      {statusLabels[l][s as keyof typeof statusLabels.fr] || s}
    </span>
  );
  const labels: Record<string, string> = {
    overview: t("Mon engagement", "My contribution"),
    profile: t("Mon profil", "My profile"),
    dues: t("Ma cotisation", "My membership fee"),
    "admin/dues": t("Cotisations", "Membership payments"),
    reports: t("Mes rapports", "My reports"),
    "reports/new": t("Nouveau rapport", "New report"),
    groups: t("Mes groupes", "My groups"),
    rewards: t("Mes récompenses", "My rewards"),
    "admin/overview": t("Administration", "Administration"),
    "admin/requests": t("Demandes d’adhésion", "Membership applications"),
    "admin/reports": t("Rapports à examiner", "Report reviews"),
    "admin/members": t("Comptes & rôles", "Accounts & roles"),
    "admin/news": t("Actualités bilingues", "Bilingual news"),
    "admin/media": t("Photos & vidéos", "Photos & videos"),
    "admin/donations": t("Suivi des dons", "Donation tracking"),
    "admin/groups": t("Groupes de travail", "Working groups"),
    "admin/rewards": t("Gestion des récompenses", "Reward management"),
  };
  const memberNav = [
    "overview",
    "profile",
    "dues",
    "reports",
    "groups",
    "rewards",
  ];
  const navIcons: Record<string, typeof Leaf> = {
    overview: LayoutDashboard,
    profile: UserRound,
    reports: FileText,
    groups: UsersRound,
    rewards: Award,
    dues: HeartHandshake,
    "admin/dues": HeartHandshake,
    "admin/overview": ShieldCheck,
    "admin/requests": ClipboardCheck,
    "admin/reports": FileText,
    "admin/members": UsersRound,
    "admin/news": Newspaper,
    "admin/media": ImageIcon,
    "admin/donations": HeartHandshake,
    "admin/groups": UsersRound,
    "admin/rewards": Award,
  };
  const roleWelcome = {
    super_admin: t(
      "Pilotez l’association et les responsabilités de chacun.",
      "Lead the association and manage responsibilities.",
    ),
    admin: t(
      "Accompagnez les adhésions et valorisez les actions de terrain.",
      "Review applications and recognise work on the ground.",
    ),
    membre: t(
      "Votre engagement fait avancer notre communauté.",
      "Your contribution moves our community forward.",
    ),
    benevole: t(
      "Votre temps et vos compétences font la différence.",
      "Your time and skills make a difference.",
    ),
    volontaire: t(
      "Passez à l’action, partagez vos missions et suivez votre impact.",
      "Take action, share your missions and track your impact.",
    ),
  };
  const adminNav = [
    "admin/overview",
    "admin/requests",
    "admin/reports",
    "admin/members",
    "admin/news",
    "admin/media",
    "admin/donations",
    "admin/dues",
    "admin/groups",
    "admin/rewards",
  ];
  const permitted = profile.status === "approved";
  const reward = threshold(profile.role);
  const rewards: Row[] =
    view === "overview"
      ? data?.rewards || []
      : view === "rewards"
        ? data || []
        : [];
  const used = rewards.filter((r: Row) => r.status !== "rejected").length;
  const eligible = reward !== null && profile.points >= reward * (used + 1);
  return (
    <div className="dashboard-shell">
      <aside
        className="sidebar"
        aria-label={t("Navigation de votre espace", "Workspace navigation")}
      >
        <AuthTools locale={l} />
        <div className="sidebar-identity">
          <Avatar name={profile.full_name} url={profile.avatar_url} />
          <div>
            <b>{profile.full_name}</b>
            <small>{roleLabels[l][profile.role]}</small>
          </div>
        </div>
        <strong>{t("ESPACE MEMBRE", "MEMBER AREA")}</strong>
        {memberNav
          .filter((v) => profile.role !== "super_admin" || v !== "rewards")
          .map((v) => {
            const Icon = navIcons[v];
            return (
              <Link
                key={v}
                href={v === "overview" ? "/dashboard" : "/dashboard/" + v}
                className={
                  view === v || view.startsWith(v + "/") ? "active" : ""
                }
              >
                <Icon size={18} aria-hidden="true" />
                {labels[v]}
              </Link>
            );
          })}
        {admin && (
          <>
            <hr />
            <strong>{t("ADMINISTRATION", "ADMINISTRATION")}</strong>
            {adminNav.map((v) => {
              const Icon = navIcons[v];
              return (
                <Link
                  key={v}
                  href={
                    v === "admin/overview"
                      ? "/dashboard/admin"
                      : "/dashboard/" + v
                  }
                  className={view === v ? "active" : ""}
                >
                  <Icon size={18} aria-hidden="true" />
                  {labels[v]}
                </Link>
              );
            })}
          </>
        )}
        <hr />
        <Link href="/">
          {t("Voir le site public ↗", "View public website ↗")}
        </Link>
        <button
          className="button outline small"
          onClick={async () => {
            await api({ op: "logout" });
            router.push("/login");
            router.refresh();
          }}
        >
          <LogOut size={16} aria-hidden="true" />
          {t("Déconnexion", "Sign out")}
        </button>
      </aside>
      <div className="workspace">
        <div className="toolbar">
          <div>
            <p className="eyebrow">
              {profile.full_name} · {roleLabels[l][profile.role]}
            </p>
            <h1>
              {groupId
                ? data?.group?.name || t("Discussion", "Discussion")
                : labels[view]}
            </h1>
          </div>
          {status(profile.status)}
        </div>
        {(view === "overview" || view === "admin/overview") && (
          <section className="member-welcome">
            <div>
              <p className="eyebrow">
                {t("ESPACE", "AREA")} {roleLabels[l][profile.role]}
              </p>
              <h2>
                {t("Bonjour", "Hello")},{" "}
                {profile.full_name.trim().split(/\s+/)[0]}.
              </h2>
              <p>{roleWelcome[profile.role]}</p>
            </div>
            <Leaf
              className="welcome-leaf"
              size={74}
              strokeWidth={1}
              aria-hidden="true"
            />
            {admin && view === "overview" && (
              <Link className="button light" href="/dashboard/admin">
                {t("Gérer l’association", "Manage the association")}
                <ArrowUpRight size={18} aria-hidden="true" />
              </Link>
            )}
          </section>
        )}
        {!permitted && (
          <div className="notice warning">
            {profile.status === "pending"
              ? t(
                  "Votre adhésion est en attente de validation. Vous pouvez consulter votre profil. Les rapports et les groupes seront disponibles après approbation.",
                  "Your membership is pending review. You can view your profile. Reports and groups will be available after approval.",
                )
              : profile.status === "suspended"
                ? t(
                    "Votre compte est suspendu. Contactez l’association pour plus d’informations.",
                    "Your account is suspended. Contact the association for more information.",
                  )
                : t(
                    "Votre demande a été refusée. Contactez l’équipe pour connaître les suites possibles.",
                    "Your application was declined. Contact the team to discuss possible next steps.",
                  )}
          </div>
        )}
        {error && (
          <div className="notice error" role="alert">
            {error}
          </div>
        )}
        {notice && (
          <div className="notice" role="status">
            {notice}
          </div>
        )}
        {loading ? (
          <div className="loading">{t("Chargement…", "Loading…")}</div>
        ) : (
          <>
            {view === "overview" && (
              <>
                <div
                  className={
                    profile.role === "super_admin" ? "grid" : "grid two"
                  }
                >
                  {profile.role !== "super_admin" && (
                    <div className="card">
                      <h3>{t("Points d’engagement", "Engagement points")}</h3>
                      <div className="points-value">
                        {profile.points}
                        <span style={{ fontSize: "1rem", marginLeft: 10 }}>
                          pts
                        </span>
                      </div>
                      {reward !== null ? (
                        <>
                          <div
                            className="progress"
                            role="progressbar"
                            aria-label={t(
                              "Progression vers la récompense",
                              "Reward progress",
                            )}
                            aria-valuenow={Math.min(profile.points, reward)}
                            aria-valuemin={0}
                            aria-valuemax={reward}
                          >
                            <div
                              style={{
                                width:
                                  rewardProgress(profile.points, profile.role) +
                                  "%",
                              }}
                            />
                          </div>
                          <p>
                            {profile.points} / {reward} pts
                          </p>
                          <p>
                            {t(
                              "Les points sont conservés après une récompense.",
                              "Points are retained after a reward.",
                            )}
                          </p>
                          {eligible && permitted && (
                            <div className="actions">
                              <Link
                                className="button"
                                href="/dashboard/rewards"
                              >
                                {t("Récompense disponible", "Reward available")}
                              </Link>
                            </div>
                          )}
                        </>
                      ) : (
                        <p>
                          {t(
                            "Les administrateurs gèrent les récompenses ; aucun seuil automatique ne s’applique.",
                            "Administrators manage rewards; no automatic threshold applies.",
                          )}
                        </p>
                      )}
                    </div>
                  )}
                  <div className="card">
                    <h3>{t("Ma carte de membre", "My membership card")}</h3>
                    <h2 style={{ fontSize: "1.8rem", marginTop: 30 }}>
                      {profile.matricule ||
                        t("En attente de matricule", "Membership ID pending")}
                    </h2>
                    <p>{profile.full_name}</p>
                    <p>
                      {profile.city} · {profile.region}
                    </p>
                    <p>{roleLabels[l][profile.role]}</p>
                  </div>
                </div>
                <div className="actions">
                  <Link className="button outline" href="/dashboard/profile">
                    {t("Mon profil", "My profile")}
                  </Link>
                  {permitted && (
                    <>
                      <Link className="button" href="/dashboard/reports/new">
                        {t("Envoyer un rapport", "Submit a report")}
                      </Link>
                      <Link className="button outline" href="/dashboard/groups">
                        {t("Mes groupes", "My groups")}
                      </Link>
                    </>
                  )}
                  <Link className="button outline" href="/news">
                    {t("Lire les actualités", "Read news")}
                  </Link>
                </div>
                {profile.role !== "super_admin" && (
                  <>
                    <h2 style={{ margin: "35px 0 20px", fontSize: "1.5rem" }}>
                      {t("Historique des points", "Points history")}
                    </h2>
                    {!data?.history?.length ? (
                      <Empty l={l} />
                    ) : (
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>{t("Date", "Date")}</th>
                              <th>{t("Motif", "Reason")}</th>
                              <th>Points</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.history.map((r: Row) => (
                              <tr key={r.id}>
                                <td>{date(r.created_at, l)}</td>
                                <td>
                                  {r.reason === "membership_approved"
                                    ? t(
                                        "Adhésion approuvée",
                                        "Membership approved",
                                      )
                                    : r.reason === "dues_confirmed"
                                      ? t(
                                          "Cotisation confirmée",
                                          "Membership dues confirmed",
                                        )
                                      : t("Rapport validé", "Report approved")}
                                </td>
                                <td>+{r.points}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
            {view === "profile" && (
              <AvatarUploader
                profile={profile}
                l={l}
                refresh={() => load(true)}
              />
            )}
            {(view === "dues" || view === "admin/dues") && data?.settings && (
              <DuesPanel
                data={data}
                profile={profile}
                admin={view === "admin/dues"}
                l={l}
                act={act}
              />
            )}
            {view === "profile" && (
              <OperationForm op="profile" act={act} l={l}>
                <div className="form-grid">
                  <label>
                    {t("Nom complet", "Full name")}
                    <input
                      name="full_name"
                      required
                      defaultValue={profile.full_name}
                    />
                  </label>
                  <label>
                    Email
                    <input readOnly value={profile.email} />
                  </label>
                  <label>
                    {t("Téléphone", "Phone")}
                    <input
                      name="phone"
                      type="tel"
                      required
                      defaultValue={profile.phone || ""}
                    />
                  </label>
                  <label>
                    {t("Ville", "City")}
                    <input
                      name="city"
                      required
                      defaultValue={profile.city || ""}
                    />
                  </label>
                </div>
                <Region l={l} value={profile.region || ""} />
                <label>
                  {t("Présentation", "Bio")}
                  <textarea
                    name="bio"
                    defaultValue={profile.bio || ""}
                    maxLength={2000}
                  />
                </label>
                <label>
                  {t("Langue des emails", "Email language")}
                  <select name="locale" defaultValue={profile.locale}>
                    <option value="fr">Français</option>
                    <option value="en">English</option>
                  </select>
                </label>
                <p className="form-note">
                  {t(
                    "Le rôle, le matricule, le statut et les points sont gérés par l’association.",
                    "Your role, membership ID, status and points are managed by the association.",
                  )}
                </p>
              </OperationForm>
            )}
            {view === "reports" && (
              <>
                <div className="toolbar">
                  <p>
                    {t(
                      "Vos activités, vos résultats, votre impact.",
                      "Your activities, results and impact.",
                    )}
                  </p>
                  {permitted && !admin && (
                    <Link href="/dashboard/reports/new" className="button">
                      {t("Nouveau rapport", "New report")}
                    </Link>
                  )}
                </div>
                {data?.length ? (
                  data.map((r: Row) => (
                    <ReportCard key={r.id} r={r} l={l} status={status} />
                  ))
                ) : (
                  <Empty l={l} />
                )}
              </>
            )}
            {view === "reports/new" &&
              (permitted && !admin ? (
                <ReportForm l={l} act={act} />
              ) : (
                <div className="notice warning">
                  {t(
                    "Seuls les membres, bénévoles et volontaires approuvés peuvent envoyer un rapport.",
                    "Only approved members, volunteers and field volunteers may submit reports.",
                  )}
                </div>
              ))}
            {view === "groups" &&
              (permitted ? (
                <>
                  {data?.length ? (
                    data.map((g: Row) => (
                      <article className="card" key={g.id}>
                        <h3>{g.name}</h3>
                        <p>{g.description}</p>
                        <p>{g.category}</p>
                        <div className="actions">
                          <Link
                            className="button"
                            href={"/dashboard/groups/" + g.id}
                          >
                            {t("Ouvrir la discussion", "Open discussion")}
                          </Link>
                        </div>
                      </article>
                    ))
                  ) : (
                    <Empty l={l} />
                  )}
                </>
              ) : null)}
            {groupId && permitted && (
              <>
                <p style={{ marginBottom: 20 }}>{data?.group?.description}</p>
                <div className="chat">
                  {data?.messages?.length ? (
                    data.messages.map((m: Row) => (
                      <article
                        className={
                          "chat-message " +
                          (m.user_id === profile.id ? "mine" : "")
                        }
                        key={m.id}
                      >
                        <div className="chat-author">
                          <Avatar
                            small
                            name={
                              m.profiles?.full_name ||
                              t("Participant", "Participant")
                            }
                            url={m.profiles?.avatar_url}
                          />
                          <strong>
                            {m.profiles?.full_name ||
                              t("Participant", "Participant")}
                          </strong>
                        </div>
                        <p>{m.content}</p>
                        {m.attachment_url && (
                          <FileLink
                            bucket="group-files"
                            path={m.attachment_url}
                            l={l}
                          />
                        )}
                        <small>{date(m.created_at, l)}</small>
                      </article>
                    ))
                  ) : (
                    <p>
                      {t(
                        "Commencez la conversation.",
                        "Start the conversation.",
                      )}
                    </p>
                  )}
                </div>
                <MessageForm group={groupId} l={l} act={act} />
              </>
            )}
            {view === "rewards" && profile.role !== "super_admin" && (
              <>
                <p className="lead" style={{ marginBottom: 25 }}>
                  {t(
                    "Choisissez votre récompense une fois le seuil atteint. Elle sera examinée par l’équipe. Vos points restent acquis.",
                    "Choose your reward once you reach your threshold. The team will review it. Your points are retained.",
                  )}
                </p>
                {reward !== null && (
                  <div className="notice">
                    {profile.points} / {reward} pts ·{" "}
                    {t("Prochain palier : ", "Next milestone: ")}
                    {reward * (used + 1)} pts
                  </div>
                )}
                {eligible && permitted && (
                  <OperationForm
                    op="request_reward"
                    act={act}
                    l={l}
                    submit={t(
                      "Demander cette récompense",
                      "Request this reward",
                    )}
                  >
                    <RewardSelect l={l} />
                  </OperationForm>
                )}
                <div style={{ marginTop: 30 }}>
                  {data?.length ? (
                    data.map((r: Row) => (
                      <article className="card" key={r.id}>
                        <h3>{rewardLabel(r.reward_type, l)}</h3>
                        {status(r.status)}
                        <p>
                          {t("Palier", "Milestone")} {r.milestone} ·{" "}
                          {r.threshold} pts
                        </p>
                        <p>{r.notes}</p>
                      </article>
                    ))
                  ) : (
                    <Empty l={l} />
                  )}
                </div>
              </>
            )}
            {view === "admin/overview" && (
              <div className="grid four">
                {Object.entries(data || {}).map(([key, value]) => (
                  <Link
                    key={key}
                    className="card"
                    href={
                      "/dashboard/admin/" +
                      {
                        membership_requests: "requests",
                        profiles: "members",
                        reports: "reports",
                        donations: "donations",
                      }[key as "profiles"]
                    }
                  >
                    <p>
                      {key === "membership_requests"
                        ? t("Adhésions en attente", "Pending applications")
                        : key === "profiles"
                          ? t("Comptes approuvés", "Approved accounts")
                          : key === "reports"
                            ? t("Rapports en attente", "Pending reports")
                            : t("Dons en attente", "Pending donations")}
                    </p>
                    <strong className="points-value">{String(value)}</strong>
                  </Link>
                ))}
              </div>
            )}
            {view === "admin/requests" && (
              <>
                {data?.length ? (
                  data.map((r: Row) => (
                    <article className="card" key={r.id}>
                      <h3>
                        {r.full_name ||
                          roleLabels[l][
                            r.requested_role as Profile["role"]
                          ]}{" "}
                        · {roleLabels[l][r.requested_role as Profile["role"]]}
                      </h3>
                      <div className="meta">
                        <span>{r.phone}</span>
                        <span>{r.region}</span>
                        <span>{date(r.created_at, l)}</span>
                        <span>{r.user_id}</span>
                      </div>
                      {r.legacy && (
                        <p className="notice">
                          {t(
                            "Compte créé avant la nouvelle procédure d’adhésion. L’approbation activera le profil, attribuera le matricule et les 50 points.",
                            "Account created before the new membership flow. Approval activates the profile, assigns the membership ID and awards 50 points.",
                          )}
                        </p>
                      )}
                      <p>{r.motivation}</p>
                      {status(r.status)}
                      {r.status === "pending" && (
                        <ReviewForm
                          id={r.id}
                          kind="membership"
                          legacy={!!r.legacy}
                          act={act}
                          l={l}
                        />
                      )}
                      <p>{r.admin_comment}</p>
                    </article>
                  ))
                ) : (
                  <Empty l={l} />
                )}
              </>
            )}
            {view === "admin/reports" && (
              <>
                {data?.length ? (
                  data.map((r: Row) => (
                    <ReportCard key={r.id} r={r} l={l} status={status}>
                      {r.status === "pending" && (
                        <ReviewForm id={r.id} kind="report" act={act} l={l} />
                      )}
                    </ReportCard>
                  ))
                ) : (
                  <Empty l={l} />
                )}
              </>
            )}
            {view === "admin/members" && (
              <Members
                rows={data || []}
                profile={profile}
                act={act}
                l={l}
                status={status}
              />
            )}
            {view === "admin/news" && (
              <NewsEditor
                initialData={data || { articles: [], total: 0, page: 1 }}
                act={act}
                l={l}
              />
            )}
            {view === "admin/media" && (
              <MediaManager rows={data || []} act={act} l={l} />
            )}
            {view === "admin/donations" && (
              <>
                {data?.length ? (
                  data.map((r: Row) => (
                    <article className="card" key={r.id}>
                      <h3>
                        {Number(r.amount).toLocaleString(l)} FCFA ·{" "}
                        {r.donor_name}
                      </h3>
                      <div className="meta">
                        <span>{r.donor_email}</span>
                        <span>{r.donor_phone}</span>
                        <span>{r.payment_method || r.payment_provider}</span>
                      </div>
                      {status(r.status)}
                      <p>{r.message}</p>
                      <p>
                        {t("Référence : ", "Reference: ")}
                        {r.id}
                      </p>
                      {r.is_monthly && (
                        <p>
                          {t(
                            "Don mensuel à organiser avec le donateur.",
                            "Monthly donation to arrange with the donor.",
                          )}
                        </p>
                      )}
                      {r.status === "pending" && (
                        <div className="actions">
                          <button
                            className="button"
                            onClick={() => {
                              if (
                                confirm(
                                  t(
                                    "Confirmer uniquement après vérification du paiement reçu.",
                                    "Confirm only after verifying receipt of payment.",
                                  ),
                                )
                              )
                                void act({
                                  op: "complete_donation",
                                  id: r.id,
                                }).catch(() => {});
                            }}
                          >
                            {t(
                              "Confirmer le paiement reçu",
                              "Confirm payment received",
                            )}
                          </button>
                        </div>
                      )}
                    </article>
                  ))
                ) : (
                  <Empty l={l} />
                )}
              </>
            )}
            {view === "admin/groups" && (
              <GroupsAdmin data={data} act={act} l={l} />
            )}
            {view === "admin/rewards" && (
              <>
                {data?.length ? (
                  data.map((r: Row) => (
                    <article className="card" key={r.id}>
                      <h3>{rewardLabel(r.reward_type, l)}</h3>
                      <p>
                        {r.user_id} · {t("Palier", "Milestone")} {r.milestone}
                      </p>
                      {status(r.status)}
                      <p>{r.notes}</p>
                      {["requested", "approved"].includes(r.status) && (
                        <OperationForm op="review_reward" act={act} l={l}>
                          <input type="hidden" name="id" value={r.id} />
                          <label>
                            {t("Décision", "Decision")}
                            <select name="status">
                              {r.status === "requested" ? (
                                <>
                                  <option value="approved">
                                    {t("Approuver", "Approve")}
                                  </option>
                                  <option value="rejected">
                                    {t("Refuser", "Reject")}
                                  </option>
                                </>
                              ) : (
                                <option value="fulfilled">
                                  {t("Récompense réalisée", "Reward fulfilled")}
                                </option>
                              )}
                            </select>
                          </label>
                          <label>
                            {t("Notes", "Notes")}
                            <textarea name="notes" maxLength={2000} />
                          </label>
                        </OperationForm>
                      )}
                    </article>
                  ))
                ) : (
                  <Empty l={l} />
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
function date(v: string, l: Locale) {
  return new Date(v).toLocaleString(l, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
function Empty({ l }: { l: Locale }) {
  return (
    <div className="empty">
      {text(l, "Aucun élément pour le moment.", "No items yet.")}
    </div>
  );
}
function Region({
  l,
  value = "",
  optional = false,
}: {
  l: Locale;
  value?: string;
  optional?: boolean;
}) {
  return (
    <label>
      {text(l, "Région", "Region")}
      <select name="region" required={!optional} defaultValue={value}>
        <option value="">
          {optional
            ? text(l, "Toutes les régions", "All regions")
            : text(l, "Choisir une région", "Choose a region")}
        </option>
        {REGIONS.map((r) => (
          <option key={r}>{r}</option>
        ))}
      </select>
    </label>
  );
}
function rewardLabel(type: string, l: Locale) {
  return type === "formation"
    ? text(l, "Formation gratuite + certificat", "Free training + certificate")
    : type === "voyage_ambassadeur"
      ? text(
          l,
          "Voyage de travail comme ambassadeur",
          "Work trip as an association ambassador",
        )
      : text(
          l,
          "Promotion chef d’équipe ou représentant de zone",
          "Promotion to team leader or zone representative",
        );
}
function RewardSelect({ l }: { l: Locale }) {
  return (
    <label>
      {text(l, "Récompense", "Reward")}
      <select name="reward_type">
        {["formation", "voyage_ambassadeur", "promotion"].map((r) => (
          <option value={r} key={r}>
            {rewardLabel(r, l)}
          </option>
        ))}
      </select>
    </label>
  );
}
function OperationForm({
  op,
  act,
  l,
  children,
  submit,
  transform,
  done,
}: {
  op: string;
  act: (b: Record<string, unknown>) => Promise<any>;
  l: Locale;
  children: ReactNode;
  submit?: string;
  transform?: (b: Record<string, unknown>) => Record<string, unknown>;
  done?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        let b: Record<string, unknown> = Object.fromEntries(
          new FormData(e.currentTarget),
        );
        b = { ...b, op };
        if (transform) b = transform(b);
        try {
          await act(b);
          done?.();
        } catch {
        } finally {
          setBusy(false);
        }
      }}
    >
      {children}
      <button className="button" disabled={busy}>
        {busy
          ? text(l, "En cours…", "Please wait…")
          : submit || text(l, "Enregistrer", "Save")}
      </button>
    </form>
  );
}
function ReviewForm({
  id,
  kind,
  legacy = false,
  act,
  l,
}: {
  id: string;
  kind: "membership" | "report";
  legacy?: boolean;
  act: (b: Record<string, unknown>) => Promise<any>;
  l: Locale;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="review-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const decision = fd.get("decision");
        const comment = String(fd.get("comment") || "");
        if (decision === "reject" && comment.trim().length < 3) {
          alert(
            text(
              l,
              "Un commentaire est obligatoire pour refuser.",
              "A comment is required when declining.",
            ),
          );
          return;
        }
        setBusy(true);
        try {
          await act({
            op: legacy
              ? decision === "reject"
                ? "reject_existing_member"
                : "approve_existing_member"
              : decision === "reject"
                ? "reject_" + kind
                : kind === "report"
                  ? "validate_report"
                  : "approve_membership",
            id,
            comment,
            points: Number(fd.get("points")),
          });
        } catch {
        } finally {
          setBusy(false);
        }
      }}
    >
      <select name="decision" aria-label={text(l, "Décision", "Decision")}>
        <option value="approve">{text(l, "Approuver", "Approve")}</option>
        <option value="reject">{text(l, "Refuser", "Decline")}</option>
      </select>
      {kind === "report" && (
        <select
          name="points"
          defaultValue="15"
          aria-label={text(l, "Points attribués", "Points awarded")}
        >
          {[5, 10, 15, 20].map((x) => (
            <option key={x} value={x}>
              {x} pts
            </option>
          ))}
        </select>
      )}
      <input
        name="comment"
        placeholder={text(
          l,
          "Commentaire — obligatoire en cas de refus",
          "Comment — required when declining",
        )}
        aria-label={text(
          l,
          "Commentaire administrateur",
          "Administrator comment",
        )}
        maxLength={2000}
      />
      <button disabled={busy} className="button">
        {text(l, "Confirmer", "Confirm")}
      </button>
    </form>
  );
}
function ReportCard({
  r,
  l,
  status,
  children,
}: {
  r: Row;
  l: Locale;
  status: (s: string) => ReactNode;
  children?: ReactNode;
}) {
  return (
    <article className="card">
      <h3>{r.title}</h3>
      <div className="meta">
        <span>{r.activity_date}</span>
        <span>{r.location}</span>
        <span>{r.points_awarded ? `+${r.points_awarded} pts` : ""}</span>
      </div>
      {status(r.status)}
      <p>{r.description}</p>
      <div className="actions">
        {r.photo_urls?.map((path: string) => (
          <FileLink key={path} bucket="activity-photos" path={path} l={l} />
        ))}
      </div>
      {r.admin_comment && (
        <p>
          {text(l, "Commentaire : ", "Feedback: ")}
          {r.admin_comment}
        </p>
      )}
      {children}
    </article>
  );
}
function FileLink({
  bucket,
  path,
  l,
}: {
  bucket: string;
  path: string;
  l: Locale;
}) {
  const [error, setError] = useState("");
  return (
    <>
      <button
        type="button"
        className="file-link"
        onClick={async () => {
          const tab = window.open("about:blank", "_blank");
          if (tab) tab.opener = null;
          try {
            const d = await api({ op: "signed_url", bucket, path });
            if (tab) tab.location.href = d.url;
          } catch (e) {
            tab?.close();
            setError(e instanceof Error ? e.message : "Error");
          }
        }}
      >
        {text(
          l,
          bucket === "activity-photos" ? "Voir la photo" : "Ouvrir le fichier",
          bucket === "activity-photos" ? "View photo" : "Open file",
        )}
      </button>
      {error && <span role="alert">{error}</span>}
    </>
  );
}
async function upload(file: File, bucket: string, group?: string) {
  if (file.type.startsWith("image/")) file = await optimizeImage(file);
  const fd = new FormData();
  fd.set("file", file);
  fd.set("bucket", bucket);
  if (group) fd.set("group_id", group);
  const r = await fetch("/api/platform", { method: "POST", body: fd });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error);
  return d.path;
}
function ReportForm({
  l,
  act,
}: {
  l: Locale;
  act: (b: Record<string, unknown>) => Promise<any>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  return (
    <form
      className="form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const fd = new FormData(e.currentTarget);
        try {
          const files = fd
            .getAll("photos")
            .filter((f) => f instanceof File && f.size > 0) as File[];
          if (files.length > 6)
            throw new Error(
              text(l, "Six photos maximum.", "Maximum six photos."),
            );
          const photo_urls = [];
          for (const f of files)
            photo_urls.push(await upload(f, "activity-photos"));
          await act({
            op: "report",
            title: fd.get("title"),
            description: fd.get("description"),
            location: fd.get("location"),
            activity_date: fd.get("activity_date"),
            photo_urls,
          });
          router.push("/dashboard/reports");
        } catch (e) {
          setError(e instanceof Error ? e.message : "Error");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        {text(l, "Titre", "Title")}
        <input name="title" required minLength={3} maxLength={200} />
      </label>
      <div className="form-grid">
        <label>
          {text(l, "Date de l’activité", "Activity date")}
          <input
            name="activity_date"
            type="date"
            required
            max={new Date().toISOString().slice(0, 10)}
          />
        </label>
        <label>
          {text(l, "Lieu", "Location")}
          <input name="location" required minLength={2} />
        </label>
      </div>
      <label>
        Description
        <textarea
          name="description"
          required
          minLength={10}
          maxLength={10000}
        />
      </label>
      <label>
        {text(
          l,
          "Photos — 6 maximum, 5 Mo chacune",
          "Photos — maximum 6, 5 MB each",
        )}
        <input
          name="photos"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
        />
      </label>
      <p className="form-note">
        {text(
          l,
          "Les photos restent privées. Les points sont attribués uniquement après validation par l’équipe.",
          "Photos remain private. Points are awarded only after the team approves your report.",
        )}
      </p>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      <button className="button" disabled={busy}>
        {text(
          l,
          busy ? "Envoi…" : "Envoyer le rapport",
          busy ? "Sending…" : "Submit report",
        )}
      </button>
    </form>
  );
}
function MessageForm({
  group,
  l,
  act,
}: {
  group: string;
  l: Locale;
  act: (b: Record<string, unknown>) => Promise<any>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className="form"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        setBusy(true);
        try {
          const f = fd.get("file");
          const path =
            f instanceof File && f.size
              ? await upload(f, "group-files", group)
              : null;
          await act({
            op: "message",
            group_id: group,
            content: fd.get("content"),
            attachment_url: path,
          });
          form.reset();
          setError("");
        } catch (e) {
          setError(e instanceof Error ? e.message : "Error");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        {text(l, "Votre message", "Your message")}
        <textarea name="content" required minLength={1} maxLength={5000} />
      </label>
      <label>
        {text(
          l,
          "Pièce jointe — image, PDF ou texte, 10 Mo maximum",
          "Attachment — image, PDF or text, maximum 10 MB",
        )}
        <input
          type="file"
          name="file"
          accept="image/jpeg,image/png,image/webp,application/pdf,text/plain"
        />
      </label>
      {error && <p className="notice error">{error}</p>}
      <button className="button" disabled={busy}>
        {text(l, "Envoyer", "Send")}
      </button>
    </form>
  );
}
function Members({
  rows,
  profile,
  act,
  l,
  status,
}: {
  rows: Row[];
  profile: Profile;
  act: (b: Record<string, unknown>) => Promise<any>;
  l: Locale;
  status: (s: string) => ReactNode;
}) {
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [state, setState] = useState("");
  const [showAdminForm, setShowAdminForm] = useState(false);
  const selected = rows.filter(
    (r) =>
      (!role || r.role === role) &&
      (!state || r.status === state) &&
      [r.full_name, r.email, r.city, r.region]
        .join(" ")
        .toLowerCase()
        .includes(q.toLowerCase()),
  );
  return (
    <>
      {profile.role === "super_admin" && (
        <section className="card" aria-labelledby="create-admin-heading">
          <h2 id="create-admin-heading">
            {text(l, "Créer un administrateur", "Create an administrator")}
          </h2>
          <p>
            {text(
              l,
              "Une invitation sera envoyée par e-mail pour définir son mot de passe.",
              "An email invitation will let them set their password.",
            )}
          </p>
          {!showAdminForm ? (
            <button
              type="button"
              className="button"
              onClick={() => setShowAdminForm(true)}
            >
              {text(l, "Créer un administrateur", "Create an administrator")}
            </button>
          ) : (
            <>
              <OperationForm
                op="create_admin"
                act={act}
                l={l}
                submit={text(l, "Envoyer l’invitation", "Send invitation")}
                done={() => setShowAdminForm(false)}
              >
                <div className="form-grid">
                  <label>
                    {text(l, "Nom complet", "Full name")}
                    <input
                      name="full_name"
                      required
                      minLength={2}
                      maxLength={200}
                      autoComplete="name"
                    />
                  </label>
                  <label>
                    {text(l, "Adresse e-mail", "Email address")}
                    <input
                      name="email"
                      type="email"
                      required
                      maxLength={254}
                      autoComplete="email"
                    />
                  </label>
                  <label>
                    {text(l, "Téléphone", "Phone")}
                    <input
                      name="phone"
                      type="tel"
                      required
                      minLength={6}
                      maxLength={30}
                      autoComplete="tel"
                    />
                  </label>
                  <label>
                    {text(l, "Ville", "City")}
                    <input
                      name="city"
                      required
                      minLength={2}
                      maxLength={200}
                      autoComplete="address-level2"
                    />
                  </label>
                  <label>
                    {text(l, "Région", "Region")}
                    <select name="region" required defaultValue="">
                      <option value="" disabled>
                        {text(l, "Choisir une région", "Choose a region")}
                      </option>
                      {REGIONS.map((region) => (
                        <option key={region} value={region}>
                          {region}
                        </option>
                      ))}
                    </select>
                  </label>
                  <input type="hidden" name="locale" value={l} />
                </div>
              </OperationForm>
              <button
                type="button"
                className="button outline"
                onClick={() => setShowAdminForm(false)}
              >
                {text(l, "Annuler", "Cancel")}
              </button>
            </>
          )}
        </section>
      )}
      <div className="filters">
        <input
          placeholder={text(
            l,
            "Nom, email, ville ou région",
            "Name, email, city or region",
          )}
          aria-label={text(l, "Rechercher un compte", "Search accounts")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          aria-label={text(l, "Filtrer par rôle", "Filter by role")}
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          <option value="">{text(l, "Tous les rôles", "All roles")}</option>
          {Object.entries(roleLabels[l]).map(([r, label]) => (
            <option key={r} value={r}>
              {label}
            </option>
          ))}
        </select>
        <select
          aria-label={text(l, "Filtrer par statut", "Filter by status")}
          value={state}
          onChange={(e) => setState(e.target.value)}
        >
          <option value="">
            {text(l, "Tous les statuts", "All statuses")}
          </option>
          {["pending", "approved", "rejected", "suspended"].map((s) => (
            <option key={s} value={s}>
              {statusLabels[l][s as "pending"]}
            </option>
          ))}
        </select>
      </div>
      {selected.map((r) => (
        <article className="card" key={r.id}>
          <h3>{r.full_name}</h3>
          <div className="meta">
            <span>{r.email}</span>
            <span>{r.phone}</span>
            <span>
              {r.city} · {r.region}
            </span>
            <span>{r.matricule}</span>
            <span>{r.points} pts</span>
          </div>
          {status(r.status)}
          {r.id !== profile.id &&
            (profile.role === "super_admin" ||
              !["admin", "super_admin"].includes(r.role)) && (
              <>
                {r.status === "pending" && memberRoles.includes(r.role) && (
                  <button
                    onClick={() =>
                      void act({
                        op: "approve_existing_member",
                        id: r.id,
                      }).catch(() => {})
                    }
                  >
                    {text(l, "Approuver l’adhésion", "Approve membership")}
                  </button>
                )}
                <OperationForm op="manage_member" act={act} l={l}>
                  <input type="hidden" name="id" value={r.id} />
                  <div className="form-grid">
                    <label>
                      {text(l, "Rôle", "Role")}
                      <select name="role" defaultValue={r.role}>
                        {(profile.role === "super_admin"
                          ? [...memberRoles, "admin" as const]
                          : [...memberRoles]
                        ).map((key) => (
                          <option key={key} value={key}>
                            {roleLabels[l][key]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      {text(l, "Statut", "Status")}
                      <select name="status" defaultValue={r.status}>
                        {["pending", "approved", "rejected", "suspended"]
                          .filter(
                            (s) => r.status !== "pending" || s !== "approved",
                          )
                          .map((s) => (
                            <option key={s} value={s}>
                              {statusLabels[l][s as "pending"]}
                            </option>
                          ))}
                      </select>
                    </label>
                  </div>
                </OperationForm>
                {profile.role === "super_admin" && (
                  <button
                    className="danger"
                    style={{ marginTop: 18 }}
                    onClick={() => {
                      if (
                        confirm(
                          text(
                            l,
                            "Supprimer définitivement ce compte et ses rapports ?",
                            "Permanently delete this account and its reports?",
                          ),
                        )
                      )
                        void act({ op: "delete_account", id: r.id }).catch(
                          () => {},
                        );
                    }}
                  >
                    {text(l, "Supprimer le compte", "Delete account")}
                  </button>
                )}
              </>
            )}
        </article>
      ))}
    </>
  );
}
function GroupsAdmin({
  data,
  act,
  l,
}: {
  data: { groups: Row[]; members: Row[] };
  act: (b: Record<string, unknown>) => Promise<any>;
  l: Locale;
}) {
  const [role, setRole] = useState("all");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const list = (data?.members || []).filter(
    (p) =>
      ["membre", "benevole", "volontaire"].includes(p.role) &&
      (role === "all" || p.role === role) &&
      (!city || p.city?.trim().toLowerCase() === city.trim().toLowerCase()) &&
      (!region || p.region === region),
  );
  return (
    <>
      <div className="card">
        <h2 style={{ fontSize: "1.6rem", marginBottom: 25 }}>
          {text(
            l,
            "Créer un groupe par catégorie",
            "Create a group by category",
          )}
        </h2>
        <OperationForm
          op="create_group"
          act={act}
          l={l}
          transform={(b) => ({ ...b, invite: b.invite === "on" })}
        >
          <label>
            {text(l, "Nom du groupe", "Group name")}
            <input name="name" required minLength={3} />
          </label>
          <label>
            Description
            <textarea name="description" maxLength={2000} />
          </label>
          <label>
            {text(l, "Rôle", "Role")}
            <select
              name="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="all">
                {text(l, "Tous les participants", "All participants")}
              </option>
              {(["membre", "benevole", "volontaire"] as const).map((r) => (
                <option key={r} value={r}>
                  {roleLabels[l][r]}
                </option>
              ))}
            </select>
          </label>
          <div className="form-grid">
            <label>
              {text(l, "Ville (facultatif)", "City (optional)")}
              <input
                name="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </label>
            <label>
              {text(l, "Région (facultatif)", "Region (optional)")}
              <select
                name="region"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
              >
                <option value="">{text(l, "Toutes", "All")}</option>
                {REGIONS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
          </div>
          <div>
            <strong>
              {list.length}{" "}
              {text(l, "personnes sélectionnées", "people selected")}
            </strong>
            <div className="preview-list">
              {list.map((p) => (
                <p key={p.id}>
                  {p.full_name} · {p.city} ·{" "}
                  {roleLabels[l][p.role as Profile["role"]]}
                </p>
              ))}
            </div>
          </div>
          <label className="check">
            <input name="invite" type="checkbox" />
            <span>
              {text(
                l,
                "Envoyer une invitation par email aux personnes sélectionnées",
                "Email an invitation to selected people",
              )}
            </span>
          </label>
        </OperationForm>
      </div>
      {data?.groups?.map((g) => (
        <article className="card" key={g.id}>
          <h3>{g.name}</h3>
          <p>{g.category}</p>
          <p style={{ overflowWrap: "anywhere" }}>
            <Link className="link" href={"/g/" + g.invite_token}>
              {"https://www.ardttemp.org/g/" + g.invite_token}
            </Link>
          </p>
          <div className="actions">
            <Link className="button outline" href={"/dashboard/groups/" + g.id}>
              {text(l, "Discussion", "Discussion")}
            </Link>
            <button
              className="button outline"
              onClick={() =>
                navigator.clipboard.writeText(
                  "https://www.ardttemp.org/g/" + g.invite_token,
                )
              }
            >
              {text(l, "Copier le lien", "Copy link")}
            </button>
          </div>
          <details>
            <summary>
              {text(
                l,
                "Ajouter une personne manuellement",
                "Add a person manually",
              )}
            </summary>
            <OperationForm op="add_member" act={act} l={l}>
              <input type="hidden" name="group_id" value={g.id} />
              <label>
                {text(l, "Compte approuvé", "Approved account")}
                <select name="user_id">
                  {data.members.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name} · {p.email}
                    </option>
                  ))}
                </select>
              </label>
            </OperationForm>
          </details>
        </article>
      ))}
    </>
  );
}
