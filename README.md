# Radio

Lecteur web (PWA installable) pour écouter les radios des jeux en monde ouvert, avec DJ et pubs : GTA (du premier au VI, avec London, Chinatown Wars, les Stories et les épisodes), Saints Row, Mafia, Sleeping Dogs, Scarface, Watch Dogs, Forza Horizon, Cyberpunk 2077 et Fallout, plus quelques créations de fans dans le même style.

Le repo contient l'interface et la liste des stations, sans audio ni logos de jeux. L'audio vient d'enregistrements complets sur YouTube (lecteur intégré caché) et l'app charge les logos depuis les wikis Fandom.

## Fonctionnement

- L'accueil, c'est le poste lui-même, et l'écran reste presque vide exprès : le logo du poste qui joue au milieu, ses voisins en retrait sur les bords, le poste et la chanson en cours dans un coin, la touche lecture et le cadran en filet. Pas de rangées de tuiles.
- Les logos forment une rangée qu'on fait glisser : elle s'arrête à chaque poste et syntonise celui où elle s'arrête. Ce sont les postes du même jeu, de la même époque ou de tous les jeux en ordre mêlé, selon le mode (« Même jeu », « Même époque », « Aléatoire »). Toucher un voisin l'amène au milieu. À la souris : la molette, les flèches ← →, ou les deux touches à côté de lecture. Si rien n'a encore joué, glisser amène seulement le poste; la touche lecture le démarre.
- Le nom du jeu, en haut à gauche, ouvre le choix du jeu : une feuille qui monte du bas sur un téléphone, un panneau au milieu sur un ordi. On y trouve tous les jeux, par série, et un onglet « Favoris » avec les favoris et les postes récents. Choisir un jeu ramène au dernier poste écouté dans ce jeu, sinon à son premier.
- La roue des radios montre les postes d'un jeu, comme dans GTA. Garder le doigt appuyé sur l'écran (accueil ou mode auto) l'ouvre : on glisse vers un logo et on relâche pour syntoniser. Au clavier, c'est la touche Q qu'on garde enfoncée, en visant avec la souris. Un simple toucher sur le logo (ou un coup bref sur Q) l'ouvre aussi, pour choisir en touchant. Glisser sur la roue la fait tourner jusqu'au jeu suivant ou précédent, favoris et récents compris; les flèches au centre, ← → et la molette font pareil. La roue reste toujours ronde : quand un jeu a beaucoup de postes, elle grandit jusqu'au bord de l'écran, puis ce sont les logos qui rapetissent (`src/wheel.js`).
- La loupe (ou la touche /) ouvre la liste de tous les postes, par jeu, en texte. C'est aussi la recherche : taper un nom de poste, de DJ, de genre ou de jeu la réduit.
- Toucher le nom du poste ou le cadran (ou glisser vers le haut) montre les détails : la vidéo, la liste des chansons avec celle qui joue (un toucher y saute), le cadran complet et le mode de glissement.
- Le cœur à côté du nom met le poste dans les favoris.
- L'app retient les bouts déjà entendus de chaque station. Si on revient sur une station moins de 2 min après l'avoir quittée, ça reprend au même endroit. Sinon ça tombe au hasard dans le plus long bout pas encore entendu, en laissant au moins 5 min de chaque côté (ou pile à son début). Les trous de moins d'une minute comptent comme entendus.
- « Écoute en direct » (dans « Réglages », désactivée au départ) remplace cette reprise : chaque poste suit l'horloge, donc il a avancé quand on y revient et tout le monde entend le même moment. On ne peut alors plus déplacer l'aiguille.
- Un grichement de radio joue pendant le changement de poste.
- Le mode auto affiche un logo géant et de gros boutons, et garde l'écran allumé. Glisser n'importe où change de poste, toucher le logo ouvre la roue. Ça marche aussi à l'horizontale.
- Chaque station indique ce qu'il y a dans l'enregistrement : DJ + pubs, DJ, musique seulement ou talk-show. Quand on a la liste des chansons avec les minutages, l'app affiche la chanson en cours (aussi sur l'écran verrouillé) et la liste complète. Ces infos viennent de `src/meta.json`, généré par `node scripts/meta.mjs` à partir des descriptions YouTube. Quand la description n'a pas de minutages (c'est le cas de la plupart des GTA), on peut coller une liste minutée, souvent trouvée dans un commentaire sous la vidéo, dans `scripts/tracklists/<id de la vidéo>.txt`.
- Si le navigateur met la lecture en pause en passant en arrière-plan, l'app la relance (utile en auto avec le GPS ouvert ; activer la lecture en arrière-plan dans Vivaldi/Brave ou utiliser Firefox).

