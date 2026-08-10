# ARCADE

Une arcade de micro-jeux : 5 secondes chacun, une seule action, ça accélère,
4 vies. Un seul code pour PC et téléphone.

## Lancer

```bash
python3 -m http.server 8000
```

Puis <http://localhost:8000>. (Un serveur est nécessaire : le projet utilise
des modules ES, qui ne se chargent pas en `file://`.)

Pour jouer sur ton téléphone pendant que tu développes, mets ton PC et ton
téléphone sur le même wifi et ouvre `http://<ip-de-ton-pc>:8000`.

Pour publier : pousse sur GitHub, active GitHub Pages sur la branche, et tu as
un lien à envoyer. Sur mobile, « Ajouter à l'écran d'accueil » installe le jeu
en plein écran.

## Commandes

Une seule action, partout la même : **appuyer**.
Doigt sur mobile, clic ou barre d'espace sur PC. Certains jeux utilisent
*où* tu as appuyé, d'autres le moment où tu **relâches**.

## Ajouter un micro-jeu

Crée `src/games/monJeu.js` :

```js
import { C } from '../palette.js'
import { texte, rect, cercle, dist, vers } from '../dessin.js'

export default {
  id: 'mon-jeu',
  consigne: 'FAIS UN TRUC !',   // le mot d'ordre affiché avant le jeu
  duree: 4,                     // secondes, à vitesse 1
  siTempsEcoule: 'perd',        // 'gagne' si survivre suffit

  init(g) { g.e.x = g.W / 2 },
  maj(g, dt) { g.e.x += 60 * dt },
  dessine(g, ctx) { rect(ctx, g.e.x, 300, 40, 40, C.joueur, 8) },
  appui(g, p) { if (p.x > g.W / 2) g.gagne() },
  relache(g, p) {},
}
```

Puis ajoute-le dans `src/games/index.js`. C'est tout : il entre dans la
rotation et apparaît dans le mode libre.

### Ce que contient `g`

| | |
|---|---|
| `g.W`, `g.H` | taille de l'écran logique (360 × 640) |
| `g.t`, `g.restant`, `g.duree` | temps écoulé / restant / total, en secondes |
| `g.e` | ton état à toi, vide au départ |
| `g.gagne()`, `g.perd()` | termine le jeu ; le premier appel gagne |
| `g.hasard()` | nombre aléatoire 0..1 |
| `g.entier(a, b)` | entier dans `[a, b[` |
| `g.pointer` | dernière position d'appui |
| `g.maintenu` | vrai tant que c'est appuyé |
| `g.vitesse`, `g.score` | pour les jeux qui veulent tricher avec le méta |

`dt` est déjà multiplié par la vitesse de la partie : écris ton jeu comme s'il
tournait à vitesse normale, l'accélération est gratuite.

## Les règles qui font que ça marche

1. **Une seule action.** Pas de clavier, pas de deux doigts. C'est ce qui rend
   PC et mobile identiques — et c'est la contrainte qui rend les idées bonnes.
2. **Pas de tutoriel.** Si la consigne en deux mots ne suffit pas, l'idée est
   à revoir.
3. **Le mode libre est ton outil de dev.** Menu → MODE LIBRE → ton jeu tourne
   en boucle, sans perdre de vies.

## Idées de micro-jeux à écrire

Des mécaniques classiques : viser, suivre, compter, mémoriser, trier,
équilibrer, freiner, relâcher au bon moment.

Et celles qui tordent les codes, plus drôles à écrire :

- la consigne ment (« TAPE ! » alors qu'il ne faut surtout pas)
- le jeu réutilise ton score comme élément de décor
- il se joue à l'envers du précédent
- il ressemble à un écran de chargement, mais c'est déjà le jeu
- il utilise l'heure réelle du téléphone
- il n'affiche rien du tout pendant deux secondes
