# Radio

Lecteur web (PWA installable) pour écouter les radios des jeux en monde ouvert, avec DJ et pubs : GTA (du premier au VI, avec London, Chinatown Wars, les Stories et les épisodes), Saints Row, Mafia, Sleeping Dogs, Scarface, Watch Dogs, Forza Horizon, Cyberpunk 2077 et Fallout, plus Big Cuppa Radio, une émission mensuelle diffusée d'un sous-sol de l'est de Londres.

Le repo contient l'interface et la liste des stations, sans audio ni logos de jeux. L'audio vient d'enregistrements complets sur YouTube (lecteur intégré caché) et l'app charge les logos depuis les wikis Fandom.

## Fonctionnement

- L'accueil, c'est le poste lui-même, et l'écran reste presque vide exprès : le logo du poste qui joue au milieu, ses voisins en retrait sur les bords, le poste et la chanson en cours dans un coin, la touche lecture et le cadran en filet. Pas de rangées de tuiles.
- Les logos forment une rangée qu'on fait glisser : elle s'arrête à chaque poste et syntonise celui où elle s'arrête. Ce sont les postes du même jeu, de la même époque ou de tous les jeux en ordre mêlé, selon le mode (« Même jeu », « Même époque », « Aléatoire »). Toucher un voisin l'amène au milieu. À la souris : la molette, les flèches ← →, ou les deux touches à côté de lecture. Si rien n'a encore joué, glisser amène seulement le poste; la touche lecture le démarre.
- Le nom du jeu, en haut à gauche, ouvre le choix du jeu : une feuille qui monte du bas sur un téléphone, un panneau au milieu sur un ordi. On y trouve tous les jeux, par série, et un onglet « Favoris » avec les favoris et les postes récents. Choisir un jeu ramène au dernier poste écouté dans ce jeu, sinon à son premier.
- La roue des radios montre les postes d'un jeu, comme dans GTA. Garder le doigt appuyé sur l'écran (accueil ou mode auto) l'ouvre : on glisse vers un logo et on relâche pour syntoniser. Au clavier, c'est la touche Q qu'on garde enfoncée, en visant avec la souris. Un simple toucher sur le logo (ou un coup bref sur Q) l'ouvre aussi. Dans la roue ouverte, appuyer sur un logo l'allume sans rien changer encore : la lumière suit le doigt (ou la souris) d'un logo à l'autre, et c'est le poste allumé au relâchement qui part; relâcher au milieu de la roue ne choisit rien. Glisser à partir d'ailleurs que d'un logo fait rouler la roue sous le doigt pendant que celle du jeu voisin arrive par le côté, favoris et récents compris; passé le cinquième de l'écran, ou d'un coup sec, elle va au bout, sinon elle revient. Les flèches au centre, ← → et la molette la font rouler aussi. La roue reste toujours ronde : quand un jeu a beaucoup de postes, elle grandit jusqu'au bord de l'écran, puis ce sont les logos qui rapetissent (`src/wheel.js`).
- La loupe (ou la touche /) ouvre la liste de tous les postes, par jeu, en texte. C'est aussi la recherche : taper un nom de poste, de DJ, de genre ou de jeu la réduit.
- Toucher le nom du poste ou le cadran (ou glisser vers le haut) montre les détails : la vidéo, la liste des chansons avec celle qui joue (un toucher y saute), le cadran complet et le mode de glissement.
- Le cœur à côté du nom met le poste dans les favoris.
- L'app retient les bouts déjà entendus de chaque station. Si on revient sur une station moins de 2 min après l'avoir quittée, ça reprend au même endroit. Sinon ça tombe au hasard dans le plus long bout pas encore entendu, en laissant au moins 5 min de chaque côté (ou pile à son début). Les trous de moins d'une minute comptent comme entendus.
- « Écoute en direct » (dans « Réglages », désactivée au départ) remplace cette reprise : chaque poste suit l'horloge, donc il a avancé quand on y revient et tout le monde entend le même moment. On ne peut alors plus déplacer l'aiguille.
- Un grichement de radio joue pendant le changement de poste.
- Derrière l'accueil, à la place du halo de couleur seul : une image de la ville ou du monde du jeu (Los Santos, Vice City, Night City, le Strip de New Vegas…), et une photo de la vraie ville derrière un poste de Montréal ou de Sherbrooke. Elle est assombrie, plus encore en haut et en bas où sont les mots, pour que l'écran reste calme et que le logo ressorte. Elle n'arrive qu'une fois chargée; sans image (Scarface) ou sans réseau, la nuit unie reste. Les images sont dans `BACKDROP` (`src/stations.js`), avec le cadrage à garder quand l'écran les recadre.
- « Dans la vraie vie » : 61 vrais postes, en direct, dans le choix du jeu comme quatre lieux de plus : Montréal (30), Sherbrooke (12), les Cantons-de-l'Est (5 : Granby, Coaticook, Val-des-Sources, Lac-Brome, Acton Vale) et les États-Unis (14 postes du Vermont, de l'État de New York et du New Hampshire qu'on capte près de la frontière). Hors de la ville qui donne son nom à la section, la ville du poste suit sa fréquence. L'app joue elle-même le flux du poste, celui que jouent son site et les annuaires (`src/stream.js`) : lecture et pause, touches du téléphone, écran verrouillé, mode auto. Il n'y a rien à reculer : une pause lâche le flux, et la lecture reprend la diffusion là où elle est rendue. Trois postes n'ont pas de flux qu'une page sécurisée peut jouer (CISM, KIC Country, Radio Centre-Ville) : leur touche lecture ouvre le poste ailleurs. Sous chaque poste, un lien « Aussi sur TuneIn » ou « sur le site du poste » sert de secours quand un flux ne vient pas. Les postes de musique de Cogeco et de Bell (CKOI, Rythme, The Beat, CHOM, Virgin, Énergie, Rouge) ne jouent qu'au Canada; à l'inverse, il se peut que certains postes américains ne jouent qu'aux États-Unis. Les vrais postes ne se mêlent pas aux modes « Même époque » et « Aléatoire ».
- Big Cuppa Radio ([mixcloud.com/bigcupparadio](https://www.mixcloud.com/bigcupparadio/)) : une seule station faite de ses 23 émissions, comme un poste de jeu est fait de ses chansons. La syntoniser tombe dans une émission tirée au hasard (avec plus de chances s'il en reste beaucoup à entendre), à un moment pas encore entendu; quand l'émission finit, une autre suit; revenir en moins de deux minutes reprend la même, au même endroit. En mode « en direct », les émissions se suivent dans l'ordre selon l'horloge. L'émission qui joue est écrite là où serait la chanson, à l'accueil comme sur l'écran verrouillé, avec sa propre photo. Les émissions jouent dans le lecteur officiel de Mixcloud, piloté par son API (`src/mixcloud.js`); Mixcloud demande que ce lecteur reste visible, alors il prend la place du cadran, au bas de l'accueil, tant que la station joue. Mixcloud ne laisse pas toujours se déplacer dans une émission (selon l'émission et l'auditeur) : la station joue alors l'émission du début, et un saut refusé n'est pas compté comme entendu. Pas de liste de chansons : Mixcloud ne la donne pas.
- Le mode auto affiche un logo géant et de gros boutons, et garde l'écran allumé. Glisser n'importe où change de poste, toucher le logo ouvre la roue. Ça marche aussi à l'horizontale.
- Chaque station indique ce qu'il y a dans l'enregistrement : DJ + pubs, DJ, musique seulement ou talk-show. Quand on a la liste des chansons avec les minutages, l'app affiche la chanson en cours (aussi sur l'écran verrouillé) et la liste complète. Ces infos viennent de `src/meta.json`, généré par `node scripts/meta.mjs` à partir des descriptions YouTube. Quand la description n'a pas de minutages (c'est le cas de la plupart des GTA), la liste est souvent dans un commentaire sous la vidéo. Avec une clé de l'API de YouTube, `YT_API_KEY=<clé> node scripts/meta.mjs` lit aussi ces commentaires et prend celui qui a la forme d'une liste; sans clé, on peut coller une liste minutée dans `scripts/tracklists/<id de la vidéo>.txt`. Une liste déjà trouvée n'est jamais perdue par une passe qui n'en trouve pas.
- Si le navigateur met la lecture en pause en passant en arrière-plan, l'app la relance (utile en auto avec le GPS ouvert ; activer la lecture en arrière-plan dans Vivaldi/Brave ou utiliser Firefox).

