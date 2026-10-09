import "server-only";
import { Resend } from "resend";
import { workerClient } from "./supabase";
import { text, type Locale } from "./domain";
const escape = (v: unknown) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function emailTemplate(
  event: string,
  p: Record<string, unknown>,
  l: Locale,
) {
  const t = (fr: string, en: string) => text(l, fr, en);
  const url = process.env.NEXT_PUBLIC_APP_URL || "https://www.ardttemp.org";
  let subject = "",
    message = "",
    link = "/dashboard";
  switch (event) {
    case "admin_invitation":
      subject = t(
        "Votre invitation administrateur ARDTTEMP",
        "Your ARDTTEMP administrator invitation",
      );
      message = t(
        `Bonjour ${p.admin_name}. Votre compte administrateur est prêt. Matricule : ${p.matricule}. Définissez votre mot de passe avec le lien ci-dessous.`,
        `Hello ${p.admin_name}. Your administrator account is ready. Membership ID: ${p.matricule}. Set your password using the link below.`,
      );
      link = String(p.invitation_url || "/login");
      break;
    case "newsletter_received":
      subject = t(
        "Votre inscription à la newsletter",
        "Your newsletter subscription",
      );
      message = t(
        "Merci. Vous recevrez les actualités d’ARDTTEMP. Pour vous désinscrire, contactez partnership@ardttemp.org.",
        "Thank you. You will receive ARDTTEMP news. To unsubscribe, contact partnership@ardttemp.org.",
      );
      link = "/news";
      break;
    case "registration_received":
      subject = t(
        "Votre demande d’adhésion est reçue",
        "Your membership application has been received",
      );
      message = t(
        "Merci de rejoindre ARDTTEMP. Votre compte est en attente de validation. Vous pouvez vous connecter pour suivre votre demande.",
        "Thank you for joining ARDTTEMP. Your account is pending review. Sign in to follow your application.",
      );
      break;
    case "membership_approved":
      subject = t("Bienvenue chez ARDTTEMP", "Welcome to ARDTTEMP");
      message = t(
        `Votre adhésion est approuvée. Matricule : ${p.matricule}. Vous recevez 50 points d’engagement.`,
        `Your membership is approved. Membership ID: ${p.matricule}. You receive 50 engagement points.`,
      );
      break;
    case "membership_rejected":
      subject = t(
        "Décision sur votre demande d’adhésion",
        "Membership application decision",
      );
      message = t(
        `Votre demande n’a pas été acceptée. Commentaire : ${p.comment}`,
        `Your application was not accepted. Feedback: ${p.comment}`,
      );
      break;
    case "report_approved":
      subject = t("Rapport validé", "Activity report approved");
      message = t(
        `Votre rapport « ${p.title} » est validé. Vous gagnez ${p.points} points.`,
        `Your report “${p.title}” is approved. You earned ${p.points} points.`,
      );
      link = "/dashboard/reports";
      break;
    case "report_rejected":
      subject = t("Rapport refusé", "Activity report declined");
      message = t(
        `Rapport « ${p.title} » : ${p.comment}`,
        `Report “${p.title}”: ${p.comment}`,
      );
      link = "/dashboard/reports";
      break;
    case "reward_available":
      subject = t(
        "Votre récompense est disponible",
        "Your reward is available",
      );
      message = t(
        `Vous avez atteint le seuil de ${p.threshold} points. Choisissez votre récompense dans votre espace membre.`,
        `You reached the ${p.threshold}-point threshold. Choose your reward in your dashboard.`,
      );
      link = "/dashboard/rewards";
      break;
    case "admin_reward_available":
      subject = t(
        "Un membre a atteint son palier",
        "A participant has reached a reward milestone",
      );
      message = t(
        `${p.name} a atteint le seuil de ${p.threshold} points.`,
        `${p.name} reached the ${p.threshold}-point threshold.`,
      );
      link = "/dashboard/admin/rewards";
      break;
    case "reward_approved":
      subject = t("Récompense approuvée", "Reward approved");
      message = t(
        `Votre récompense (${p.type}) est approuvée. ${p.notes ?? ""}`,
        `Your reward (${p.type}) is approved. ${p.notes ?? ""}`,
      );
      link = "/dashboard/rewards";
      break;
    case "dues_confirmed":
      subject = t(
        "Votre cotisation ARDTTEMP est confirmée",
        "Your ARDTTEMP membership payment is confirmed",
      );
      message = t(
        `Votre cotisation de ${p.amount} FCFA pour la période ${p.period} est confirmée. Référence : ${p.reference}.`,
        `Your membership payment of ${p.amount} XAF for ${p.period} is confirmed. Reference: ${p.reference}.`,
      );
      link = "/dashboard/dues";
      break;
    case "donation_received":
      subject = t(
        "Merci pour votre don — reçu ARDTTEMP",
        "Thank you for your donation — ARDTTEMP receipt",
      );
      message = t(
        `Votre don de ${p.amount} FCFA est confirmé. Référence : ${p.reference}. Votre soutien finance nos actions environnementales et sociales.`,
        `Your donation of ${p.amount} XAF is confirmed. Reference: ${p.reference}. Your support funds our environmental and social programmes.`,
      );
      link = "/activities";
      break;
    case "donation_pending":
      subject = t(
        "Votre intention de don est enregistrée",
        "Your donation pledge has been recorded",
      );
      message = t(
        `Montant : ${p.amount} FCFA. Référence : ${p.reference}. Aucun paiement n’est encore confirmé. Pour les instructions Mobile Money ou virement, contactez partnership@ardttemp.org ou +237 655 50 85 11. Les espèces sont acceptées au siège, Rue 7.949, Efoulan, Yaoundé. ${p.monthly === "true" ? "Notre équipe vous contactera pour organiser votre don mensuel ; aucun prélèvement automatique n’est activé." : ""}`,
        `Amount: ${p.amount} XAF. Reference: ${p.reference}. Payment is not yet confirmed. For Mobile Money or bank transfer instructions, contact partnership@ardttemp.org or +237 655 50 85 11. Cash donations are accepted at Rue 7.949, Efoulan, Yaoundé. ${p.monthly === "true" ? "Our team will contact you to arrange monthly donations; automatic debits are not enabled." : ""}`,
      );
      link = "/donate";
      break;
    case "group_invitation":
      subject = t(
        "Invitation à un groupe de travail",
        "Working group invitation",
      );
      message = t(
        `Vous êtes invité dans le groupe « ${p.name} ». Connectez-vous avec votre compte approuvé pour participer.`,
        `You are invited to join “${p.name}”. Sign in with your approved account to participate.`,
      );
      link = "/g/" + encodeURIComponent(String(p.token));
      break;
    case "contact_message":
      subject = `ARDTTEMP — ${p.subject}`;
      message = `${p.name} (${p.email})\n\n${p.message}`;
      link = "/contact";
      break;
    case "contact_received":
      subject = t(
        "Nous avons reçu votre message",
        "We have received your message",
      );
      message = t(
        `Merci ${p.name}. Votre message « ${p.subject} » a été transmis à notre équipe.`,
        `Thank you, ${p.name}. Your message “${p.subject}” has been sent to our team.`,
      );
      link = "/contact";
      break;
    default:
      throw new Error("Unknown email event");
  }
  return {
    subject,
    html: `<!doctype html><html lang="${l}"><body style="font-family:Arial,sans-serif;background:#f4f7f4;padding:24px;color:#17251c"><main style="max-width:560px;background:white;margin:auto;padding:32px;border-top:6px solid #166534"><h2 style="color:#166534">ARDTTEMP</h2><h1 style="font-size:23px">${escape(subject)}</h1><p style="line-height:1.7;white-space:pre-line">${escape(message)}</p><a href="${escape(link.startsWith("https://") ? link : url + link)}" style="display:inline-block;padding:14px 20px;background:#166534;color:white;text-decoration:none">${t("Ouvrir le site", "Open website")}</a><hr style="border:0;border-top:1px solid #eee;margin:28px 0"><p style="font-size:13px">Transformons notre Environnement Ensemble<br>Rue 7.949, Efoulan, Yaoundé, Cameroun<br>partnership@ardttemp.org · +237 655 50 85 11</p></main></body></html>`,
  };
}
export async function drainEmails() {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_WORKER_SECRET)
    return { sent: 0, pending: true };
  const db = workerClient();
  const { data, error } = await db.rpc("claim_emails", {
    p_secret: process.env.EMAIL_WORKER_SECRET,
  });
  if (error) throw error;
  const resend = new Resend(process.env.RESEND_API_KEY);
  let sent = 0;
  for (const job of data || []) {
    try {
      const template = emailTemplate(job.event, job.payload, job.locale);
      const { error } = await resend.emails.send(
        {
          from:
            process.env.RESEND_FROM_EMAIL || "ARDTTEMP <noreply@ardttemp.org>",
          to: job.recipient,
          ...template,
          ...(job.event === "contact_message"
            ? { replyTo: job.payload.email }
            : {}),
        },
        { idempotencyKey: job.id },
      );
      if (error) throw new Error(error.message);
      await db.rpc("finish_email", {
        p_secret: process.env.EMAIL_WORKER_SECRET,
        p_id: job.id,
        p_error: null,
      });
      sent++;
    } catch (e) {
      await db.rpc("finish_email", {
        p_secret: process.env.EMAIL_WORKER_SECRET,
        p_id: job.id,
        p_error: e instanceof Error ? e.message : "Delivery failed",
      });
    }
  }
  return { sent, pending: false };
}
