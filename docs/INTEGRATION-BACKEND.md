# Intégrer une fonctionnalité du backend dans Angular

## 1. Vérifier le contrat HTTP

Lire le controller Spring et ses DTO avant de créer le service Angular : méthode HTTP, chemin, paramètres, champs obligatoires, réponse et rôles autorisés. Les anciennes URL contenant `clients` ou `professionnels` restent valides : leurs identifiants désignent maintenant des utilisateurs ayant le rôle correspondant.

| Fonctionnalité | Controller backend | Dossier Angular conseillé |
| --- | --- | --- |
| Catégories | CategorieController | features/categories |
| Zones et quartiers | ZoneController | features/zones |
| Services professionnels | ServiceProfessionnelController | features/services |
| Demandes | DemandeController | features/demandes |
| Devis | DevisController | features/devis |
| Administration des comptes | AdminUtilisateurController | features/admin/utilisateurs |

Ne pas déduire une URL du nom d'un dossier : prendre celle de l'annotation du controller. Les exemples ci-dessous sont des fichiers à créer, pas une fonctionnalité déjà implémentée.

## 2. Organiser les fichiers

```text
src/app/features/demandes/
  data-access/
    demande.models.ts
    demande-api.service.ts
  pages/
    liste-demandes/
      liste-demandes.ts
      liste-demandes.html
      liste-demandes.css
```

`core` contient les services transversaux (authentification, HTTP, PWA). `shared` contient les éléments réellement réutilisables. Les modèles métier, services API et pages restent dans leur fonctionnalité. Utiliser des composants standalone et des fichiers lisibles, avec une instruction par ligne.

## 3. Définir les types et le service API

Dans `data-access/demande.models.ts`, reproduire les champs utiles de `DemandeResponse` et `DemandeRequest`. Les dates JSON sont des chaînes, pas des objets `Date`. Adapter la nullabilité au contrat réel du backend.

```typescript
export interface DemandeResume {
  id: number;
  description: string;
  adresse: string;
  dateSouhaitee: string;
  statut: string;
  clientId: number;
  professionnelId: number;
}

export interface CreerDemande {
  serviceId: number;
  description: string;
  adresse: string;
  dateSouhaitee: string; // YYYY-MM-DD
  urgente?: boolean;
  zoneId?: number;
}
```

Dans `data-access/demande-api.service.ts` :

```typescript
import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { CreerDemande, DemandeResume } from './demande.models';

@Injectable({ providedIn: 'root' })
export class DemandeApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  listerPourClient(clientId: number) {
    return this.http.get<DemandeResume[]>(
      `${this.baseUrl}/clients/${clientId}/demandes`,
    );
  }

  creer(clientId: number, demande: CreerDemande) {
    return this.http.post<DemandeResume>(
      `${this.baseUrl}/clients/${clientId}/demandes`,
      demande,
    );
  }
}
```

Le type générique de `HttpClient` ne valide pas le JSON à l'exécution. Vérifier le contrat avec une réponse réelle. Ne pas ajouter manuellement `Authorization` : `authInterceptor` ajoute le Bearer aux URL commençant par `environment.apiUrl + '/'`, renouvelle les tokens après un 401 et répète la requête une seule fois. Utiliser le `HttpClient` injecté, pas `fetch` ni `HttpBackend`, pour les appels métier.

## 4. Relier la page et la route

La page récupère `AuthService.session()?.utilisateurId` pour le client connecté, vérifie son rôle, puis appelle le service. Cet identifiant améliore le parcours utilisateur ; le backend doit toujours vérifier qu'il appartient au compte authentifié.

Gérer trois états : chargement, résultat et erreur. Pour les abonnements durables, utiliser `takeUntilDestroyed` ou `AsyncPipe`. Afficher un message adapté pour 403 (accès interdit), 404 (ressource absente), erreurs de validation et panne réseau. Réutiliser le helper de `core/http/api-error.ts` après vérification de sa signature. Ne pas afficher le détail technique d'une exception.

Ajouter dans `app.routes.ts`, avant la route de repli :

```typescript
{
  path: 'demandes',
  canActivate: [authGuard],
  loadComponent: () =>
    import('./features/demandes/pages/liste-demandes/liste-demandes')
      .then((module) => module.ListeDemandes),
},
```

Créer le composant exporté `ListeDemandes` avant d'ajouter cet import. `authGuard` vérifie uniquement la présence d'une session locale. Pour une page réservée à un rôle, ajouter une garde de rôle pour l'expérience utilisateur et masquer les actions incompatibles. Cela ne remplace jamais Spring Security : modifier `sessionStorage` ne doit pas donner accès aux données du serveur.

## 5. Formulaires et appels d'administration

Employer les formulaires réactifs, reprendre les contraintes des DTO Java, afficher les erreurs près des champs et empêcher les doubles soumissions. La confirmation de mot de passe est un champ de formulaire uniquement. Ne jamais envoyer un rôle administrateur depuis l'inscription publique.

Pour suspendre un compte, le contrat actuel est `PATCH /api/admin/utilisateurs/{id}/statut-compte` avec `{"statutCompte":"SUSPENDU"}` ; pour le réactiver, `ACTIF`. Cette action est réservée à `ADMINISTRATEUR`. La suspension révoque les sessions côté backend.

## 6. Réseau et PWA

En développement, `proxy.conf.json` transmet `/api` vers `http://localhost:8080`. Démarrer Spring Boot séparément. En production, configurer le serveur ou reverse proxy pour acheminer `/api` vers Spring avant le repli Angular. Le serveur Express fourni ne transmet pas automatiquement les requêtes API au backend.

Conserver les appels API hors du cache `ngsw-config.json`. Une page déjà visitée peut fonctionner hors ligne, mais les données métier et l'authentification exigent le réseau. Pour tester la PWA : `npm run start:pwa`. Dans Firefox Windows compatible, utiliser le bouton d'application web du navigateur ; le bouton de la page dépend de `beforeinstallprompt`, dont la disponibilité varie selon le navigateur.

## 7. Vérifier avant livraison

```powershell
npm run build
npm test -- --watch=false
```

Tester avec le backend réel : réponse attendue, validation invalide, absence de connexion, rôle interdit, accès à l'identifiant d'un autre utilisateur, refresh expiré, suspension de compte, écran mobile et panne réseau. Les tests HTTP simulés ne prouvent pas que le contrat et les données de la base réelle sont compatibles.
