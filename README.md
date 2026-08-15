# ARKAD

Une borne d'arcade rangée par durée de partie : vingt-six jeux, de trois
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
tunnel (mieux couché) · **GRIMPE** rebondir de plateforme en plateforme ·
**SLALOM** zigzaguer entre les portes · **FUSÉE** se poser en douceur ·
**BRIQUES** casse-brique

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
Couché, la grille passe de 9×12 à 16×7 — et les mines sont posées à *densité*
égale, pas en nombre égal, sinon le format changerait la difficulté.

**2048** — on glisse pour tout pousser · **TAQUIN** — remettre les nombres dans
l'ordre, mélangé par coups légaux donc toujours résoluble.

Une grille, une solution, on y réfléchit. Rien ne se sauvegarde : une partie
se termine dans la séance.

### LONG — 20 minutes à 10 heures (4 jeux)

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

**BRÈCHE** — trois pièces en main, une grille à remplir, des lignes qui
partent. Pas de rotation : ce qu'on tire est ce qu'on pose, et toute la
difficulté est de garder de la place pour trois pièces qu'on ne connaît pas
encore. La partie s'arrête quand aucune des trois n'entre plus nulle part.

**Dix mondes**, et chacun change une règle plutôt qu'un décor : la grille
passe de 8×8 à 10×10, des roches indestructibles apparaissent, le fond monte
d'une rangée quand on tarde, le gel fige les cases qu'on vient de libérer, un
bassin de pièces différent se substitue au tirage normal. On les traverse en
boucle, l'objectif de points étant multiplié par 1,55 à chaque tour complet —
donc il n'y a pas de dernier monde, seulement un dernier essai.

**Six transformations** tombent sur les pièces : le souffle vide les cases
autour, le rayon nettoie une ligne entière, la teinte change la couleur d'une
zone, la prime double les points, le dur pose une case qui résiste à un
effacement. Plus deux outils qu'on économise, MARTEAU et ÉCHANGE.

Ces quatre-là **écrivent leur état à chaque tour**. On ferme l'application au
milieu d'un couloir, on la rouvre trois jours plus tard au même endroit.

`node test/breche-banc.mjs 200` fait jouer un automate et imprime, monde par
monde, la part de parties qui franchissent l'objectif.

### MASSIF — sans fin (1 jeu)

**FRONT** — un jeu de stratégie militaire au tour par tour sur **grille
hexagonale**. On lève une compagnie, on l'emmène d'engagement en engagement, et
on la garde : les troupes sont persistantes. Le milicien du premier combat peut
finir lieutenant vingt batailles plus tard, avec ses cicatrices et son nom.

**Le terrain décide.** Vingt-deux terrains, et chacun n'est qu'un petit paquet
de nombres lus à trois endroits : coût de déplacement, couvert, opacité,
hauteur — plus la portée de vue, la portée de tir, le soin, la furtivité. Une
forêt coupe la vue *et* cache qui s'y tient ; on ne l'y voit qu'à un pas. Une
colline voit par-dessus les bois et frappe de haut. Une rivière coûte trois
points de mouvement à qui n'est pas pontonnier. Dix biomes composent les
champs de bataille, rivières et routes comprises.

**Deux recrutements, et ils ne se ressemblent pas.** La **CASERNE** vend du
générique — trente-cinq classes réparties en six types, avec une table
d'efficacité franche : la cavalerie fait ×1,5 sur les tireurs et ×0,7 sur les
piques. L'**ÉTAT-MAJOR** fait passer des gens qui ont un nom : quarante-deux
uniques avec leur titre, leur phrase, leur grade et leur aptitude signée, tirés
selon un **taux d'apparition indexé sur le niveau** — affiché sur la fiche,
parce que c'est une information de jeu et pas un secret de conception. Le prix
de recrutement suit le même niveau, dans les deux boutiques.

**Des grades qui commandent.** Six grades, du soldat au commandant. Un gradé
porte une aura qui déborde sur ses voisins, et elle ne s'empile pas : deux
sergents côte à côte ne valent pas un commandant. Abattre l'officier d'en face
casse le moral de tout ce qu'il commandait — c'est une manœuvre, pas un dégât
de plus. Les escouades décident qui monte au front, et leur chef tient les
siens avant même le premier coup.

