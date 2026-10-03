# Sen Proxi Teranga — Frontend

Angular 22, composants standalone, Signals, formulaires réactifs, Tailwind CSS 4 et PWA Angular. Layout et palette adaptés de [TailAdmin Angular](https://github.com/TailAdmin/free-angular-tailwind-dashboard), sous licence MIT (LICENSE-TailAdmin.md). Les pages de démonstration et leurs dépendances graphiques ne sont pas importées.

## Démarrage du projet

Exécuter `npm ci`, puis `npm start` et ouvrir http://localhost:4200. Le proxy `/api` transmet les requêtes à Spring Boot sur http://localhost:8080. Démarrer le backend séparément avec MySQL et ADMIN_PASSWORD si le compte initial est absent.

## Architecture

- `core/auth` : modèles, session, interceptor Bearer, refresh partagé entre requêtes concurrentes et garde de route.
- `core/http` : messages d’erreur API.
- `core/pwa` : installation, mises à jour, état hors ligne.
- `shared/layouts` : layout d’authentification responsive adapté de TailAdmin.
- `features/auth` : connexion et inscription client/professionnel.
- `features/account` : espace connecté et gestion des sessions.
- `features/legal` : conditions provisoires à compléter avant ouverture publique.
- `src/environments/environment.ts` : URL de l’API. En production, exposer `/api` sur le même domaine avec un reverse proxy vers Spring Boot.

Routes chargées à la demande : `/connexion`, `/inscription`, `/espace`, `/conditions`. Les pages s’exécutent côté navigateur pour isoler les sessions personnelles du rendu serveur. Les autorisations réelles restent contrôlées par Spring Security.

## Connexion et inscription

POST /api/auth/register et POST /api/auth/connexion. L’inscription ne propose pas le rôle administrateur. Le métier est obligatoire pour les professionnels. Validation de l’email, du téléphone sénégalais, du mot de passe, de sa confirmation et des CGU. Après création, retour à la connexion avec confirmation.

Les tokens sont mémorisés dans `sessionStorage` pour l’onglet courant, sans mot de passe. Ils restent accessibles au JavaScript : prévenir les injections XSS et utiliser HTTPS en production. Le Bearer est envoyé uniquement à l’API. Après un 401, une seule tentative de renouvellement puis de répétition de la requête. Un refresh refusé efface la session et ramène à la connexion. Une déconnexion en panne réseau efface la session locale mais ne garantit pas la révocation serveur.

## PWA

Exécuter `npm run start:pwa` pour servir la version de production localement. Le service worker s’active en production, sous HTTPS ou localhost. Installation proposée sur les navigateurs compatibles ; sur iOS, Partager → Sur l’écran d’accueil. Icônes 192/512 et maskable incluses.

Le cache conserve uniquement le shell et les assets, jamais les réponses API ou données personnelles. Les opérations d’authentification exigent une connexion internet. Voir les [instructions PWA Angular](https://angular.dev/ecosystem/service-workers/getting-started).

## Intégrer les autres fonctionnalités

Consulter le [guide d’intégration du backend](docs/INTEGRATION-BACKEND.md) : organisation des dossiers, contrats DTO, service HTTP, routes, formulaires, rôles, déploiement et vérifications avec l’API réelle.

## Commandes de vérification

`npm run build` et `npm test -- --watch=false`. Les tests HTTP utilisent une API simulée et ne créent pas de comptes en base. Les [interceptors Angular](https://angular.dev/guide/http/interceptors) sont fonctionnels.


## Hôtes locaux

Les hôtes localhost et 127.0.0.1 sont autorisés explicitement dans angular.json et dans le serveur Angular. Redémarrer npm start après une modification de cette configuration. En production, configurer APP_ALLOWED_HOSTS avec les domaines autorisés, séparés par des virgules. Ne pas utiliser une autorisation globale.