## Android, l'auto et l'écran verrouillé

L'app donne à Android le poste, la chanson en cours, le logo et la position dans l'enregistrement, et répond aux touches du téléphone. Tout ce qui passe par le lecteur actif d'Android s'en sert : l'écran verrouillé, la notification, les boutons du volant ou d'un casque, l'assistant vocal (« suivant », « pause ») et les lanceurs d'auto comme AutoZen.

- Précédent et suivant font ce que dit le réglage « Touches précédent et suivant ». « Poste » : ils changent de poste, selon le mode de glissement. « Chanson » : ils passent d'une chanson à l'autre sur les postes dont on a la liste (précédent revient au début de la chanson, ou à celle d'avant si elle vient de commencer), et sautent 30 secondes sur les autres. « 30 secondes » : ils reculent ou avancent de 30 secondes partout. En direct, ils changent toujours de poste.
- Un saut vers l'avant compte comme écouté : c'est fait pour passer un pépin dans l'enregistrement ou une chanson en double sans que ce bout revienne plus tard comme « pas encore entendu ». Les mêmes sauts de 30 secondes sont sur les deux touches de chaque côté du cadran, dans le panneau de détails, et sur Maj + ← →.
- Recul et avance déplacent de 30 s, et la barre de la notification déplace l'aiguille. En écoute en direct, ni l'un ni l'autre n'est offert.
- Le son vient du lecteur YouTube, dans son propre cadre, et c'est normalement à lui qu'Android confie les commandes : on verrait le titre de la vidéo, sans pouvoir changer de poste. Pour les garder, l'app joue une piste de silence à côté (`src/session.js`). Le téléphone peut arrêter cette piste de lui-même en laissant jouer YouTube, qui reprend alors les commandes avec le titre et la vignette de la vidéo : tant que l'enregistrement avance, l'app la relance, à la seconde. Ça se désactive dans « Réglages » (« Commandes du téléphone ») si le son coupe, et la même section dit en direct si la piste joue, si elle s'est arrêtée sous un poste qui joue ou si le navigateur l'a refusée, dans quel navigateur on est, et combien de fois le téléphone l'a arrêtée; c'est désactivé au départ sur iPhone, où ça n'a pas été essayé.
- Le logo est redessiné en PNG de 512 px sur la tuile du poste, parce que la notification n'affiche pas les SVG du wiki. Un poste sans logo y a son nom, comme dans l'app, et les petites textures de jeu y restent du pixel art net. L'image est remise au téléphone dans l'adresse elle-même (`data:`), pas par une adresse temporaire qu'il faudrait encore aller chercher. Le téléphone n'est jamais laissé sans image : pendant qu'une tuile se dessine, c'est l'icône de l'app en 512 px, sinon il agrandirait la petite icône de la page.
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

Tout est dans `src/stations.js` : jeu, nom, DJ, genre, couleur, vidéo YouTube et logo. Les vrais postes y sont aussi (`REAL`) : fréquence, nom, genre, couleur, flux audio, identifiant TuneIn et site du poste. Chacun a son vrai logo, le plus net qui existe : en vectoriel depuis Logopedia pour les grands postes, dans la version dessinée pour fond sombre quand il y en a une; sinon celui de Wikipédia ou le carré de 600 px de TuneIn. Un logo dessiné pour une page blanche (`paper`) est posé sur une plaque claire. Radio VM et CJMQ n'ont pas de logo d'assez bonne qualité : leur nom est écrit. Un poste sans logo affiche son nom, écrit dans la police de l'app et ajusté pour remplir le carré (`src/sign.js`), ou ses initiales là où l'image est petite, comme sur la roue : la vignette de la vidéo est presque toujours la jaquette du jeu, la même pour tous ses postes. Quand l'enregistrement a une vraie illustration du poste, on ajoute son identifiant à `OWN_ART` et c'est elle qui s'affiche, en pleine résolution.

## Crédits des images

Les logos et les images de fond des jeux viennent des wikis Fandom de chaque jeu; ceux des vrais postes, de Logopedia, de Wikipédia et de TuneIn. Ce sont les marques de ces postes. Rien de tout ça n'est dans le dépôt : l'app les charge à l'affichage.

Les quatre photos derrière les vrais postes viennent de Wikimedia Commons :

- Montréal : « View of downtown Montreal », par Jiaqian AirplaneFan, [CC BY 3.0](https://creativecommons.org/licenses/by/3.0).
- Sherbrooke : « Sherbrooke, Quebec - centre-ville en automne - 1 », par Cantons-de-l'Est, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0).
- Cantons-de-l'Est : « Pano orford » (le mont Orford vu de Sherbrooke), par Libertad-pb, [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0).
- États-Unis : « Silent sunset over lake Champlain » (Burlington, Vermont), par Marco Nürnberger, [CC BY 2.0](https://creativecommons.org/licenses/by/2.0).

Elles sont affichées assombries et recadrées; les crédits sont aussi au bas des réglages.

## Mises à jour

L'app vérifie s'il y a une version plus récente quand on y revient, puis aux 15 minutes (`src/update.js`). Si rien ne joue, elle se recharge toute seule; sinon la roue dentée s'allume et « Réglages » offre « Passer à la nouvelle version ». Le bas des réglages indique la version qui roule. Sans ça, une app installée garde son ancien code tant qu'elle reste ouverte, et GitHub Pages laisse la page en cache dix minutes.

## Développement

```sh
npm install
npm run dev
```

## Déploiement

GitHub Pages via `.github/workflows/deploy.yml` à chaque push sur `main`.
