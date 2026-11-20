# Radio

Lecteur web style Spotify pour écouter les stations de radio des jeux GTA (musique + DJ + pubs) à partir de mixes complets hébergés sur YouTube.

Le repo ne contient **aucun contenu** : seulement l'interface et la liste des stations. L'audio est joué via le lecteur YouTube intégré.

## Fonctionnement

- Chaque station pointe vers une vidéo YouTube d'un mix complet.
- Les bouts déjà entendus sont enregistrés pour chaque mix (localStorage).
- À chaque lancement, on part près du début du plus long bout pas encore entendu, avec un petit décalage au hasard. Le mix est traité comme une boucle, donc la première écoute part n'importe où.
- Quand il ne reste plus de bout neuf d'au moins une minute, l'historique de la station repart à zéro.
- Le panneau « En lecture » montre la carte de ce qui a déjà été écouté, avec un bouton pour la réinitialiser.
- La dernière station écoutée et le volume sont aussi mémorisés.
- Raccourcis : espace = lecture/pause, touches média du clavier supportées.

## Ajouter les liens

Dans `src/stations.js` : `youtube` (URL ou ID) et `logo` (URL d'image, optionnel). Les stations sans lien ne sont pas affichées.

Sans logo, la pochette utilise la miniature YouTube, sinon une tuile générée avec la couleur de la station.

## Développement

```sh
npm install
npm run dev
```

## Déploiement

GitHub Pages via `.github/workflows/deploy.yml` à chaque push sur `main`. Dans les réglages du repo : **Settings → Pages → Source : GitHub Actions**.
