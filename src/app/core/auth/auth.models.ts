export type Role = 'CLIENT' | 'PROFESSIONNEL' | 'ADMINISTRATEUR';
export interface Tokens {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  accessExpiresAt: string;
  refreshExpiresAt: string;
  utilisateurId: number;
  role: Role;
  prenom?: string;
  nom?: string;
  // true : 1re connexion juste après l'inscription (fenêtre de bienvenue avec confettis)
  premiereConnexion?: boolean;
}
export interface RegisterRequest {
  prenom: string;
  nom: string;
  email: string;
  telephone: string;
  motDePasse: string;
  cguAcceptees: boolean;
  role: 'CLIENT' | 'PROFESSIONNEL';
  metier?: string;
}
export interface UserResponse {
  id: number;
  prenom: string;
  nom: string;
  email: string;
  role: Role;
  statutCompte: 'ACTIF' | 'SUSPENDU';
}
export interface SessionInfo {
  id: number;
  expiresAt: string;
  current: boolean;
}
