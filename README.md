# ARCADE

Une borne d'arcade : plusieurs petits jeux, une partie de deux à trois minutes,
une seule action pour jouer. Un seul code pour le web et pour Android.

## Où ça tourne

| | comment | mise à jour |
|---|---|---|
| **Android** | vraie app, APK installable | on relance le workflow quand on veut une nouvelle version |
| **iPhone / iPad** | web, « Ajouter à l'écran d'accueil » | automatique à chaque push |
| **PC** | navigateur | automatique à chaque push |

Le natif iOS demanderait un Mac et l'Apple Developer Program à 99 $/an, donc
sur Apple c'est la version web — en plein écran, hors-ligne, avec son icône.
Pour un jeu en Canvas, la différence ne se voit pas.

## Jouer / tester

**Depuis le téléphone**, il n'y a rien à installer : chaque push met à jour la
page GitHub Pages du dépôt. C'est la boucle de test du quotidien.

**Sur un ordinateur**, si tu en as un sous la main :

```bash
npm run dev      # assemble www/ et sert le tout sur http://localhost:8000
```

## Construire l'APK

Onglet **Actions** → **APK Android** → *Run workflow*. Ça se fait très bien
depuis un téléphone.

Au bout de quelques minutes, l'APK apparaît dans les **Releases** du dépôt :
un lien direct, téléchargeable et installable en un appui (il faut autoriser
l'installation depuis des sources inconnues la première fois).

C'est un APK de debug, non signé pour le Play Store — parfait pour installer
soi-même et faire tourner autour de soi.

### À faire une fois dans les réglages du dépôt

*Settings → Pages → Source : **GitHub Actions***, sinon la version web ne se
déploie pas.

## Ajouter un jeu

Crée `src/games/monJeu.js` :

```js
import { C } from '../palette.js'
import { texte, rect, cercle, dist, borne, vers } from '../dessin.js'

export default {
  id: 'mon-jeu',              // sert de clé pour le record, ne le change plus
  nom: 'MON JEU',
  pitch: 'Une ligne pour dire comment on joue',
  couleur: C.violet,          // la barre de couleur sur l'accueil
  unite: 'pts',

  init(j) { j.e.x = j.W / 2 },
  maj(j, dt) { j.score += dt },
  dessine(j, ctx) { rect(ctx, j.e.x, 300, 40, 40, C.joueur, 8) },
  appui(j, p) {},
  relache(j, p) {},
}
```

Puis ajoute-le dans `src/games/index.js`. C'est tout.

### Ce que contient `j`

| | |
|---|---|
| `j.W`, `j.H` | l'écran logique, 360 × 640 |
| `j.HUD` | hauteur du bandeau du haut — ne dessine rien dessous |
| `j.t` | temps écoulé depuis le début de la partie |
| `j.score` | à toi de l'augmenter ; le moteur l'affiche et le sauvegarde |
| `j.meilleur` | le record du joueur sur ce jeu |
| `j.e` | ton état à toi, vide au départ |
| `j.perdu()` | termine la partie |
| `j.pointer` | position du dernier appui (suit la souris sur PC) |
| `j.maintenu` | vrai tant que c'est appuyé |
| `j.hasard()`, `j.entier(a, b)` | aléatoire |
| `j.son` | les bruitages (voir plus bas) |

Le moteur s'occupe du reste : accueil, pause, écran de fin, records.

## Le son

Tout est synthétisé à la volée dans `src/son.js` : aucun fichier audio, donc
rien à télécharger, et surtout la hauteur des notes se calcule. Le
casse-brique monte d'un demi-ton par rangée — vider une colonne fait une
gamme — et les cibles montent avec le combo, donc on *entend* qu'on enchaîne.

Depuis un jeu :

```js
j.son.rebond()        // impact court
j.son.casse(rang)     // note qui dépend de la rangée
j.son.ramasse()       // bonus attrapé
j.son.touche(combo)   // monte avec le combo
j.son.rate()          // raté
j.son.niveau()        // petite fanfare
```

Le moteur joue tout seul le clic des boutons, la mort et le record.

Pour inventer un bruitage, tu as deux briques : `_note({type, de, a, duree,
volume})` pour une note (avec glissando de `de` vers `a`), et `_bruit({duree,
coupe, type})` pour les impacts. Depuis la console du navigateur, `son` est
accessible : tape `son.casse(3)` pour essayer.

Le bouton ♪ en haut à droite de l'accueil coupe le son, et le choix est
retenu. À savoir : sur iPhone, le son ne peut démarrer qu'après un vrai appui
(le moteur s'en charge), et l'interrupteur latéral de silence coupe tout,
comme pour n'importe quelle page web.

## Les règles qui font que ça marche

1. **Une seule action.** Appuyer. C'est ce qui rend PC et mobile identiques,
   et ça oblige à trouver des idées plutôt qu'à empiler des boutons.
2. **Une partie dure deux à trois minutes.** Donc il faut une difficulté qui
   monte : sans ça, c'est mou à la fin ou impossible au début.
3. **Zéro texte d'explication en jeu.** Si le pitch d'une ligne ne suffit pas,
   le jeu est trop compliqué.

## Structure

```
index.html          la page, trois lignes
build.mjs           assemble www/ (aucune dépendance)
capacitor.config.json
src/
  engine.js         accueil, pause, fin, records — ne connaît aucun jeu
  input.js          souris / doigt / espace -> appui + relâche
  son.js            les bruitages, synthétisés (aucun fichier audio)
  dessin.js         texte, rect, cercle, dist, borne, vers
  palette.js        les couleurs communes
  games/            les jeux + le catalogue
.github/workflows/
  web.yml           déploie la version web à chaque push
  apk.yml           construit l'APK, uniquement à la demande
```

## Astuces

- `moteur` est accessible depuis la console du navigateur : `moteur.j` donne
  l'état du jeu en cours, en direct.
- La touche Échap met en pause.

## La suite

- une interface pour publier des jeux sans passer par git
- des scores en ligne

Note pour plus tard : le code des jeux reste dans git — c'est lui qui donne
l'historique et le retour arrière gratuits. Un backend (Supabase ou autre) ne
servira que pour ce que des fichiers statiques ne savent pas faire : les
comptes, les classements, la modération.