## Android, l'auto et l'écran verrouillé

L'app donne à Android le poste, la chanson en cours, le logo et la position dans l'enregistrement, et répond aux touches du téléphone. Tout ce qui passe par le lecteur actif d'Android s'en sert : l'écran verrouillé, la notification, les boutons du volant ou d'un casque, l'assistant vocal (« suivant », « pause ») et les lanceurs d'auto comme AutoZen.

- Précédent et suivant changent de poste, selon le mode de glissement. Le réglage « Précédent et suivant changent de chanson » les fait passer d'une chanson à l'autre sur les postes dont on a la liste; précédent revient alors au début de la chanson, ou à celle d'avant si elle vient de commencer.
- Recul et avance déplacent de 30 s, et la barre de la notification déplace l'aiguille. En écoute en direct, ni l'un ni l'autre n'est offert.
- Le son vient du lecteur YouTube, dans son propre cadre, et c'est normalement à lui qu'Android confie les commandes : on verrait le titre de la vidéo, sans pouvoir changer de poste. Pour les garder, l'app joue une piste de silence à côté (`src/session.js`). Ça se désactive dans « Réglages » (« Commandes du téléphone ») si le son coupe, et la même section dit si la piste joue ou si le navigateur l'a refusée; c'est désactivé au départ sur iPhone, où ça n'a pas été essayé.
- Le logo est redessiné en PNG sur la tuile du poste, parce que la notification n'affiche pas les SVG du wiki.
- Installée depuis le navigateur, l'app a un raccourci « Mode auto » (appui long sur son icône).
- La lecture en arrière-plan dépend encore du navigateur, comme indiqué plus haut.

## Synchro entre appareils

La synchro s'active dans « Réglages » (roue dentée en haut de l'écran). L'app garde alors les favoris, les récents, le mode de glissement, l'écoute en direct, la station en cours et les bouts déjà entendus dans un gist secret du compte GitHub de l'utilisateur (`src/sync.js`), sans serveur.

- Premier appareil : un lien ouvre la création d'un jeton GitHub avec seulement la permission `gist` ; on choisit « No expiration », on colle le jeton, et l'app trouve ou crée le gist.
- Autres appareils : « Ajouter un autre appareil » montre un code QR / lien (`#sync=…`, qui contient le jeton) ; l'ouvrir suffit.
- Synchro à l'ouverture, au retour sur l'onglet, en quittant, toutes les 5 min, et 20 s après un changement. L'app combine les bouts entendus ; pour le reste, le changement le plus récent gagne.
- Restent propres à chaque appareil : volume, mode auto, commandes du téléphone, connexions de scrobbling.

## Scrobbling (ListenBrainz, Last.fm)

Dans « Réglages », on peut envoyer les chansons écoutées à ListenBrainz et/ou Last.fm depuis le navigateur, là aussi sans serveur.

- Seules les stations avec une liste de chansons minutée dans `src/meta.json` comptent ; `parseSong` (dans `src/scrobble.js`) ignore les pubs, les DJ, les infos et les appels.
- L'app envoie « En écoute » après 5 s et compte la chanson une fois la moitié (ou 4 min) entendue, si elle dure au moins 30 s. Elle garde les envois ratés (hors ligne) et les renvoie plus tard.
- Pour ListenBrainz, coller son jeton (listenbrainz.org/settings).
- Pour Last.fm, il faut une clé d'application ([last.fm/api/account/create](https://www.last.fm/api/account/create)). Soit chacun entre la sienne dans l'app, soit on la met dans les secrets GitHub `LASTFM_KEY` et `LASTFM_SECRET` (repo > Settings > Secrets and variables > Actions) pour que le déploiement l'inclue. Le secret se retrouve alors dans le code publié, ce qui est sans gravité pour une clé d'usage perso.

## Stations

Tout est dans `src/stations.js` : jeu, nom, DJ, genre, couleur, vidéo YouTube et logo.

## Mises à jour

L'app vérifie s'il y a une version plus récente quand on y revient, puis aux 15 minutes (`src/update.js`). Si rien ne joue, elle se recharge toute seule; sinon la roue dentée s'allume et « Réglages » offre « Passer à la nouvelle version ». Le bas des réglages indique la version qui roule. Sans ça, une app installée garde son ancien code tant qu'elle reste ouverte, et GitHub Pages laisse la page en cache dix minutes.

## Développement

```sh
npm install
npm run dev
```

## Déploiement

GitHub Pages via `.github/workflows/deploy.yml` à chaque push sur `main`.
