# Radio

Lecteur web (PWA installable) pour écouter les radios des jeux en monde ouvert, avec DJ et pubs : GTA (du premier au VI, avec London, Chinatown Wars, les Stories et les épisodes), Saints Row, Mafia, Sleeping Dogs, Scarface, Watch Dogs, Forza Horizon, Cyberpunk 2077 et Fallout, plus quelques créations de fans dans le même style.

Le repo contient l'interface et la liste des stations, sans audio ni logos de jeux. L'audio vient d'enregistrements complets sur YouTube (lecteur intégré caché) et l'app charge les logos depuis les wikis Fandom.

## Fonctionnement

- En haut de l'accueil, la bande des jeux sert d'index : chaque série y est inscrite une fois et chaque jeu est un repère. L'aiguille suit le jeu où la page est rendue, un toucher sur un repère y amène, et la bande reste collée en haut pendant qu'on défile (`src/GameBand.jsx`).
- Si un poste jouait quand on a quitté l'app, elle rouvre directement sur l'écran d'écoute : un toucher sur lecture et ça reprend. Après une pause, elle rouvre sur l'accueil.
- Toucher une station la fait jouer. Le mini-lecteur du bas ouvre l'écran d'écoute : le logo du poste en grand, et dessous le tableau de bord (cadran, poste, chanson en cours et la suivante, trois touches).
- La roue des radios montre les stations d'un jeu, comme dans GTA. Garder le doigt appuyé sur le lecteur (mini-lecteur, écran d'écoute ou mode auto) l'ouvre : on glisse vers un logo et on relâche pour syntoniser. Au clavier, c'est la touche Q qu'on garde enfoncée, en visant avec la souris. Un simple toucher sur le logo (ou un coup bref sur Q) l'ouvre aussi, pour choisir en touchant. Les flèches au centre (ou ← →) passent d'un jeu à l'autre. Quand un jeu a beaucoup de postes, la roue s'étire en ovale pour que les logos restent assez gros (`src/wheel.js`).
- Toucher le cadran de l'écran d'écoute (ou glisser vers le haut) montre les détails : la vidéo, la liste des chansons avec celle qui joue (un toucher y saute), le cadran complet et le mode de glissement.
- Glisser le mini-lecteur (ou l'écran d'écoute) à gauche ou à droite change de poste selon le mode : « Même jeu », « Même époque » (l'époque où se passe le jeu) ou « Aléatoire ».
- L'app retient les bouts déjà entendus de chaque station. Si on revient sur une station moins de 2 min après l'avoir quittée, ça reprend au même endroit. Sinon ça tombe au hasard dans le plus long bout pas encore entendu, en laissant au moins 5 min de chaque côté (ou pile à son début). Les trous de moins d'une minute comptent comme entendus.
- « Écoute en direct » (dans « Réglages », désactivée au départ) remplace cette reprise : chaque poste suit l'horloge, donc il a avancé quand on y revient et tout le monde entend le même moment. On ne peut alors plus déplacer l'aiguille.
- Un grichement de radio joue pendant le changement de poste.
- Le mode auto affiche un logo géant et de gros boutons, et garde l'écran allumé. Glisser n'importe où change de poste, toucher le logo ouvre la roue. Ça marche aussi à l'horizontale.
- Favoris (cœur) et « Récemment écoutées » en haut de l'accueil.
- Chaque station indique ce qu'il y a dans l'enregistrement : DJ + pubs, DJ, musique seulement ou talk-show. Quand on a la liste des chansons avec les minutages, l'app affiche la chanson en cours (aussi sur l'écran verrouillé), la suivante et la liste complète. Ces infos viennent de `src/meta.json`, généré par `node scripts/meta.mjs` à partir des descriptions YouTube. Quand la description n'a pas de minutages (c'est le cas de la plupart des GTA), on peut coller une liste minutée, souvent trouvée dans un commentaire sous la vidéo, dans `scripts/tracklists/<id de la vidéo>.txt`.
- Si le navigateur met la lecture en pause en passant en arrière-plan, l'app la relance (utile en auto avec le GPS ouvert ; activer la lecture en arrière-plan dans Vivaldi/Brave ou utiliser Firefox).

## Synchro entre appareils

La synchro s'active dans « Réglages » (roue dentée en haut de l'accueil). L'app garde alors les favoris, les récents, le mode de glissement, l'écoute en direct, la station en cours et les bouts déjà entendus dans un gist secret du compte GitHub de l'utilisateur (`src/sync.js`), sans serveur.

- Premier appareil : un lien ouvre la création d'un jeton GitHub avec seulement la permission `gist` ; on choisit « No expiration », on colle le jeton, et l'app trouve ou crée le gist.
- Autres appareils : « Ajouter un autre appareil » montre un code QR / lien (`#sync=…`, qui contient le jeton) ; l'ouvrir suffit.
- Synchro à l'ouverture, au retour sur l'onglet, en quittant, toutes les 5 min, et 20 s après un changement. L'app combine les bouts entendus ; pour le reste, le changement le plus récent gagne.
- Restent propres à chaque appareil : volume, mode auto, connexions de scrobbling.

## Scrobbling (ListenBrainz, Last.fm)

Dans « Réglages », on peut envoyer les chansons écoutées à ListenBrainz et/ou Last.fm depuis le navigateur, là aussi sans serveur.

- Seules les stations avec une liste de chansons minutée dans `src/meta.json` comptent ; `parseSong` (dans `src/scrobble.js`) ignore les pubs, les DJ, les infos et les appels.
- L'app envoie « En écoute » après 5 s et compte la chanson une fois la moitié (ou 4 min) entendue, si elle dure au moins 30 s. Elle garde les envois ratés (hors ligne) et les renvoie plus tard.
- Pour ListenBrainz, coller son jeton (listenbrainz.org/settings).
- Pour Last.fm, il faut une clé d'application ([last.fm/api/account/create](https://www.last.fm/api/account/create)). Soit chacun entre la sienne dans l'app, soit on la met dans les secrets GitHub `LASTFM_KEY` et `LASTFM_SECRET` (repo > Settings > Secrets and variables > Actions) pour que le déploiement l'inclue. Le secret se retrouve alors dans le code publié, ce qui est sans gravité pour une clé d'usage perso.

## Stations

Tout est dans `src/stations.js` : jeu, nom, DJ, genre, couleur, vidéo YouTube et logo.

## Développement

```sh
npm install
npm run dev
```

## Déploiement

GitHub Pages via `.github/workflows/deploy.yml` à chaque push sur `main`.
