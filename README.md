# ARKAD

Une borne d'arcade rangée par durée de partie : vingt-cinq jeux, de trois
minutes à sans fin. Une seule action pour jouer, et un seul code pour le web
et pour Android.

## L'identité

Un terminal à phosphore ambré. Trois règles, tenues partout :

1. **Les formes sont en gros pixels.** Tout est aligné sur une grille de
   2 px, aucun coin arrondi, aucun dégradé, les disques sont des empilements
   de rectangles.
2. **Le texte, lui, est net.** On a essayé de le rastériser petit puis de
   l'agrandir pour lui donner du grain : joli en grand, illisible en petit.
   Le style vient des formes, pas de la typo — mais le monospace reste.
3. **Une seule couleur d'accent**, l'ambre, pour ce qui compte. Trois teintes
   secondaires servent uniquement à distinguer les jeux entre eux.

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

Ils sont rangés par **durée de partie**, et c'est la seule hiérarchie du
projet. Un dossier par catégorie, sous `src/`.

### COURT — 2 à 3 minutes (18 jeux)

*Adresse* — **ESQUIVE** survivre sous les blocs · **VOLTIGE** monter dans un
tunnel · **GRIMPE** rebondir de plateforme en plateforme · **SLALOM** zigzaguer
entre les portes · **FUSÉE** se poser en douceur · **BRIQUES** casse-brique

*Réflexe* — **SERPENT** · **ORBITE** inverser son sens · **BALANCE** redresser
un mât · **PILE** empiler sans dépasser · **CORDE** sauter au bon moment ·
**CIBLES** · **RYTHME** · **GARDIEN** plonger du bon côté

*Tête* — **TRI** · **MÉMOIRE** · **COULEUR** l'encre, pas le mot · **CALCUL**

Un décompte de trois temps précède chaque partie : ces jeux démarrent à pleine
vitesse, sans lui on perd la première seconde à comprendre où on est.

### MOYEN — 5 à 15 minutes (3 jeux)

**DÉMINEUR** appui court pour creuser, appui long pour marquer · **2048** on
glisse pour tout pousser · **TAQUIN** remettre les nombres dans l'ordre

Une grille, une solution, on y réfléchit. Rien ne se sauvegarde : une partie
se termine dans la séance.

### LONG — 20 minutes à 10 heures (3 jeux)

**DONJON** un roguelike au tour par tour, on descend et on frappe en avançant
dessus · **USINE** un incrémental qui produit même fermé · **EXPÉDITION** neuf
cents kilomètres, un choix par jour

Ces trois-là **écrivent leur état à chaque tour**. On ferme l'application au
milieu d'un couloir, on la rouvre trois jours plus tard au même endroit.

### MASSIF — sans fin (1 jeu)

**ASCENSION** — une échelle de rangs sans plafond contre une IA qui compte ce
que tu joues et te contre d'autant mieux que tu montes. Les améliorations sont
permanentes, une défaite ne coûte qu'un rang. C'est la catégorie qui n'a pas
vocation à se terminer.

## Ajouter un mini-jeu

Crée `src/court/monJeu.js` (ou le dossier qui correspond à sa durée) :

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

Range-le dans le dossier de sa durée (`src/court/`, `src/moyen/`, `src/long/`,
`src/massif/`) et ajoute-le à sa catégorie dans `src/catalogue.js`. C'est tout.

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
| `j.fx` | les effets : gerbes, bulles de score, secousse |
| `j.hasard()`, `j.entier(a, b)` | aléatoire |
| `j.sauve(o)`, `j.charge()`, `j.efface()` | l'état d'une partie longue |

Un jeu peut aussi déclarer `persistant: true` (il gère sa propre sauvegarde),
`sansScore: true` avec `titreHud(j)` (le bandeau affiche autre chose qu'un
score), et `finTitre(j)` pour choisir le titre de l'écran de fin — « RÉSOLU »
n'est pas « GAME OVER ».

### La boîte à dessin

`rect`, `cadre` (une boîte creuse), `pastille` (un disque en gros pixels),
`trame` (une grille de points), `texte`, plus `dist`, `borne`, `vers`. Aucune
ne prend de rayon d'arrondi : c'est volontaire.

## Les effets

C'est ce qui sépare un jeu qui marche d'un jeu qui fait plaisir. Trois appels,
depuis n'importe quel jeu :

```js
j.fx.eclat(x, y, couleur, { n: 12, vitesse: 160 })   // une gerbe de grains
j.fx.bulle(x, y, '+40', C.accent)                    // un nombre qui monte
j.fx.secoue(8)                                       // une secousse d'écran
j.fx.jet(x, y, couleur, { angle, n: 3 })             // un jet dirigé
```

Le moteur dessine tout par-dessus le jeu, dans son repère, et secoue l'image
sans jamais bouger le bandeau du haut. Il ajoute lui-même la gerbe et la
secousse au moment de la mort.

**Attention aux jeux qui ont une caméra** (GRIMPE, DONJON) : les grains
vivent dans le repère de l'écran, il faut donc leur passer des coordonnées
déjà décalées.

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

1. **Une seule action.** Appuyer, ou glisser. C'est ce qui rend PC et mobile
   identiques, et ça oblige à trouver des idées plutôt qu'à empiler des boutons.
2. **Un jeu annonce sa durée, et la tient.** C'est le rangement du projet :
   trois minutes, un quart d'heure, une soirée, ou jamais.
3. **Zéro texte d'explication en jeu.** Si le pitch d'une ligne ne suffit pas,
   le jeu est trop compliqué.
4. **Ce qui dure plus d'une séance s'écrit à chaque tour.** Personne ne
   rejouera dix heures parce qu'on a fermé l'onglet.

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
  effets.js         gerbes, bulles de score, secousse d'écran
  catalogue.js      les quatre catégories, et rien d'autre à toucher
  court/  moyen/  long/  massif/     les jeux, rangés par durée
.github/workflows/
  web.yml           déploie la version web, à la demande
  apk.yml           construit l'APK, à la demande
```

## Astuces

- `moteur` et `son` sont accessibles depuis la console du navigateur :
  `moteur.j` donne l'état du jeu en cours, en direct.
- La touche Échap met en pause.

## La suite

- d'autres jeux massifs — la catégorie n'en a qu'un
- une interface pour publier des jeux sans passer par git
- des scores en ligne

Note pour plus tard : le code des jeux reste dans git — c'est lui qui donne
l'historique et le retour arrière gratuits. Un backend (Supabase ou autre) ne
servira que pour ce que des fichiers statiques ne savent pas faire : les
comptes, les classements, la modération.