**Ça grandit.** Du niveau 1 au niveau 20 : 9×7 → 19×15 hexagones, 3 → 12
troupes par camp, 7 → 17 tours par bataille, un objectif → cinq (anéantir,
tenir des points, décapiter, percer, tenir le choc). L'armée adverse n'est pas
posée sur une courbe : elle est **bâtie sur un budget calé sur ce qu'on aligne
vraiment**, ce qui évite de punir deux fois celui qui vient de perdre ses
vétérans.

**Ce qu'on risque.** Une défaite coûte les tombés — définitivement, pour le
générique. Une victoire les ramasse, mal en point. C'est pour ça qu'il existe
un bouton **ROMPRE** : renoncer à la prime pour ramener ceux qui tiennent
encore est une décision, et c'est elle qui rend la persistance supportable.

**Aucun aléatoire dans la résolution.** Les dégâts qu'annonce la prévision sont
exactement ceux qui tombent, riposte comprise, avec le détail du calcul —
AVANTAGE +35 %, HAUTEUR +15 %, PRIS À REVERS +24 %, COUVERT −35 %. Sur un
téléphone, un coup dont on ne sait pas ce qu'il va faire n'est pas une
décision. Le hasard vit dans la génération du terrain, de l'armée adverse et
des offres de recrutement — jamais dans le résultat d'un coup.

**L'ergonomie**, qui est ce qui a fait abandonner le jeu massif précédent :
on fait glisser la carte au doigt, et au-delà de dix pixels ce n'est plus un
appui mais un déplacement de caméra ; la caméra suit toute seule la troupe
qu'on choisit et la troupe adverse qui joue ; le panneau du bas ne montre
jamais que ce qui est jouable tout de suite ; et le tour se passe depuis
n'importe quel état, sans avoir à lâcher la troupe en main.

Trente-cinq classes, quarante-deux uniques, cinquante et une aptitudes toutes
pilotées par la donnée, vingt-deux terrains, dix biomes, cinq objectifs.

`node test/front-banc.mjs` joue des campagnes entières sans rendu et imprime la
durée des batailles par niveau, le taux de victoire par objectif, ce que
rapporte chaque classe, et la matrice des duels entre types.

## Debout ou couché

La borne connaît **deux formats logiques**, et deux seulement : **360 × 640**
debout, **640 × 360** couché. Pas de mise à l'échelle continue, pas de
disposition fluide — deux formats qu'on peut dessiner et tester exactement,
plutôt qu'une infinité qu'on ne vérifie jamais.

Un jeu déclare ce qu'il sait faire :

```js
paysage: true          // il accepte d'être couché
confort: 'paysage'     // et il y est mieux : le moteur proposera de tourner
redim(j) { … }         // appelé quand le format change en cours de partie
```

Sans `paysage`, un jeu reste debout même sur un écran couché, et le moteur
propose de remettre le téléphone dans l'autre sens. Avec `confort`, c'est
l'inverse : le jeu marche debout mais respire couché, et l'écran de
suggestion le dit — avec un **NE PLUS PROPOSER** qui se retient, parce qu'une
suggestion qu'on ne peut pas faire taire est une nuisance.

Aujourd'hui : VOLTIGE, DÉMINEUR, USINE et BRÈCHE sont mieux couchés ;
SERPENT sait l'être sans y gagner, donc il ne le propose pas. Les autres
restent debout — un jeu de chute ou d'empilement n'a rien à faire dans un
écran large.

Ce que ça demande à un jeu : ne jamais écrire 360 ni 640 en dur. `j.W` et
`j.H` sont des **getters** sur le moteur, ils changent, et tout ce qui se
dessine doit s'y indexer. La règle qui compte le plus : **le dessin et la
zone tactile lisent la même fonction de disposition.** Deux calculs
parallèles finissent toujours par diverger de quelques pixels, et un bouton
qui n'est pas là où on le voit est le défaut qui a fait abandonner un jeu
entier dans ce projet.

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
| `j.W`, `j.H` | l'écran logique — 360 × 640 debout, 640 × 360 couché |
| `j.paysage` | vrai quand le jeu est couché |
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
| `j.musique(id)` | change de bande-son en cours de partie |
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

**Attention aux jeux qui ont une caméra** (GRIMPE) : les grains vivent dans
le repère de l'écran, il faut donc leur passer des coordonnées déjà
décalées.

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

