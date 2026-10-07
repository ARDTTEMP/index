import { ZodError } from "zod";
import { type Locale, text } from "./domain";
const french: Record<string, string> = {
  "Submission service unavailable": "Le service est momentanément indisponible. Vos informations sont conservées dans le formulaire ; réessayez plus tard.",
  "Super Admin required": "Cette action est réservée au Super Admin.",
  "At least one Super Admin must remain approved": "Le dernier Super Admin actif ne peut pas être rétrogradé ou suspendu.",
  "Authentication required": "Veuillez vous connecter.",
  "Profile unavailable": "Le profil est indisponible.",
  Forbidden: "Vous n’avez pas les droits nécessaires.",
  "Approved account required":
    "Votre adhésion doit être approuvée pour cette action.",
  "Invalid login credentials": "Email ou mot de passe incorrect.",
  "Email not confirmed":
    "Confirmez votre adresse email avant de vous connecter.",
  "User already registered": "Cette adresse email est déjà inscrite.",
  "Request already reviewed or missing":
    "Cette demande a déjà été traitée ou est introuvable.",
  "Report already reviewed or missing":
    "Ce rapport a déjà été traité ou est introuvable.",
  "Points must be 5, 10, 15 or 20":
    "Choisissez exactement 5, 10, 15 ou 20 points.",
  "Comment required": "Un commentaire est obligatoire.",
  "Cannot change own privileges":
    "Vous ne pouvez pas modifier vos propres droits.",
  "Super Admin protected": "Le compte Super Admin est protégé.",
  "Approve membership request first": "Validez d’abord la demande d’adhésion.",
  "Last Super Admin protected": "Le dernier Super Admin est protégé.",
  "Invalid invitation": "Ce lien d’invitation est invalide.",
  "This group is reserved for another category":
    "Ce groupe est réservé à une autre catégorie de participants.",
  "Reward threshold not reached":
    "Le seuil de récompense n’est pas encore atteint.",
  "Next reward threshold not reached":
    "Le prochain palier de récompense n’est pas encore atteint.",
  "Donation already processed": "Ce don a déjà été traité.",
  "Unsupported file or file too large":
    "Le type de fichier ou sa taille n’est pas autorisé.",
  "Invalid file contents": "Le contenu du fichier est invalide.",
  "File required": "Choisissez un fichier.",
};
export function errorMessage(error: unknown, locale: Locale) {
  if (error instanceof ZodError)
    return text(
      locale,
      "Vérifiez les champs du formulaire et les valeurs demandées.",
      "Check the form fields and required values.",
    );
  const message = error instanceof Error ? error.message : "";
  if (message.startsWith("Too many requests"))
    return text(
      locale,
      "Trop de tentatives. Réessayez dans dix minutes.",
      "Too many attempts. Try again in ten minutes.",
    );
  if (french[message]) return locale === "fr" ? french[message] : message;
  return text(
    locale,
    "L’action n’a pas abouti. Vérifiez vos informations et vos droits, puis réessayez.",
    "The action could not be completed. Check your details and permissions, then try again.",
  );
}
