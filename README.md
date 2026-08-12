# ARKAD

Une borne d'arcade rangée par durée de partie : vingt-cinq jeux, de trois
minutes à sans fin. Une seule action pour jouer, et un seul code pour le web
et pour Android.

## L'identité

Un terminal à phosphore ambré. Trois règles, tenues partout :

1. **Les formes sont en gros pixels, mais elles ont un corps.** Tout est
   aligné sur une grille de 2 px, aucun coin arrondi, aucun dégradé — et
   chaque objet a une arête claire en haut, une arête sombre en bas. C'est la
   différence entre un carré de couleur et une chose posée quelque part.
2. **Le texte, lui, est net.** On a essayé de le rastériser petit puis de
   l'agrandir pour lui donner du grain : joli en grand, illisible en petit.
   Le style vient des formes, pas de la typo — mais le monospace reste.
3. **Une seule couleur d'accent**, l'ambre, pour ce qui compte. Trois teintes
   secondaires servent uniquement à distinguer les jeux entre eux.
4. **Ce qui est vif est allumé.** Un halo déborde derrière les objets
   lumineux : sur un tube à phosphore la lumière bave, et c'est ce
   débordement qui distingue une couleur allumée d'une couleur peinte.
5. **Les dégradés se font au tramage.** Aucune interpolation de couleur : une
   matrice de Bayer fait décroître la densité de pixels, comme quand une
   machine ne savait afficher que seize couleurs. Un jeu déclare `ciel:`
   et reçoit son atmosphère.
6. **Rien n'apparaît, tout arrive.** Une tuile glisse, une case s'ouvre en
   vague, un bloc s'écrase en se posant. Un changement d'état instantané se
   lit mal et se ressent encore moins.

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
un mât · **PILE** empiler sans dépasser · **CORDE** sauter quand le sol s’allume ·
**CIBLES** · **RYTHME** · **GARDIEN** plonger du bon côté

*Tête* — **TRI** · **MÉMOIRE** · **COULEUR** l'encre, pas le mot · **CALCUL**

Un décompte de trois temps précède chaque partie, et un palier s'affiche
toutes les trente secondes.

**Onze de ces jeux ont trois vies.** Une mort remet le jeu en place, garde le
score et repart : c'est ce qui fait passer une partie de quarante secondes à
deux ou trois minutes sans toucher à la difficulté. Les jeux qui avaient déjà
leurs propres vies (BRIQUES, RYTHME, GARDIEN, TRI, COULEUR, CALCUL) n'en
reçoivent pas.

Un jeu déclare `vies: 3` et, s'il a besoin d'une reprise particulière,
`reprend(j)` — MÉMOIRE conserve sa séquence, FUSÉE garde la largeur de sa
piste. Sans ça, une faute au dixième coup effacerait deux minutes de
mémorisation.

### MOYEN — 5 à 15 minutes (3 jeux)

**DÉMINEUR** — appui court pour creuser, appui long pour marquer. Ce n'est pas
une grille mais une **série** : chaque grille déminée en amène une plus lourde,
trois mines de plus à chaque fois, et la partie ne s'arrête que sur une erreur.

**2048** — on glisse pour tout pousser · **TAQUIN** — remettre les nombres dans
l'ordre, mélangé par coups légaux donc toujours résoluble.

Une grille, une solution, on y réfléchit. Rien ne se sauvegarde : une partie
se termine dans la séance.

### LONG — 20 minutes à 10 heures (3 jeux)

**DONJON** — roguelike au tour par tour. Huit bêtes qui n'ont pas la même
façon d'être pénibles : l'archer tire dans les lignes dégagées, donc les
couloirs cessent d'être des refuges ; le spectre traverse les murs ; le golem
ne bouge qu'un tour sur deux mais encaisse tout. Épées, plaques, fioles,
parchemins, or, et un gardien tous les cinq étages.

