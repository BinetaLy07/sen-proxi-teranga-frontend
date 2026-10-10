// Le style commun des tableaux de bord (client et professionnel) :
// les cartes de couleur, les blocs blancs, les petites étiquettes d'état.
export const STYLES_TABLEAU = `
    /* Une carte de couleur : se soulève un peu au survol */
    .carte {
      display: block;
      border-radius: 1.25rem;
      padding: 1.25rem;
      box-shadow: 0 1px 2px rgb(0 0 0 / 0.06);
      transition:
        transform 0.15s ease,
        box-shadow 0.15s ease;
    }
    .carte:hover {
      transform: translateY(-3px);
      box-shadow: 0 12px 24px -10px rgb(0 0 0 / 0.25);
    }
    .carte:hover .voir {
      text-decoration: underline;
    }
    .pastille-icone {
      display: flex;
      width: 2.25rem;
      height: 2.25rem;
      align-items: center;
      justify-content: center;
      border-radius: 9999px;
      background: rgb(255 255 255 / 0.75);
    }
    .voir {
      display: block;
      margin-top: 1rem;
      font-size: 0.875rem;
      font-weight: 600;
    }
    .bloc {
      border-radius: 1.25rem;
      border: 1px solid #e5e7eb;
      background: white;
      padding: 1.25rem 1.5rem;
      box-shadow: 0 1px 2px rgb(0 0 0 / 0.04);
    }
    .etat {
      border-radius: 9999px;
      padding: 0.125rem 0.5rem;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .vide {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 2rem 0 1rem;
      text-align: center;
    }
    @media (prefers-reduced-motion: reduce) {
      .carte,
      .carte:hover {
        transition: none;
        transform: none;
      }
    }
  `;
