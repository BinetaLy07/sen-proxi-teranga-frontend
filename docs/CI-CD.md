# CI/CD frontend sur main

Le workflow `.github/workflows/ci-cd.yml` exécute `npm ci`, les tests Angular, la compilation de production, puis construit une image Docker Nginx. Node 24 est utilisé. Déclenchements : push sur `main`, pull request vers `main` et lancement manuel depuis Actions.

Les pages étant configurées avec `RenderMode.Client`, Nginx sert le dossier `dist/sen-proxi-teranga-frontend/browser` et utilise `index.csr.html` pour les routes Angular. Le serveur Node SSR n'est pas lancé. Si de futures routes exigent du SSR, adapter ce déploiement. Le service worker et le manifeste générés sont inclus ; les fichiers de configuration PWA ne sont pas conservés durablement par le cache HTTP.

## Configuration GitHub

Dans Settings → Secrets and variables → Actions, ajouter les secrets suivants :

| Secret | Valeur |
| --- | --- |
| VPS_HOST | `82.29.172.15` |
| VPS_USER | Compte SSH pouvant exécuter Docker sans interaction |
| VPS_PORT | Port SSH, `22` par défaut |
| VPS_SSH_KEY | Clé privée dédiée ; sa clé publique est autorisée sur le VPS |
| VPS_KNOWN_HOSTS | Clé hôte SSH vérifiée du VPS, au format known_hosts |

Le mot de passe root n'est pas utilisé. Définir la variable Actions `DEPLOY_ENABLED=true` après préparation du serveur pour activer le déploiement automatique. Sans cette variable, tests et compilation fonctionnent mais le déploiement est ignoré. Les pull requests ne déploient jamais. Un lancement manuel déploie uniquement si la branche choisie est `main` et que la variable est activée.

## Serveur et réseau

Le VPS doit être Linux avec Docker, Bash, gzip et curl. Le workflow transmet l'image par SCP et utilise `deploy/release.sh`. Aucun registre Docker privé n'est nécessaire. Il crée le conteneur `senproxi-frontend`, sur le réseau `senproxi`, exposé seulement sur `127.0.0.1:8088` du VPS.

Déployer d'abord le backend, dont le conteneur doit fournir l'alias réseau `backend` et écouter sur `8080`. Son pipeline initialise également MySQL sur le VPS après préparation des fichiers de configuration avec `init-vps.sh` (voir le guide CI/CD du backend). Le Nginx du frontend transmet `/api/` vers ce backend, sans changement d'URL pour Angular. Le proxy de développement Angular n'est pas utilisé en production.

Installer/configurer un reverse proxy public avec HTTPS et un domaine, vers `http://127.0.0.1:8088`. Le port 8088 n'est volontairement pas exposé publiquement pour ne pas prendre la place d'un site existant sur 80/443. La configuration du domaine et du certificat reste à faire lorsque ces informations seront disponibles. La PWA sur une adresse IP distante en HTTP ne dispose pas du contexte sécurisé nécessaire au service worker.

Le script vérifie `/connexion` après démarrage et restaure le conteneur précédent si le test échoue. Il vérifie le frontend, pas l'ensemble des opérations métier du backend. Prévoir un test de connexion réel après la première installation. Les déploiements de ce dépôt sont sérialisés et entraînent une courte interruption. Prévoir un nettoyage régulier des anciennes images Docker.

## Vérifier localement

```powershell
npm ci
npm test -- --watch=false
npm run build
docker build -t senproxi-frontend:local .
```

Références : [setup-node](https://github.com/actions/setup-node), [checkout](https://github.com/actions/checkout).

## Traefik sur le VPS actuel

Le fichier serveur `/opt/sen-proxi-teranga/frontend.env` contient `PUBLIC_HOST=senproxi.duckdns.org` et `TRAEFIK_NETWORK=azure-devops-migration_gitlab-net`. Le script ajoute les labels et connecte le frontend au reseau de Traefik. Le resolver de certificats existant se nomme `letsencrypt`. Cette configuration remplace la necessite d’installer un autre reverse proxy. Le fichier `deploy/frontend.env.example` sert de modele pour changer le domaine.
