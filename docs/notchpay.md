# Paiements ARDTTEMP — Notch Pay

Les dons et les cotisations utilisent la page hébergée Notch Pay Collect. Les boutons apparaissent uniquement lorsque la configuration serveur est complète. Les virements, espèces et déclarations Mobile Money restent disponibles. Les adhésions gardent leur validation administrative : payer ne promeut ni n’approuve un compte.

## Configuration à terminer

Dans le projet Vercel **ardttemp**, configurer :

- `NOTCHPAY_PUBLIC_KEY` : clé publique Notch Pay de l’environnement, conservée côté serveur.
- `NOTCHPAY_WEBHOOK_HASH` : Hash Key de signature du webhook, de type Secret.
- `NOTCHPAY_MODE` : `test` pour tester ; `live` uniquement après vérification du compte marchand et des paiements de test.

Ne pas utiliser de clés live dans Preview ou Development. Le code de collecte n’a pas besoin de la clé privée de transfert `X-Grant`.

Configurer dans Notch Pay le webhook `https://www.ardttemp.org/api/webhooks/notchpay`, avec les événements de paiement. Le retour utilisateur est généré automatiquement vers `https://www.ardttemp.org/payment/return?payment=…`. Redéployer après configuration des variables.

## Contrôles

La signature `x-notch-signature` est vérifiée en HMAC SHA-256 sur le corps brut. La notification et les paramètres du retour ne constituent jamais une preuve de paiement : le serveur relit la transaction auprès de Notch Pay. Référence, montant XAF et environnement doivent correspondre au registre privé. Seul `complete` confirme un versement réel. La confirmation d’une cotisation déclenche le mécanisme existant de 200 points, une seule fois par période. Un test sandbox ne confirme aucune cotisation/don réel et n’attribue aucun point.

Le registre privé est inaccessible aux navigateurs. Les opérations SQL vérifient le jeton serveur existant ; aucune clé service_role n’est nécessaire. Un checkout en cours est réutilisé. Si l’initialisation échoue après un appel ambigu, le serveur ne crée pas un second checkout : contrôler la référence marchand `ARDTTEMP-{id}` dans Notch Pay avant de relancer. Une confirmation après une validation manuelle n’attribue pas de points supplémentaires.

Les remboursements ne retirent pas automatiquement les points : les traiter et les rapprocher administrativement. Un don mensuel demeure un arrangement avec le donateur, sans prélèvement récurrent automatique.

## Validation réalisée

- Tests Node : signatures falsifiées, corps altéré, montant/devise/référence/environnement incompatibles, redirection externe refusée.
- Transaction SQL annulée : autorisation worker, propriétaire, sandbox sans points, checkout sans doublon, statut processing sans points, confirmation et notification répétées = exactement 200 points et un reçu, don confirmé.
- Les tests SQL ont aussi révélé le doublon entre `submit_donation` et le trigger d’e-mail. La migration de correction rend l’insertion idempotente.

## Validation nécessitant les identifiants

Avec les clés de test, réaliser les parcours complets Collect sur téléphone : don, cotisation, échec/annulation, retour avant le webhook, webhook avant le retour, répétition d’événement. Vérifier aussi la réception des reçus. Aucun paiement réel n’a été lancé pendant le développement.

## Retour arrière

Désactiver les trois variables Notch Pay et redéployer : les boutons disparaissent, les méthodes manuelles restent utilisables. Conserver le registre pour rapprochement et audit ; ne pas supprimer ses données. La correction du doublon d’e-mail doit être conservée.

Documentation : https://developer.notchpay.co/accept-payments/collect et https://developer.notchpay.co/get-started/webhooks/verify.
