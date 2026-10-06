import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { Demande } from '../../demandes/data-access/demande.models';
import {
  CompteUtilisateur,
  DecisionLitige,
  ProfessionnelAdmin,
  StatutCompte,
  Statistiques,
  StatutVerification,
} from './admin.models';

// Backend : AdminController et AdminUtilisateurController.
// Toutes ces adresses commencent par /api/admin : seul l'administrateur y a accès.
@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/admin`;

  // ---------- Tableau de bord ----------

  statistiques() {
    return this.http.get<Statistiques>(`${this.baseUrl}/statistiques`);
  }

  // ---------- Vérification des professionnels ----------

  // Sans statut : tous les pros. Avec : /api/admin/professionnels?statut=EN_ATTENTE
  professionnels(statut: StatutVerification | null = null) {
    const params = statut ? new HttpParams().set('statut', statut) : undefined;
    return this.http.get<ProfessionnelAdmin[]>(`${this.baseUrl}/professionnels`, { params });
  }

  valider(proId: number) {
    return this.http.patch<ProfessionnelAdmin>(
      `${this.baseUrl}/professionnels/${proId}/valider`,
      {},
    );
  }

  // Le motif est obligatoire : le pro le lit dans « Mon profil »
  demanderCorrection(proId: number, motif: string) {
    return this.http.patch<ProfessionnelAdmin>(
      `${this.baseUrl}/professionnels/${proId}/correction`,
      { motif },
    );
  }

  refuser(proId: number, motif: string) {
    return this.http.patch<ProfessionnelAdmin>(`${this.baseUrl}/professionnels/${proId}/refuser`, {
      motif,
    });
  }

  // ---------- Litiges ----------

  // Les demandes EN_LITIGE, les plus anciennes d'abord
  litiges() {
    return this.http.get<Demande[]>(`${this.baseUrl}/litiges`);
  }

  // L'explication est obligatoire : le client et le pro la verront
  resoudreLitige(demandeId: number, decision: DecisionLitige, explication: string) {
    return this.http.patch<Demande>(`${this.baseUrl}/litiges/${demandeId}/resoudre`, {
      decision,
      explication,
    });
  }

  // ---------- Comptes ----------

  // /api/admin/utilisateurs?role=CLIENT (adresse ajoutée au backend en B2)
  comptes(role: 'CLIENT' | 'PROFESSIONNEL') {
    const params = new HttpParams().set('role', role);
    return this.http.get<CompteUtilisateur[]>(`${this.baseUrl}/utilisateurs`, { params });
  }

  // SUSPENDU : la personne est déconnectée et ne peut plus se connecter. ACTIF : elle peut revenir.
  changerStatutCompte(utilisateurId: number, statutCompte: StatutCompte) {
    return this.http.patch<CompteUtilisateur>(
      `${this.baseUrl}/utilisateurs/${utilisateurId}/statut-compte`,
      { statutCompte },
    );
  }
}
