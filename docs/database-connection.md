# Connexion serveur — site GitHub Pages

Le site publié est statique. Il ne peut pas exécuter `app/api/platform/route.ts`.
La branche `feat/ardttemp-platform` contient l’application Next.js distincte :
ne pas la fusionner sur la branche Pages sans changer son hébergement.

## Configuration publique

`js/platform-config.js` prépare un endpoint HTTPS unique, par exemple une
Supabase Edge Function. Laisser `formsEndpoint` vide jusqu’à son déploiement.
Les formulaires contact, newsletter et adhésion utilisent alors leurs adresses
Formspree existantes. Leur disponibilité doit être vérifiée avec un envoi réel
par le propriétaire. Le don sans endpoint affiche une erreur et conserve les
saisies : aucun paiement ni envoi n’est simulé.

Seule une clé publique peut être renseignée dans `publishableKey`.
Les secrets Supabase et d’envoi d’e-mails restent côté serveur.

## Contrat POST JSON

`{ operation, language, data }` ; réponse après persistance effective :
`{ "ok": true }`, statut 200/201. Échec : statut 400/403/429/500.
Opérations : contact, newsletter, membership, donation_interest.
Le serveur doit ignorer/rejeter les champs inattendus, limiter les tailles,
valider e-mail, consentement, montants et catégories, appliquer une protection
anti-abus et gérer OPTIONS/CORS pour https://www.ardttemp.org.

Une demande `membership` fournit `requested_role` parmi exactement
`membre`, `benevole`, `volontaire`. Ce formulaire constitue une demande,
pas un compte Auth : ne pas insérer un profil avec un identifiant fictif.
Pour créer un compte, ajouter un parcours Supabase Auth vérifié. Le serveur et
le déclencheur SQL imposent alors un profil pending et le rôle effectif public.
L’approbation attribue le rôle demandé. Les métadonnées client ne définissent
jamais les privilèges.

## Administration (hors endpoint public)

Vérifier l’utilisateur avec Supabase Auth, puis relire profiles.role et
profiles.status. Exiger approved + super_admin pour créer/promouvoir un Admin.
Retourner 403 sinon. Les Admins peuvent examiner/approuver les demandes,
mais ne peuvent créer des Admins, modifier leurs propres privilèges ou
supprimer des comptes. Préserver le matricule et protéger le dernier Super Admin.
Ces règles nécessitent contrôles SQL/RLS et tests directs en base avant activation.
Aucune migration en base n’est exécutée par ce changement statique.

## Vérification avant activation

Tester succès, refus, indisponibilité, double clic et absence de duplication.
Vérifier directement en base le maintien pending, les trois catégories,
le refus des modifications directes de rôle/statut et l’autorisation Admin.
Aucune écriture de données personnelles de test n’est faite par les tests locaux.

Documentation CORS : https://supabase.com/docs/guides/functions/cors
