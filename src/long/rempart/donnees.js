import { C } from '../../palette.js'

/**
 * Les tables de REMPART. Rien ici ne bouge tout seul — c'est `logique.js` qui
 * fait avancer le temps, avec un hasard qui vient toujours du moteur.
 *
 * Deux monnaies, qui ne se mélangent jamais :
 *   - la FERRAILLE se gagne en tuant des ennemis PENDANT une défense, et
 *     retombe à zéro à la fin de celle-ci — c'est elle qui paie les tours ;
 *   - les ÉCLATS se gagnent une fois par vague survécue, restent acquis même
 *     si la défense finit par tomber, et ne se dépensent qu'ENTRE deux
 *     défenses, sur des déblocages et des améliorations permanentes.
 *
 * Le plateau de jeu (hors bandeau et hors panneau de droite) mesure 490×304 :
 * toutes les coordonnées de `chemin` et d'`emplacements` sont locales à ce
 * rectangle, jamais absolues à l'écran — c'est `dispo.js` qui les replace.
 */

export const PLATEAU_W = 490
export const PLATEAU_H = 304

export const VIE_BASE = 20
export const FERRAILLE_DEPART_BASE = 150

// Le temps avant qu'une vague parte toute seule si on ne la lance pas à la
// main. Assez long pour poser deux ou trois tours, jamais assez pour qu'on
// oublie qu'une défense est en cours.
export const PREP_TEMPS = 8

// Rayon de détection au tap, en pixels du plateau. Plus large que
// l'emplacement dessiné : viser un carré de 20 px au pouce est déjà difficile.
export const EMPLACEMENT_RAYON = 18

export const PROJECTILE_VITESSE = 320 // px/s

// Un ralentissement ne s'accumule jamais en dessous de ce plancher : sinon
// deux tours à givre superposées immobilisent un ennemi, ce qui n'est plus un
// ralentissement mais un mur invisible.
export const RALENTI_PLANCHER = 0.32
export const RALENTI_DUREE = 1.4

export const NIVEAU_MAX = 3

// Comme dans PICROSS : au-delà, un appui devient un maintien — on affiche les
// stats de la tour plutôt que de proposer de l'améliorer.
export const LONG_APPUI = 0.35

// L'écart entre deux apparitions dans une même vague, avant la gigue.
export const ESPACEMENT_SPAWN = 0.85

/**
 * Les ennemis. `armure` est une réduction FIXE, appliquée seulement aux
 * dégâts directs — les dégâts de zone l'ignorent entièrement. C'est ce qui
 * rend une tour à zone utile contre un BLINDÉ sans en faire la seule tour
 * qui compte : elle reste faible en dégâts bruts.
 */
export const ENNEMIS = {
  rampant: { id: 'rampant', nom: 'RAMPANT', vie: 16, vitesse: 46, degat: 1, recompense: 3, armure: 0, couleur: C.faible },
  coureur: { id: 'coureur', nom: 'COUREUR', vie: 9, vitesse: 96, degat: 1, recompense: 3, armure: 0, couleur: C.cyan },
  essaim: { id: 'essaim', nom: 'ESSAIM', vie: 5, vitesse: 62, degat: 1, recompense: 2, armure: 0, couleur: C.violet },
  blinde: { id: 'blinde', nom: 'BLINDÉ', vie: 70, vitesse: 30, degat: 3, recompense: 9, armure: 6, couleur: C.rouge },
}

/**
 * Les tours de base. `type: 'direct'` vise un seul ennemi ; `type: 'zone'`
 * explose à l'impact et touche tout ce qui est dans `rayon`, sans jamais
 * regarder l'armure. `ralenti` (0 à 1, appliqué comme facteur de vitesse) ne
 * concerne que les tours de zone — c'est la deuxième famille de comportement
 * que demande le cahier des charges, pas une case de plus sur les mêmes tours.
 *
 * `coutDeblocage` est en ÉCLATS, payé une fois pour toutes entre deux
 * défenses ; `cout` est en FERRAILLE, payé à chaque pose, pendant la défense.
 */
