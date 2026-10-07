# ARDTTEMP — plateforme officielle

Next.js App Router, TypeScript, Tailwind, Supabase Auth/PostgreSQL/Storage et Resend. Les fichiers HTML et les images historiques restent dans le dépôt ; leurs textes FR/EN sont conservés dans `legacy/` et repris sur les pages modernisées. Les statistiques indicatives non vérifiées de l'ancien site ne sont pas présentées comme des résultats réels.

## Parcours disponibles

- Public : `/`, `/about`, `/activities`, `/news`, `/donate`, `/join`, `/contact`, `/login`, `/register`.
- Membre : `/dashboard`, `/dashboard/profile`, `/dashboard/reports`, `/dashboard/reports/new`, `/dashboard/groups`, `/dashboard/rewards`.
- Administration : `/dashboard/admin`, puis `/requests`, `/reports`, `/members`, `/news`, `/donations`, `/groups`, `/rewards` sous ce chemin. `/admin/*` redirige vers ces pages.
- Invitations : `/g/{invite_token}`. Compte approuvé et correspondant au filtre, ou ajouté manuellement.
- Français par défaut ; le sélecteur de langue conserve le choix dans un cookie. Le profil définit la langue des emails.

## Règles métier et sécurité

L'approbation attribue un matricule global unique et 50 points. Les validations de rapport ajoutent exactement 5/10/15/20 points. Verrouillage transactionnel et index uniques empêchent les doubles attributions. Seuils de récompense : membre 1200, bénévole/volontaire 2500, aucun pour les grades administratifs. Les points sont conservés ; chaque récompense consomme son palier, jamais les points. Palier N = seuil × N.

Les rôles et statuts sont lus en base, jamais depuis les métadonnées modifiables de l'utilisateur. Les champs sensibles du profil ne sont pas modifiables directement. Les fonctions privilégiées vérifient l'identité de l'appelant et ses droits, avec `search_path` explicite. Les rapports sont privés à leur auteur et aux admins. Les photos et fichiers sont dans des buckets privés avec URLs signées. MIME, signatures de fichiers et limites 5/10 Mo sont vérifiés. Sessions SSR en cookies httpOnly, contrôle d'origine des POST, rate limiting persistant, headers de sécurité.

Seul un Super Admin peut créer ou promouvoir un Admin. Un Admin examine les adhésions, les rapports et les contenus, sans modifier un compte administratif ni supprimer de compte. Les privilèges propres ne peuvent pas être modifiés ; le dernier Super Admin actif est protégé. La suppression retire aussi les sessions Auth. La modification de rôle ne change pas le matricule.

## Base de données

Le schéma a été appliqué au projet Supabase **ARDTTEMP Website**. `supabase/schema.sql` est une migration initiale pour la base historique identifiée, **à ne pas réexécuter telle quelle** sur la production déjà migrée. `supabase/seed.sql` initialise le premier Super Admin et deux articles bilingues de présentation fondés sur les faits fournis. `supabase/finalize.sql` préserve la newsletter et ferme les anciennes opérations privilégiées.

Les membres, dons, abonnés et messages historiques ne sont pas supprimés. La table des dons a été étendue et le statut historique `paid` converti en `completed`; les identifiants et autres données restent intacts. Les profils historiques sont créés en attente : aucune promotion automatique n'est déduite des anciens rôles.

Super Admin initial : **projets@ardttemp.org**, **ARDT-S-00001**, 0 point. Compte créé avec un mot de passe aléatoire non partagé. Utiliser `/forgot-password` pour définir son mot de passe ; vérifier les URL autorisées et la livraison des emails Auth dans Supabase. Ne pas publier de mot de passe dans GitHub.

## Variables et intégrations

Copier `.env.example` vers `.env.local` pour le développement. Aucune valeur secrète n'est versionnée.

Les fonctions métier sont exécutées avec la session de l'utilisateur. Le serveur utilise un jeton dédié `EMAIL_WORKER_SECRET` pour la file d'emails, le contact, les dons et le rate limiter. Son hash est dans `private.worker_config`. Il n'est jamais transmis au navigateur. Cela évite d'utiliser `service_role` pour ces opérations. Si nécessaire pour une extension utilisant l'API Auth Admin, renseigner `SUPABASE_SERVICE_ROLE_KEY` directement dans Vercel, uniquement côté serveur ; son transfert dans l'environnement de travail a été refusé par le contrôle automatique de sécurité.

Les emails sont mis en file dans `private.email_outbox` à l'intérieur des transactions SQL. Un worker Resend les traite après les opérations, avec clé d'idempotence et réessais. `/api/emails` nécessite `Authorization: Bearer {CRON_SECRET}`. Un cron quotidien compatible Vercel Hobby assure la reprise des emails non envoyés ; les opérations normales déclenchent aussi le worker immédiatement.

