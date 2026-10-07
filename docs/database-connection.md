# Serveur des formulaires GitHub Pages

Le site statique utilise l’Edge Function `ardttemp-website-forms` du projet
Supabase `lhvlgbnowvjxuaudthrw`. La configuration publique se trouve dans
`js/platform-config.js`. La clé anon publique est envoyée dans apikey et
Authorization ; aucun secret serveur n’est inclus dans le site.

Les opérations contact, newsletter, membership et donation_interest sont
persistées dans `private.website_submissions`, avec un statut pending.
Les demandes sont consultables par le propriétaire dans le SQL Editor Supabase.
Cette connexion ne crée pas de compte Auth, ne prélève aucun paiement et
n’envoie pas encore de notification automatique. L’espace de traitement des
Admin et le parcours Auth appartiennent à l’application Next.js distincte.

## Déploiement

`server/website-forms.sql` a été exécuté dans une transaction depuis le SQL Editor.
`server/website-forms.ts` est le code déployé par l’éditeur Edge Functions.
La vérification JWT legacy reste activée. La clé service_role est lue
uniquement dans l’environnement serveur pour appeler la fonction SQL privée.

## Contrat et protections

POST JSON `{operation, submission_id, language, data}` : succès 201 avec
`{ok:true,id,status:"pending"}` après persistance. Le même UUID et les mêmes
données permettent une reprise sans doublon ; un UUID réutilisé avec des
données différentes est refusé. Les erreurs ne réinitialisent pas le formulaire.

Origines autorisées : https://www.ardttemp.org et https://ardttemp.org.
CORS, taille, formats, montant, consentement, rôle demandé et limitation
par adresse e-mail/source sont contrôlés côté serveur et SQL.
Une origine autorisée n’est pas une authentification d’utilisateur.

La fonction publique rejette les champs role, status, points, matricule,
user_id et actor_role. Membership autorise exactement membre, benevole,
volontaire. Les tables privées ne sont pas exposées à anon/authenticated ;
seul service_role peut exécuter la fonction SQL de réception.

## Vérification

`server/verify-website-forms.sql` vérifie directement en base le maintien
pending, l’absence de compte créé, l’idempotence, le refus des privilèges,
les droits de la fonction et l’absence de droits UPDATE sur profiles.role
et profiles.status pour authenticated. Les données SQL de test sont annulées.
Un test HTTP identifié TEST technique a confirmé une réponse 201 pending.

Les contrôles d’administration complets (Super Admin, dernier Super Admin,
matricules, approbation) restent dans l’application Next.js ; ne pas la
fusionner sur GitHub Pages sans hébergement serveur adapté.