export const TOURS = [
  {
    id: 'sentinelle',
    nom: 'SENTINELLE',
    pitch: 'équilibrée, toujours disponible',
    cout: 40,
    portee: 92,
    cadence: 1.1,
    degat: 6,
    type: 'direct',
    rayon: 0,
    ralenti: 0,
    couleur: C.texte,
    coutDeblocage: 0,
  },
  {
    id: 'mitrailleuse',
    nom: 'MITRAILLEUSE',
    pitch: 'cadence élevée, dégâts faibles',
    cout: 70,
    portee: 82,
    cadence: 3.4,
    degat: 3,
    type: 'direct',
    rayon: 0,
    ralenti: 0,
    couleur: C.accent,
    coutDeblocage: 25,
  },
  {
    id: 'canon',
    nom: 'CANON',
    pitch: 'un coup lourd, perce l’armure',
    cout: 120,
    portee: 112,
    cadence: 0.55,
    degat: 24,
    type: 'direct',
    rayon: 0,
    ralenti: 0,
    couleur: C.rouge,
    coutDeblocage: 55,
  },
  {
    id: 'givre',
    nom: 'GIVRE',
    pitch: 'ralentit tout ce qui l’entoure',
    cout: 90,
    portee: 86,
    cadence: 1,
    degat: 2,
    type: 'zone',
    rayon: 46,
    ralenti: 0.5,
    couleur: C.cyan,
    coutDeblocage: 40,
  },
  {
    id: 'mortier',
    nom: 'MORTIER',
    pitch: 'explosion large, ignore l’armure',
    cout: 150,
    portee: 132,
    cadence: 0.48,
    degat: 15,
    type: 'zone',
    rayon: 52,
    ralenti: 0,
    couleur: C.violet,
    coutDeblocage: 85,
  },
]

/**
 * Les cartes. `difficulte` multiplie la vie des ennemis dès la première vague
 * (les cartes suivantes sont dures d'entrée, pas seulement plus longues), et
 * pèse un peu sur la récompense en éclats — voir `eclatsParVague`.
 */