Templates FR/EN : demande reçue, adhésion approuvée/refusée, rapport approuvé/refusé, seuil atteint (utilisateur et admins), récompense approuvée, reçu de don, invitation groupe, contact équipe/accusé et newsletter.

### Resend — activation DNS restante

Le domaine `ardttemp.org` est encore **pending**. Ajouter ces enregistrements chez le gestionnaire DNS, puis lancer la vérification dans Resend :

| Type  | Nom                 | Valeur                                                                                                                                                                                                                       |
| ----- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TXT   | `resend._domainkey` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDC1e1dbgtrNwDLMj0TtjaoWLwBHhXvkTNqPhd+j/t3TGJE743QO/7Y1T9nkpyc865lfXvjhMVJ8dBjH1Q0S0cdeoYBhrVxFBTAk7p5gcK8YnoVDHV/6QXj+rAdsYhT62FznkSYd9Ita2Jj5ciI0dibM+m90hL/M1KYSD37qNiBzQIDAQAB` |
| CNAME | `rsend`             | `rsend-euw1.forge.rmta.net`                                                                                                                                                                                                  |
| CNAME | `send`              | `send.forge.rmta.net`                                                                                                                                                                                                        |

Ne pas remplacer les enregistrements MX existants de la messagerie de l'association. Les emails transactionnels ne peuvent être déclarés opérationnels tant que la vérification et un envoi réel n'ont pas réussi. Supabase Auth utilise son canal email configuré ; régler son Site URL sur `https://www.ardttemp.org` et autoriser `https://www.ardttemp.org/auth/callback` et `https://www.ardttemp.org/auth/callback?next=/reset-password`.

### Dons et Smobilpay

Le fallback fonctionne : intention de don en base `pending`, référence, demande d'instructions Mobile Money/virement ou espèces au siège. L'admin confirme **après réception effective** du paiement, ce qui déclenche le reçu. Un don mensuel est une demande d'organisation de versements, sans prélèvement automatique.

Aucune des variables Smobilpay n'était configurée dans le projet Vercel lors de l'audit. Le paiement en ligne est donc désactivé explicitement. L'API S3P officielle exige une signature et des identifiants de service/transaction propres au contrat marchand. Ne pas inventer d'endpoint ou accepter un callback non authentifié. Pour activer le paiement, fournir les variables prévues, les identifiants MTN/Orange autorisés et le contrat de webhook, puis implémenter/tester les appels selon https://apidocs.smobilpay.com/s3papi/. Aucun débit réel n'a été tenté.

### Statuts officiels

Les statuts et le règlement intérieur n'ont pas été fournis. `/terms` indique comment les obtenir auprès de l'association, sans inventer de document officiel. Ajouter les documents approuvés avant d'utiliser cette page comme source juridique complète.

## Développement et vérification

```sh
npm ci
npm run dev
npm run typecheck
npm run build
npm test
node scripts/run-browser-smoke.mjs
```

`tests/database.sql` couvre les règles métier et les autorisations en transaction annulée : adhésion, points, double validation, pending, groupes, récompenses, RLS et suppression réservée au Super Admin. Il crée seulement des fixtures temporaires ; les séquences PostgreSQL peuvent avancer même après rollback.

`tests/browser-smoke.mjs` vérifie les pages publiques FR/EN, le formulaire par étapes, le menu mobile, les redirections d'authentification et CSRF. Chromium est fourni par un package npm de test ; si la plateforme ne supporte pas l'extraction des archives, utiliser un navigateur Playwright déjà installé ou une installation Chromium officielle.

Les tests de livraison réelle Resend, de paiement Smobilpay et l'accès initial au compte administratif restent dépendants des configurations externes ci-dessus. Ne pas considérer ces tests comme réussis par la seule présence du code.

## Résultats de vérification de cette livraison

- Compilation Next.js de production et vérification TypeScript : réussies.
- Tests unitaires seuils et droits administratifs : réussis.
- Tests SQL transactionnels de règles métier et RLS : réussis.
- Navigateur : pages FR/EN, formulaire d’inscription par étapes, navigation mobile, absence de débordement horizontal, redirections Auth et contrôle CSRF : réussis.
- HTTP avec comptes synthétiques confirmés : connexion, pending bloqué, adhésion 50 points, photo privée, rapport +15 = 65, double validation et points invalides refusés, confidentialité des rapports, groupe filtré/lien/message/PDF, récompenses et suppression réservée au Super Admin : réussis. Comptes et fichiers de test nettoyés après exécution.

Le parcours HTTP utilise des comptes de test temporaires dans `.env.test.local`, non fourni. Il ne teste pas la délivrabilité des emails Auth/Resend. La migration additionnelle `supabase/group-files.sql` permet à l’auteur de supprimer ses pièces jointes.

Voir `DEPLOIEMENT.md` pour les blocages externes constatés et la publication minimale. La plateforme est préparée sur une branche GitHub dédiée. Vérifier le déploiement avant de changer le domaine du site historique.
