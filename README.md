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

## Synchro entre appareils

Dans **Réglages** (roue dentée en haut de l'accueil) : favoris, récents, mode, station en cours et bouts déjà entendus sont gardés dans un gist secret du compte GitHub de l'utilisateur (`src/sync.js`), sans serveur.

- Premier appareil : un lien ouvre la création d'un jeton GitHub avec seulement la permission `gist` ; on choisit « No expiration », on colle le jeton, et l'app trouve ou crée le gist.
- Autres appareils : « Ajouter un autre appareil » montre un code QR / lien (`#sync=…`, qui contient le jeton) ; l'ouvrir suffit.
- Synchro à l'ouverture, au retour sur l'onglet, en quittant, toutes les 5 min, et 20 s après un changement. Les bouts entendus sont combinés ; pour le reste, le changement le plus récent gagne.
- Restent propres à chaque appareil : volume, mode auto, connexions de scrobbling.

## Scrobbling (ListenBrainz, Last.fm)

Dans **Réglages**, on peut envoyer les chansons écoutées à ListenBrainz et/ou Last.fm, directement depuis le navigateur (pas de serveur).

- Seules les stations avec une liste de chansons minutée dans `src/meta.json` comptent ; les pubs, DJ, infos et appels sont ignorés (`parseSong` dans `src/scrobble.js`).
- « En écoute » est envoyé après 5 s, la chanson est comptée après la moitié (ou 4 min) entendue, si elle dure au moins 30 s. Les envois ratés (hors ligne) sont gardés et renvoyés plus tard.
- **ListenBrainz** : coller son jeton (listenbrainz.org/settings).
- **Last.fm** : il faut une clé d'application ([last.fm/api/account/create](https://www.last.fm/api/account/create)). Soit chacun entre la sienne dans l'app, soit on la met dans les secrets GitHub `LASTFM_KEY` et `LASTFM_SECRET` (repo → Settings → Secrets and variables → Actions) pour qu'elle soit incluse au déploiement. Le secret se retrouve forcément dans le code publié : sans gravité pour une clé d'usage perso.

## Stations

Tout est dans `src/stations.js` : jeu, nom, DJ, genre, couleur, vidéo YouTube et logo.

## Développement

```sh
npm install
npm run dev
```

## Déploiement

GitHub Pages via `.github/workflows/deploy.yml` à chaque push sur `main`.