Le bouton de l'accueil a **trois positions** — ♪ tout, · les bruitages seuls,
× le silence — et le choix est retenu. Les bruitages sans la musique sont le
réglage le plus utile en pratique : dans le métro, ou à côté de quelqu'un. À
savoir : sur iPhone le son ne démarre qu'après un vrai appui (le moteur s'en
charge), et l'interrupteur latéral de silence coupe tout.

## Les bandes-son

**Soixante-quinze morceaux, et pas un seul fichier audio.** Cinquante pour
BRÈCHE — cinq par monde, on les entend au fil des cycles — et un par jeu pour
le reste de la borne.

Un morceau enregistré pèse deux mégaoctets. Cinquante en pèsent cent, dans
une application qui en fait moins d'un et qui doit tourner hors-ligne. Donc
on ne les enregistre pas : on les **écrit**, en huit champs.

```js
t('crue2', 'L’EAU MONTE', 138, 'phrygien', 3, 'course', 0x607182)
//  id      nom            bpm  gamme       tonique  ambiance  graine
```

`musique/composition.js` en déduit seize mesures — quatre parties en A A' B A'',
avec basse, nappe, accords, arpège, chant et trois percussions. La gamme donne
la couleur, la marche d'accords donne le caractère, l'ambiance décide **qui
joue et à quelle densité** (une veillée et une poursuite peuvent partager la
même marche d'accords), et la graine fait tout le reste. Deux lignes qui ne
diffèrent que par leur graine donnent deux morceaux qui n'ont rien à voir.

`compose()` est une **fonction pure** : elle ne fait aucun son, elle rend une
liste d'évènements. C'est ce qui permet de vérifier sous `node --test`
qu'aucune des soixante-quinze bandes n'est muette, qu'aucune note ne sort de
sa gamme, et qu'il n'y en a pas deux identiques — sans jamais ouvrir un
navigateur ni tendre l'oreille. `musique/joueur.js` se contente de programmer
ces évènements dans le contexte audio, avec une horloge d'avance de 220 ms :
on ne déclenche jamais une note « maintenant », parce qu'un fil principal qui
dessine soixante images par seconde ne tient pas le tempo, et la carte son
si.

Le moteur lance la bande du jeu au démarrage ; un jeu à paliers appelle
`j.musique('crue2')` pour en changer. BRÈCHE le fait à chaque monde.

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
  format.js         les deux formats, et quand proposer de tourner l'écran
  input.js          souris / doigt / espace -> appui + relâche
  dessin.js         la boîte à dessin, et le style pixel
  palette.js        les couleurs
  hasard.js         un générateur à graine, partagé
  stockage.js       records, sourdine, progression — un seul préfixe
  son.js            les bruitages, synthétisés
  musique.js        la façade des bandes-son
  musique/
    table.js        les 75 fiches, huit champs chacune
    composition.js  fiche -> partition. Pure, donc testable sans navigateur
    joueur.js       partition -> contexte audio, avec horloge d'avance
  effets.js         gerbes, bulles de score, secousse d'écran
  catalogue.js      les quatre catégories, et rien d'autre à toucher
  court/  moyen/  long/  massif/     les jeux, rangés par durée
test/
  faux.js           un canvas qui enregistre, un moteur qui ne dessine pas
  *.test.js         `npm test` — aucune dépendance, `node --test` suffit
  usine-banc.mjs    dix heures d'USINE en une seconde
  front-banc.mjs    des campagnes entières sans rendu
  breche-banc.mjs   un automate qui joue BRÈCHE, monde par monde
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
règle. Ceux de FRONT vérifient chaque dégât à l'unité près et vérifient sur
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
- des bandes-son pour les pays d'EXPÉDITION, sur le modèle des cinquante de
  BRÈCHE
- FRONT : des sièges et des objectifs à plusieurs étapes, et une campagne
  qui se souvient des compagnies adverses qu'on a croisées
- une interface pour publier des jeux sans passer par git
- des scores en ligne

Note pour plus tard : le code des jeux reste dans git — c'est lui qui donne
l'historique et le retour arrière gratuits. Un backend (Supabase ou autre) ne
servira que pour ce que des fichiers statiques ne savent pas faire : les
comptes, les classements, la modération.
