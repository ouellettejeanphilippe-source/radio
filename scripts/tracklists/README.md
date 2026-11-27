Listes de chansons collées à la main, une par vidéo : `<id de la vidéo YouTube>.txt`.

Une ligne par chanson, pub ou intervention, avec le minutage où elle commence, dans n'importe lequel de ces formats :

```
0:00 Ident
0:09 The Stooges - I Wanna Be Your Dog
(3:38) The Who - The Seeker
Queen - One Vision 8:08
```

Ensuite, `node scripts/meta.mjs --pasted` met `src/meta.json` à jour sans rien demander à YouTube. La liste collée passe avant la description et les commentaires de la vidéo.

Pour ne pas le faire à la main : avec une clé de l'API de YouTube, `YT_API_KEY=<clé> node scripts/meta.mjs` lit aussi les commentaires sous chaque vidéo et prend la liste de l'auteur, sinon celle d'un auditeur qui a la forme d'une liste de chansons (voir le haut de `scripts/meta.mjs`). C'est comme ça que 200 listes ont été trouvées; ce dossier sert pour celles qui restent.