**USINE** — incrémental, et un atelier qui tourne vraiment. La moitié haute de
l'écran est une scène : un front de taille qu'on frappe pour creuser, deux
étages de machines qui battent et soufflent à la cadence de leur ligne, des
ouvriers qui font la navette, un convoyeur qui se remplit à mesure, un ciel
qui bascule du jour à la nuit. Dix machines, trente améliorations, vingt
recherches — la seule dépense en temps réel, et la seule chose qui survit à
une refonte —, des pannes qu'on répare en tapant la machine, des contrats à
livrer avant l'heure, et des ouvriers à embaucher dont dépend le rendement.
La courbe se vérifie au banc : `node test/usine-banc.mjs 10` joue dix heures
en une seconde et imprime quand chaque contenu tombe.

**EXPÉDITION** — 900 km à travers quatre pays, chacun avec ses propres
journées. Trois objets se trouvent en route et ouvrent des options qui
n'existent pas sans eux. Et quand une jauge tombe bas, ce ne sont plus les
journées ordinaires qui sortent, mais les urgences.

Ces trois-là **écrivent leur état à chaque tour**. On ferme l'application au
milieu d'un couloir, on la rouvre trois jours plus tard au même endroit.

### MASSIF — sans fin (1 jeu)

**ANOMALIE** — un RPG tactique au tour par tour. Trois opérateurs plongent
dans un système corrompu ; les ennemis sont des processus, les boss des
noyaux, les compétences des exploits.

**Aucun aléatoire dans la résolution** : les dégâts sont exactement
prévisibles. Le hasard vit dans la génération — quels nœuds, quelles offres,
quels processus — et dans les choix pondérés de l'adversaire, jamais dans le
résultat d'un coup. C'est ce qui rend le combat lisible sur 360 px, et
surtout vérifiable à l'unité près par un test.

La file d'initiative se calcule à l'avance et s'affiche sur sept coups ; les
processus annoncent leur intention en y entrant. Les **cycles sont partagés
par l'équipe** — un tour bon marché en finance un cher, trois classes
gourmandes s'étouffent. Le **traçage** monte quand on joue, son plancher monte
avec la durée du combat, et à cent le système frappe en ignorant tout : rester
est impossible, et aucune stratégie ne gagne en durant.

Cinq actes à cartes ramifiées, chacun avec son bassin de processus et son
noyau. Le dernier change deux fois de peau : ce qui l'a entamé ne l'entame
plus. Le purger ouvre le mode **INFINI**, où la pression monte sans fin et où
l'on choisit tous les trois actes *comment* ça devient dur, un fardeau parmi
trois.

On peut aussi **plonger seul**. Ce n'est pas une difficulté de plus mais un
autre jeu : la classe prise décide de toute la partie, personne ne couvre ni ne
répare, et huit emplacements se remplissent d'une seule main. La correction qui
compte est structurelle — face à deux processus, un opérateur seul joue une
action quand l'adversaire en joue deux, alors il agit presque deux fois plus
vite et reçoit trois fois plus de cycles par tour. Aucune quantité d'intégrité
ne rattrape un rapport d'actions.

Huit classes, cinquante-quatre compétences, vingt-sept processus, cinq noyaux,
trente-neuf modules, onze fardeaux.

Ce qui empêche une combinaison de tout casser, et qui manquait au jeu
précédent : six emplacements de compétence dont deux verrouillés avec **rejet
forcé** au-delà, trois emplacements de module, quatre **paires antagonistes**
qui s'excluent pour la partie entière, un **surcoût d'axe** écrit en clair sur
l'écran ÉQUIPE, un plafond sur chaque état, et des multiplicateurs à rendement
décroissant — trois bonus de +30 % donnent ×1.64, pas ×2.20. Une défaite
termine la partie : sans prix à l'échec, la progression n'en a aucun.

