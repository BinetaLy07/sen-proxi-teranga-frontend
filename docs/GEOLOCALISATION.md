# Carte et position GPS

Dans **Mon profil**, le professionnel utilise son GPS ou choisit un point sur
la carte, vérifie ce point et enregistre son lieu d’activité. Le bouton
« Retirer ma position publique » supprime les coordonnées en base.

Dans **Trouver un pro**, le client clique sur « Trouver près de moi » ou sur
la carte. Les professionnels vérifiés et actifs sont filtrés par métier,
catégorie, zone et rayon (5, 10, 20 ou 50 km). Les points verts ouvrent les
profils ; la liste présente les distances à vol d’oiseau.
La position du client reste en mémoire pendant l’affichage de cette page.

Le navigateur demande une autorisation uniquement après un clic sur le bouton
GPS. HTTPS ou localhost est nécessaire. En cas de refus ou de position
indisponible, la sélection sur la carte reste possible.

`shared/geolocalisation` contient l’accès GPS et la carte Leaflet, chargée
uniquement dans le navigateur. `PositionApiService` contient les appels API.
Les requêtes de proximité précédentes sont annulées quand les filtres changent.

Les tuiles sont chargées à la demande depuis OpenStreetMap, avec attribution
visible, sans préchargement ni stockage hors ligne par le service worker.
Une connexion Internet est nécessaire pour les cartes et la recherche.
Pour un trafic important, choisir un fournisseur de tuiles adapté selon la
[politique OpenStreetMap](https://operations.osmfoundation.org/policies/tiles/).
