# Publication de la plateforme dynamique

La branche feat/modern-member-platform contient l’application Next.js et les cinq catégories de comptes. Les fichiers statiques historiques sont préservés.

Le déploiement automatique du dépôt doit construire Next.js avec les variables serveur existantes : consulter .env.example sans publier leurs valeurs. Aucun secret ne doit être saisi dans le code ou GitHub. La clé service_role est nécessaire uniquement pour les invitations Admin côté serveur ; les fonctions métier utilisent la session vérifiée.

Les bases et migrations existantes ne doivent pas être rejouées sur la production. Vérifier les fonctions et RLS en SQL, puis la connexion et l’inscription sur la prévisualisation. Les URL Auth doivent autoriser /auth/callback et le parcours de récupération. Le site historique reste utilisable sur GitHub Pages tant que le domaine n’a pas été orienté vers le serveur dynamique.

Points : Membre 1200, Bénévole/Volontaire 2500, aucun seuil pour Admin/Super Admin. Approbation : matricule et 50 points. Rapport : exactement 5/10/15/20 points après validation. Les points et matricules sont conservés.

La livraison réelle des emails et les paiements en ligne doivent être vérifiés séparément. Les intentions de don restent pending jusqu’à réception effective du paiement.