export const CARTES = [
  {
    id: 'pont',
    nom: 'LE PONT',
    pitch: 'un seul virage, pour apprendre',
    difficulte: 1,
    couleur: C.vert,
    coutDeblocage: 0,
    chemin: [
      { x: 0, y: 50 },
      { x: 150, y: 50 },
      { x: 150, y: 170 },
      { x: 300, y: 170 },
      { x: 300, y: 60 },
      { x: 490, y: 60 },
    ],
    // C'est la carte d'apprentissage, ouverte d'office : chaque emplacement
    // doit rester à portée de la SENTINELLE (92 px), la seule tour débloquée
    // au tout premier lancement — sinon la moitié du plateau ne sert à rien
    // tant qu'on n'a pas économisé pour le CANON ou le MORTIER.
    emplacements: [
      { x: 50, y: 115 },
      { x: 110, y: 20 },
      { x: 95, y: 130 },
      { x: 215, y: 110 },
      { x: 230, y: 230 },
      { x: 355, y: 200 },
      { x: 355, y: 100 },
      { x: 445, y: 105 },
    ],
  },
  {
    id: 'fourche',
    nom: 'LA FOURCHE',
    pitch: 'deux montées, deux descentes',
    difficulte: 1.35,
    couleur: C.cyan,
    coutDeblocage: 20,
    chemin: [
      { x: 0, y: 270 },
      { x: 100, y: 270 },
      { x: 100, y: 120 },
      { x: 230, y: 120 },
      { x: 230, y: 270 },
      { x: 360, y: 270 },
      { x: 360, y: 60 },
      { x: 490, y: 60 },
    ],
    emplacements: [
      { x: 50, y: 190 },
      { x: 160, y: 60 },
      { x: 160, y: 200 },
      { x: 290, y: 190 },
      { x: 290, y: 60 },
      { x: 420, y: 190 },
      { x: 420, y: 280 },
      { x: 40, y: 60 },
      { x: 300, y: 300 },
    ],
  },
  {
    id: 'gorge',
    nom: 'LA GORGE',
    pitch: 'un serpent de virages serrés',
    difficulte: 1.8,
    couleur: C.violet,
    coutDeblocage: 50,
    chemin: [
      { x: 0, y: 30 },
      { x: 80, y: 30 },
      { x: 80, y: 150 },
      { x: 180, y: 150 },
      { x: 180, y: 30 },
      { x: 280, y: 30 },
      { x: 280, y: 270 },
      { x: 380, y: 270 },
      { x: 380, y: 150 },
      { x: 490, y: 150 },
    ],
    emplacements: [
      { x: 30, y: 90 },
      { x: 130, y: 90 },
      { x: 130, y: 220 },
      { x: 230, y: 90 },
      { x: 230, y: 200 },
      { x: 330, y: 90 },
      { x: 330, y: 210 },
      { x: 430, y: 90 },
      { x: 430, y: 220 },
      { x: 230, y: 270 },
    ],
  },
  {
    id: 'dernier-mur',
    nom: 'LE DERNIER MUR',
    pitch: 'quatre allers-retours, pour finir',
    difficulte: 2.4,
    couleur: C.rouge,
    coutDeblocage: 100,
    chemin: [
      { x: 0, y: 270 },
      { x: 60, y: 270 },
      { x: 60, y: 40 },
      { x: 160, y: 40 },
      { x: 160, y: 270 },
      { x: 260, y: 270 },
      { x: 260, y: 40 },
      { x: 360, y: 40 },
      { x: 360, y: 270 },
      { x: 440, y: 270 },
      { x: 440, y: 150 },
      { x: 490, y: 150 },
    ],
    emplacements: [
      { x: 20, y: 150 },
      { x: 110, y: 150 },
      { x: 210, y: 150 },
      { x: 310, y: 150 },
      { x: 400, y: 60 },
      { x: 20, y: 40 },
      { x: 210, y: 40 },
      { x: 400, y: 220 },
      { x: 310, y: 270 },
      { x: 465, y: 90 },
    ],
  },
]

/**
 * Les améliorations méta, permanentes, achetées entre deux défenses. Les
 * pistes en pourcentage (`degats`/`portee`/`cadence`/`gain`) se lisent comme
 * un multiplicateur (`effet` par niveau) ; `vie` et `ferraille` sont des bonus
 * plats. `couts[k]` est le prix du niveau `k + 1`.
 */
export const AMELIORATIONS_META = [
  { id: 'degats', nom: 'FORGE', pct: true, effet: 0.14, description: '+14 % de dégâts, toutes tours', couts: [35, 75, 130, 205, 315] },
  { id: 'portee', nom: 'LUNETTES', pct: true, effet: 0.08, description: '+8 % de portée, toutes tours', couts: [28, 60, 105, 175, 270] },
  { id: 'cadence', nom: 'HUILE', pct: true, effet: 0.11, description: '+11 % de cadence, toutes tours', couts: [35, 75, 130, 205, 315] },
  { id: 'vie', nom: 'MAÇONNERIE', pct: false, effet: 6, description: '+6 points de vie du rempart', couts: [25, 55, 95, 150, 230] },
  { id: 'ferraille', nom: 'RÉSERVES', pct: false, effet: 50, description: '+50 ferraille au départ', couts: [20, 48, 88, 143] },
  { id: 'gain', nom: 'RÉCUPÉRATION', pct: true, effet: 0.14, description: '+14 % de ferraille par ennemi tué', couts: [42, 96, 178, 288] },
]
