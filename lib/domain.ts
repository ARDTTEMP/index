export type Locale = "fr" | "en";
export type Role =
  "super_admin" | "admin" | "membre" | "benevole" | "volontaire";
export type Profile = {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  city: string | null;
  region: string | null;
  role: Role;
  status: "pending" | "approved" | "rejected" | "suspended";
  matricule: string | null;
  points: number;
  bio: string | null;
  avatar_url: string | null;
  locale: Locale;
};
export const REGIONS = [
  "Adamaoua",
  "Centre",
  "Est",
  "Extrême-Nord",
  "Littoral",
  "Nord",
  "Nord-Ouest",
  "Ouest",
  "Sud",
  "Sud-Ouest",
] as const;
export const memberRoles = ["membre", "benevole", "volontaire"] as const;
export function threshold(role: Role) {
  return role === "membre"
    ? 1200
    : ["benevole", "volontaire"].includes(role)
      ? 2500
      : null;
}
export function isAdmin(role: Role) {
  return role === "admin" || role === "super_admin";
}
export function rewardProgress(points: number, role: Role) {
  const t = threshold(role);
  return t === null ? null : Math.min(100, (points / t) * 100);
}
export const roleLabels = {
  fr: {
    super_admin: "Super Admin",
    admin: "Administrateur",
    membre: "Membre",
    benevole: "Bénévole",
    volontaire: "Volontaire",
  },
  en: {
    super_admin: "Super Admin",
    admin: "Administrator",
    membre: "Member",
    benevole: "Volunteer",
    volontaire: "Field volunteer",
  },
};
export const statusLabels = {
  fr: {
    pending: "En attente",
    approved: "Approuvé",
    rejected: "Refusé",
    suspended: "Suspendu",
    completed: "Confirmé",
    failed: "Échoué",
    requested: "Demandée",
    fulfilled: "Réalisée",
  },
  en: {
    pending: "Pending",
    approved: "Approved",
    rejected: "Rejected",
    suspended: "Suspended",
    completed: "Confirmed",
    failed: "Failed",
    requested: "Requested",
    fulfilled: "Fulfilled",
  },
};
export function text(l: Locale, fr: string, en: string) {
  return l === "en" ? en : fr;
}
