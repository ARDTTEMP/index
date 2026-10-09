# Publication de la plateforme dynamique

La branche feat/modern-member-platform contient l’application Next.js et les cinq catégories de comptes. Les fichiers statiques historiques sont préservés.

Le déploiement automatique du dépôt doit construire Next.js avec les variables serveur existantes : consulter .env.example sans publier leurs valeurs. Aucun secret ne doit être saisi dans le code ou GitHub. Les invitations Admin passent par la fonction Edge ardttemp-admin-invite : la clé service_role reste dans Supabase et ne doit pas être copiée dans Vercel. Les fonctions métier utilisent la session vérifiée.

Les bases et migrations existantes ne doivent pas être rejouées sur la production. Vérifier les fonctions et RLS en SQL, puis la connexion et l’inscription sur la prévisualisation. Les URL Auth doivent autoriser /auth/callback et le parcours de récupération. Le site historique reste utilisable sur GitHub Pages tant que le domaine n’a pas été orienté vers le serveur dynamique.

Points : Membre 1200, Bénévole/Volontaire 2500, aucun seuil pour Admin/Super Admin. Approbation : matricule et 50 points. Rapport : exactement 5/10/15/20 points après validation. Les points et matricules sont conservés.

La livraison réelle des emails et les paiements en ligne doivent être vérifiés séparément. Les intentions de don restent pending jusqu’à réception effective du paiement.

## Vérification de prévisualisation du 8 octobre 2026

Le déploiement de la branche feat/modern-member-platform est READY. L’accueil, la galerie et le formulaire public ont été examinés dans le navigateur. La seconde étape de l’inscription offre exactement Membre, Bénévole et Volontaire. Les accès /dashboard et /dashboard/admin/members redirigent un visiteur non connecté vers /login. La bascule FR/EN fonctionne. Le contraste du bouton d’accès membre et la superposition du fond ont été corrigés puis redéployés.

Les variables publiques Supabase, EMAIL_WORKER_SECRET, CRON_SECRET et Resend sont présentes sur le serveur. La fonction Edge ardttemp-admin-invite est déployée avec vérification JWT et vérifie le rôle et le statut dans profiles. La migration create_admin_with_invitation enregistre le compte Admin et son invitation dans une transaction. Les appels sans session sont refusés avec 401 ; les tests SQL vérifient le refus des Admins et la création par un Super Admin. EMAIL_WORKER_SECRET et son empreinte Supabase ont été synchronisés ; le test de connexion des formulaires passe. Aucun secret n’est enregistré dans cette documentation.

Aucun compte réel ni e-mail réel n’a été créé lors de ces tests ; les données SQL de test ont été annulées. Cyrille est réservé comme second Super Admin, mais aucun compte confirmé ne correspond encore à cet e-mail. Les parcours après connexion, la livraison réelle des invitations et la bascule du domaine de production restent à valider. La PR 4 n’est pas fusionnée.

## Espaces membres — 9 octobre 2026

Trois migrations contrôlées réparent l’approbation des comptes historiques, synchronisent `profiles` et `members`, sécurisent les validations simultanées et ajoutent les cotisations et photos privées. L’approbation conserve le matricule et attribue les 50 points une seule fois. La liste des demandes et la gestion des membres permettent de traiter les comptes historiques sans demande dans la nouvelle table. Le tableau de bord actualise les droits au retour dans la fenêtre et toutes les 15 secondes ; les discussions toutes les 5 secondes. L’éditeur d’actualités conserve sa pagination.

`/dashboard/profile` permet de prévisualiser une photo puis de la convertir en WebP de 512 pixels avant envoi dans `profile-photos` (privé, 1 Mo). Son chemin est vérifié en base et les discussions reçoivent une URL signée. Les justificatifs de cotisation restent privés au titulaire et aux administrateurs.

`/dashboard/dues` présente le barème, les instructions, les références et l’historique. Le Super Admin doit configurer le montant, la période et les instructions FR/EN dans `/dashboard/admin/dues`. Les bénévoles sont exonérés. Aucun montant n’est inventé. Une déclaration de versement reste `submitted` jusqu’à vérification par un Admin/Super Admin ; le membre ne peut jamais confirmer lui-même son paiement ni modifier le montant. Un lien HTTPS de paiement externe est facultatif. Il ne constitue pas une intégration automatique : Smobilpay et ses callbacks restent à raccorder et à tester avec le contrat marchand.

Vérification : compilation Next.js/TypeScript et tests existants réussis ; suite SQL métier/autorisations exécutée en transaction annulée et réussie ; approbation historique et nouvelle demande testées deux fois sans double attribution. Les permissions et politiques RLS des nouveaux buckets/tables ont été inspectées directement en base. Les tentatives de test transactionnel des nouvelles cotisations ont rencontré une expiration de requête du connecteur et ne constituent pas un résultat réussi. La session Super Admin a permis de vérifier le tableau de bord, la demande historique et le formulaire de profil avec prévisualisation de photo. Le test SQL d’avatar accepte un objet privé appartenant au titulaire et refuse un chemin externe. Une ambiguïté entre les deux références de profil des cotisations a été corrigée dans l’API. Le téléversement réel et le parcours complet de cotisation restent à terminer : la connexion au dernier aperçu stable a été refusée avec « Email ou mot de passe incorrect ». Aucun débit réel n’a été tenté. La branche d’aperçu reste distincte de la production.


## Points et publication — 9 octobre 2026

Migration `20261009063610_award_confirmed_dues_points.sql` appliquée dans Supabase. Une cotisation confirmée attribue 200 points aux catégories publiques, une seule fois par paiement et période. Les déclarations non confirmées ne donnent rien. Le Super Admin reste à zéro point et ne reçoit pas de récompense personnelle ; son interface masque ces éléments et redirige la route des récompenses.

Les photos des actualités et de la galerie passent désormais par un envoi multipart avec session vérifiée côté serveur, réservé aux administrateurs approuvés, WebP contrôlé et limite 4 Mo. Les vidéos conservent leur envoi signé direct. Les erreurs multipart sont attendues dans le bloc de gestion des erreurs API.

Vérifications réussies : TypeScript, tests existants, build Next.js ; transaction SQL annulée prouvant 0 avant confirmation, 200 après confirmation, absence de doublon, zéro pour Super Admin ; insertion autorisée en Storage et publication SQL d’un article avec couverture, toutes deux annulées. Le téléversement HTTP et le parcours complet connecté restent non validés, le navigateur étant bloqué par son état de protection des identifiants. La création d’arbre par l’intégration GitHub a été refusée HTTP 403 « Resource not accessible by integration ». La session navigateur GitHub a ensuite été rétablie et les modifications ont été enregistrées directement dans la branche `feat/modern-member-platform`. Les six fichiers API/interface ont été comparés par empreinte Git et correspondent au code local testé. Aucun changement de production.
