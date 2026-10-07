import "server-only";
// Smobilpay S3P integrations vary by merchant contract. Do not send funds or trust
// callbacks until the merchant-specific endpoint and signing contract are verified.
export function paymentAvailability() {
  return {
    configured: !!(
      process.env.SMOBILPAY_MERCHANT_ID &&
      process.env.SMOBILPAY_API_KEY &&
      process.env.SMOBILPAY_API_SECRET &&
      process.env.SMOBILPAY_BASE_URL
    ),
    online: false,
  };
}
export const fallbackInstructions = {
  fr: "Votre intention de don est enregistrée, en attente de paiement. Contactez partnership@ardttemp.org ou +237 655 50 85 11 pour obtenir les coordonnées Mobile Money ou de virement. Vous pouvez aussi donner en espèces au siège à Efoulan. Aucun prélèvement automatique n’est effectué.",
  en: "Your donation pledge is recorded, awaiting payment. Contact partnership@ardttemp.org or +237 655 50 85 11 for Mobile Money or bank transfer instructions. Cash is also accepted at the Efoulan office. No automatic debit is made.",
};
