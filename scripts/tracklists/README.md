Listes de chansons collées à la main, une par vidéo : `<id de la vidéo YouTube>.txt`.

Une ligne par chanson, pub ou intervention, avec le minutage où elle commence, dans n'importe lequel de ces formats :

```
0:00 Ident
0:09 The Stooges - I Wanna Be Your Dog
(3:38) The Who - The Seeker
Queen - One Vision 8:08
```

Ensuite, `node scripts/meta.mjs` met `src/meta.json` à jour (pas besoin de réseau pour ça). La liste collée passe avant la description YouTube.