`node test/anomalie-banc.mjs` joue des milliers de combats sans rendu et
imprime qui gagne, contre quoi, en combien de tours et à quel prix.

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
| `j.perdu()` | termine la partie — ou consomme une vie s'il en reste |
| `j.vies` | vies restantes |
| `j.pointer` | position du dernier appui (suit la souris sur PC) |
| `j.maintenu` | vrai tant que c'est appuyé |
| `j.son` | les bruitages |
| `j.fx` | les effets : gerbes, bulles de score, secousse |
| `j.hasard()`, `j.entier(a, b)` | aléatoire |
| `j.sauve(o)`, `j.charge()`, `j.efface()` | l'état d'une partie longue |

Un jeu peut aussi déclarer `ciel: C.violet` (un ciel tramé derrière lui),
`vies: 3` (avec `reprend(j)` si la reprise doit
préserver quelque chose), `persistant: true` (il gère sa propre sauvegarde),
`sansScore: true` avec `titreHud(j)` (le bandeau affiche autre chose qu'un
score), et `finTitre(j)` pour choisir le titre de l'écran de fin — « RÉSOLU »
n'est pas « GAME OVER ».

### La boîte à dessin

`rect`, `bloc` (un rectangle avec son relief), `cadre` (une boîte creuse),
`pastille` (un disque en gros pixels), `lueur` (un halo), `ombre` (une ombre
portée), `bandeTramee` (un dégradé au tramage de Bayer, rendu une fois puis
recopié), `trame` (une grille de points), `vignette`, `texte`, plus `dist`,
`borne`, `vers`. Et `ton(couleur, k)` dans la palette, pour éclaircir ou
assombrir sans inventer de nouvelle teinte.

Aucune ne prend de rayon d'arrondi : c'est volontaire. En règle générale, un
objet de jeu se dessine avec `bloc`, et ce qui doit attirer l'œil reçoit en
plus un `lueur` juste avant.

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
test/
  faux.js           un canvas qui enregistre, un moteur qui ne dessine pas
  *.test.js         `npm test` — aucune dépendance, `node --test` suffit
  usine-banc.mjs    dix heures d'USINE en une seconde
  anomalie-banc.mjs des milliers de combats sans rendu
.github/workflows/
  test.yml          le banc d'essai, à chaque poussée
  web.yml           déploie la version web, à la demande
  apk.yml           construit l'APK, à la demande
```

## Les tests

`npm test` — sans navigateur et sans une seule dépendance. Un faux contexte 2D
enregistre les rectangles et les textes au lieu de peindre, un faux contexte de
partie remplace le moteur, et toute la règle des jeux profonds vit dans des
fichiers qui n'importent ni canvas ni stockage.

Ce ne sont pas des tests de politesse. Ceux de CORDE **ne lisent pas l'état du
jeu** pour décider quand appuyer : ils lisent ce qui est dessiné, comme le
ferait un joueur — la seule façon d'attraper un mensonge entre l'image et la
règle. Ceux d'ANOMALIE vérifient chaque dégât à l'unité près et vérifient sur
des centaines de graines qu'aucune carte n'enferme le joueur. Ils ont trouvé,
entre autres, un pare-feu plein qui laissait passer un point, un type de dégât
entier inoffensif contre le joueur, un tirage au hasard écrit à l'intérieur
d'un `.find()`, et trois combats qui ne se terminaient jamais.

## Astuces

- `moteur` et `son` sont accessibles depuis la console du navigateur :
  `moteur.j` donne l'état du jeu en cours, en direct.
- La touche Échap met en pause.

## La suite

- d'autres jeux massifs — la catégorie n'en a qu'un
- ANOMALIE : trois classes de plus, et des déblocages entre parties qui
  ajoutent de la variété sans jamais ajouter de puissance
- une interface pour publier des jeux sans passer par git
- des scores en ligne

Note pour plus tard : le code des jeux reste dans git — c'est lui qui donne
l'historique et le retour arrière gratuits. Un backend (Supabase ou autre) ne
servira que pour ce que des fichiers statiques ne savent pas faire : les
comptes, les classements, la modération.
