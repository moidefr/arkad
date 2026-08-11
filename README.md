# ARKAD

Une borne d'arcade : un jeu d'aventure au centre, dix-huit mini-jeux autour.
Une partie dure deux à trois minutes, une seule action pour jouer, et un seul
code pour le web et pour Android.

## L'identité

Un terminal à phosphore ambré. Trois règles, tenues partout :

1. **Tout est en gros pixels.** La toile fait exactement 360 × 640 pixels et
   c'est le navigateur qui l'agrandit sans lissage. Aucun coin arrondi, aucun
   dégradé, tout est aligné sur une grille de 2 px.
2. **Une seule couleur d'accent**, l'ambre, pour ce qui compte. Trois teintes
   secondaires servent uniquement à distinguer les jeux entre eux.
3. **Du monospace partout**, rastérisé petit puis agrandi — c'est de là que
   vient le grain du texte, sans embarquer de police bitmap.

Si tu ajoutes quelque chose et que ça jure, c'est presque toujours qu'une de
ces trois règles a sauté.

## Où ça tourne

| | comment | mise à jour |
|---|---|---|
| **Android** | vraie app, APK installable | Actions → *APK Android* → Run workflow |
| **iPhone / iPad** | web, « Ajouter à l'écran d'accueil » | Actions → *Web* → Run workflow |
| **PC** | navigateur | idem |

Les deux déploiements sont **manuels** : rien ne part en ligne sans qu'on le
demande. L'APK arrive dans les **Releases** du dépôt, en lien direct
téléchargeable depuis le téléphone.

Le natif iOS demanderait un Mac et l'Apple Developer Program à 99 $/an, donc
sur Apple c'est la version web — plein écran, hors-ligne, avec son icône. Pour
un jeu en Canvas, la différence ne se voit pas.

Sur un ordinateur, si tu en as un sous la main :

```bash
npm run dev      # assemble www/ et sert sur http://localhost:8000
```

## Les jeux

**AVENTURE** est le jeu central, en vedette sur l'accueil. Les dix-huit autres
sont des mini-jeux, en grille dessous.

*Adresse* — **ESQUIVE** survivre sous les blocs · **VOLTIGE** maintenir pour
monter dans un tunnel · **GRIMPE** rebondir de plateforme en plateforme ·
**SLALOM** zigzaguer entre les portes · **FUSÉE** se poser en douceur sur la
piste · **BRIQUES** casse-brique

*Réflexe* — **SERPENT** tourner à gauche ou à droite · **ORBITE** inverser son
sens de rotation · **BALANCE** redresser un mât qui penche · **PILE** empiler
sans dépasser · **CORDE** sauter quand la corde passe · **CIBLES** toucher
avant que le chrono se vide · **RYTHME** taper quand la note passe la ligne ·
**GARDIEN** plonger du bon côté

*Tête* — **TRI** envoyer chaque bloc dans son bac · **MÉMOIRE** refaire la
séquence · **COULEUR** l'encre, pas le mot · **CALCUL** vrai ou faux, vite

Tous se jouent d'une seule main, avec un seul geste.

## Ajouter un mini-jeu

Crée `src/games/monJeu.js` :

```js
import { C } from '../palette.js'
import { texte, rect, cadre, pastille, trame, dist, borne, vers } from '../dessin.js'

export default {
  id: 'mon-jeu',              // clé du record, ne le change plus après coup
  nom: 'MON JEU',
  pitch: 'Une ligne pour dire comment on joue',
  couleur: C.violet,          // la barre de couleur sur l'accueil
  unite: 'pts',

  init(j) { j.e.x = j.W / 2 },
  maj(j, dt) { j.score += dt },
  dessine(j, ctx) { rect(ctx, j.e.x, 300, 40, 40, C.cyan) },
  appui(j, p) {},
  relache(j, p) {},
}
```

Puis ajoute-le à `MINIS` dans `src/games/index.js`. C'est tout.

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
| `j.son` | les bruitages |
| `j.hasard()`, `j.entier(a, b)` | aléatoire |

### La boîte à dessin

`rect`, `cadre` (une boîte creuse), `pastille` (un disque en gros pixels),
`trame` (une grille de points), `texte`, plus `dist`, `borne`, `vers`. Aucune
ne prend de rayon d'arrondi : c'est volontaire.

## L'aventure

C'est le jeu central, et pour l'instant un squelette qui tourne : le
personnage court tout seul, l'appui le fait sauter, et les niveaux sont
écrits en texte.

Un niveau, dans `src/aventure/niveaux.js` :

```js
{
  nom: 'PREMIERS PAS',
  indice: 'appuie pour sauter',
  carte: [
    '....o..................o.................X..',
    '...####...............####..............####',
    '@...........................................',
    '#########...#########...##########..########',
  ],
}
```

`#` bloc · `^` pic · `o` pièce · `X` sortie · `@` départ · `.` vide

Les lignes n'ont pas besoin d'être de la même longueur ni de remplir la
hauteur : le chargeur complète à droite et ajoute le ciel au-dessus. On
n'écrit que ce qui compte.

**Repères pour concevoir :** le personnage saute environ 3 cases de long et
2 cases de haut. Un trou de 3 cases se franchit, un trou de 4 non.

La progression est retenue, et un niveau ne s'ouvre que si le précédent est
fait. Ce qu'il reste à faire : de vrais niveaux, un décor, et une raison
d'avancer.

## Le son

Tout est synthétisé dans `src/son.js` : aucun fichier audio, donc rien à
télécharger, et surtout la hauteur des notes se calcule. Le casse-brique monte
d'un demi-ton par rangée — vider une colonne fait une gamme — et les cibles
montent avec le combo, donc on *entend* qu'on enchaîne.

```js
j.son.rebond()        // impact court
j.son.casse(rang)     // note qui dépend de la rangée
j.son.ramasse()       // bonus attrapé
j.son.touche(combo)   // monte avec le combo
j.son.rate()          // raté
j.son.niveau()        // petite fanfare
```

Le moteur joue tout seul le clic des boutons, la mort et le record. Pour
inventer un bruitage : `_note({type, de, a, duree, volume})` pour une note
avec glissando, `_bruit({duree, coupe, type})` pour les impacts. Depuis la
console du navigateur, `son.casse(3)` les essaie un par un.

Le bouton ♪ de l'accueil coupe le son, et le choix est retenu. À savoir : sur
iPhone le son ne démarre qu'après un vrai appui (le moteur s'en charge), et
l'interrupteur latéral de silence coupe tout.

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
  dessin.js         la boîte à dessin, et le style pixel
  palette.js        les couleurs
  stockage.js       records, sourdine, progression — un seul préfixe
  son.js            les bruitages, synthétisés
  games/            les mini-jeux + le catalogue
  aventure/         le jeu principal et ses niveaux
.github/workflows/
  web.yml           déploie la version web, à la demande
  apk.yml           construit l'APK, à la demande
```

## Astuces

- `moteur` et `son` sont accessibles depuis la console du navigateur :
  `moteur.j` donne l'état du jeu en cours, en direct.
- La touche Échap met en pause.

## La suite

- de vrais niveaux d'aventure
- une interface pour publier des jeux sans passer par git
- des scores en ligne

Note pour plus tard : le code des jeux reste dans git — c'est lui qui donne
l'historique et le retour arrière gratuits. Un backend (Supabase ou autre) ne
servira que pour ce que des fichiers statiques ne savent pas faire : les
comptes, les classements, la modération.
