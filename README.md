# Radio

Lecteur web (PWA installable) pour écouter les radios des jeux en monde ouvert — GTA (III à V, Stories, épisodes), Saints Row, Mafia, Sleeping Dogs, Scarface, Watch Dogs, Forza Horizon, Cyberpunk 2077, Fallout — avec DJ et pubs, plus quelques créations de fans dans le même style.

Le repo ne contient **aucun contenu** : seulement l'interface et la liste des stations. L'audio vient d'enregistrements complets sur YouTube (lecteur intégré caché) et les logos sont chargés depuis les wikis Fandom.

## Fonctionnement

- Toucher une station la fait jouer. Le mini-lecteur du bas ouvre le lecteur complet (vidéo, contrôles, roue des radios).
- Glisser le mini-lecteur (ou le lecteur complet) à gauche/droite change de poste selon le mode : **même jeu**, **même époque** (époque où se passe le jeu) ou **aléatoire**.
- La roue des radios montre les stations du jeu en cours, comme dans GTA.
- Les bouts déjà entendus sont enregistrés par station ; chaque lancement repart près du début du plus long bout pas encore entendu.
- Un grichement de radio joue pendant le changement de poste.
- **Mode auto** : écran avec logo géant et gros boutons, l'écran reste allumé ; glisser n'importe où change de poste, toucher le logo ouvre la roue. Marche aussi à l'horizontale.
- Favoris (cœur) et « Récemment écoutées » en haut de l'accueil.
- Chaque station indique ce qu'il y a dans l'enregistrement : DJ + pubs, DJ, musique seulement ou talk-show. Quand la description YouTube a la liste des chansons avec les minutages, la chanson en cours est affichée (aussi sur l'écran verrouillé). Ces infos viennent de `src/meta.json`, généré par `node scripts/meta.mjs`.
- Si le navigateur met la lecture en pause en passant en arrière-plan, elle est relancée (utile en auto avec le GPS ouvert ; activer la lecture en arrière-plan dans Vivaldi/Brave ou utiliser Firefox).

## Stations

Tout est dans `src/stations.js` : jeu, nom, DJ, genre, couleur, vidéo YouTube et logo.

## Développement

```sh
npm install
npm run dev
```

## Déploiement

GitHub Pages via `.github/workflows/deploy.yml` à chaque push sur `main`.
