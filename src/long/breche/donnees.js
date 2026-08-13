/**
 * Les tables de BRÈCHE : les pièces, les mondes, les transformations.
 *
 * Tout est de la donnée. Une règle de monde est une clé prise dans `REGLES`,
 * lue à **un seul endroit** de `logique.js` ; une transformation est une clé
 * prise dans `EFFETS`, appliquée par un unique résolveur. Un test refuse toute
 * clé qui n'est lue nulle part — c'est ce qui empêche un monde décoratif.
 */
import { C } from '../../palette.js'

/** Les cinq teintes de bloc. L'ambre reste pour ce qui compte : le score. */
export const TEINTES = [C.cyan, C.vert, C.violet, C.rouge, C.accent]

// --- Les pièces ----------------------------------------------------------------
//
// Une pièce est une liste de cases relatives. Aucune ne tourne : c'est la règle
// du genre, et c'est elle qui rend le placement réfléchi plutôt que bricolé —
// on ne rattrape pas une mauvaise idée en faisant pivoter.

const p = (id, nom, cases, poids, famille) => ({ id, nom, cases, poids, famille })

export const PIECES = [
  // --- Points et barres --------------------------------------------------------
  p('unite', 'UNITÉ', [[0, 0]], 5, 'petit'),
  p(
    'duo_h',
    'DUO',
    [
      [0, 0],
      [1, 0],
    ],
    8,
    'petit',
  ),
  p(
    'duo_v',
    'DUO DEBOUT',
    [
      [0, 0],
      [0, 1],
    ],
    8,
    'petit',
  ),
  p(
    'trio_h',
    'TRIO',
    [
      [0, 0],
      [1, 0],
      [2, 0],
    ],
    9,
    'petit',
  ),
  p(
    'trio_v',
    'TRIO DEBOUT',
    [
      [0, 0],
      [0, 1],
      [0, 2],
    ],
    9,
    'petit',
  ),
  p(
    'quatre_h',
    'BARRE',
    [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
    ],
    7,
    'normal',
  ),
  p(
    'quatre_v',
    'BARRE DEBOUT',
    [
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
    ],
    7,
    'normal',
  ),
  p(
    'cinq_h',
    'POUTRE',
    [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
      [4, 0],
    ],
    4,
    'gros',
  ),
  p(
    'cinq_v',
    'POUTRE DEBOUT',
    [
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
      [0, 4],
    ],
    4,
    'gros',
  ),

  // --- Carrés ------------------------------------------------------------------
  p(
    'carre2',
    'CARRÉ',
    [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ],
    9,
    'normal',
  ),
  p(
    'carre3',
    'GRAND CARRÉ',
    [
      [0, 0],
      [1, 0],
      [2, 0],
      [0, 1],
      [1, 1],
      [2, 1],
      [0, 2],
      [1, 2],
      [2, 2],
    ],
    3,
    'gros',
  ),
  p(
    'rect23',
    'PAVÉ',
    [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
      [0, 2],
      [1, 2],
    ],
    5,
    'gros',
  ),
  p(
    'rect32',
    'PAVÉ COUCHÉ',
    [
      [0, 0],
      [1, 0],
      [2, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ],
    5,
    'gros',
  ),

  // --- Coins (trois cases) ------------------------------------------------------
  p(
    'coin_ne',
    'COIN',
    [
      [0, 0],
      [1, 0],
      [0, 1],
    ],
    8,
    'normal',
  ),
  p(
    'coin_no',
    'COIN B',
    [
      [0, 0],
      [1, 0],
      [1, 1],
    ],
    8,
    'normal',
  ),
  p(
    'coin_se',
    'COIN C',
    [
      [0, 0],
      [0, 1],
      [1, 1],
    ],
    8,
    'normal',
  ),
  p(
    'coin_so',
    'COIN D',
    [
      [1, 0],
      [0, 1],
      [1, 1],
    ],
    8,
    'normal',
  ),

  // --- Les quatre L et J ---------------------------------------------------------
  p(
    'l_bas',
    'ÉQUERRE',
    [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 2],
    ],
    6,
    'normal',
  ),
  p(
    'l_haut',
    'ÉQUERRE B',
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [1, 2],
    ],
    6,
    'normal',
  ),
  p(
    'j_bas',
    'ÉQUERRE C',
    [
      [1, 0],
      [1, 1],
      [0, 2],
      [1, 2],
    ],
    6,
    'normal',
  ),
  p(
    'j_haut',
    'ÉQUERRE D',
    [
      [0, 0],
      [1, 0],
      [0, 1],
      [0, 2],
    ],
    6,
    'normal',
  ),
  p(
    'l_droite',
    'ÉQUERRE E',
    [
      [0, 0],
      [1, 0],
      [2, 0],
      [0, 1],
    ],
    6,
    'normal',
  ),
  p(
    'l_gauche',
    'ÉQUERRE F',
    [
      [0, 0],
      [1, 0],
      [2, 0],
      [2, 1],
    ],
    6,
    'normal',
  ),
  p(
    'j_droite',
    'ÉQUERRE G',
    [
      [0, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ],
    6,
    'normal',
  ),
  p(
    'j_gauche',
    'ÉQUERRE H',
    [
      [2, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ],
    6,
    'normal',
  ),

  // --- Les T et les S -------------------------------------------------------------
  p(
    't_bas',
    'MARTEAU',
    [
      [0, 0],
      [1, 0],
      [2, 0],
      [1, 1],
    ],
    5,
    'normal',
  ),
  p(
    't_haut',
    'MARTEAU B',
    [
      [1, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ],
    5,
    'normal',
  ),
  p(
    't_droite',
    'MARTEAU C',
    [
      [0, 0],
      [0, 1],
      [1, 1],
      [0, 2],
    ],
    5,
    'normal',
  ),
  p(
    't_gauche',
    'MARTEAU D',
    [
      [1, 0],
      [0, 1],
      [1, 1],
      [1, 2],
    ],
    5,
    'normal',
  ),
  p(
    's_h',
    'ZIGZAG',
    [
      [1, 0],
      [2, 0],
      [0, 1],
      [1, 1],
    ],
    4,
    'normal',
  ),
  p(
    'z_h',
    'ZIGZAG B',
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [2, 1],
    ],
    4,
    'normal',
  ),
  p(
    's_v',
    'ZIGZAG C',
    [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 2],
    ],
    4,
    'normal',
  ),
  p(
    'z_v',
    'ZIGZAG D',
    [
      [1, 0],
      [0, 1],
      [1, 1],
      [0, 2],
    ],
    4,
    'normal',
  ),

  // --- Les grosses, réservées aux mondes qui les appellent -------------------------
  p(
    'croix',
    'CROIX',
    [
      [1, 0],
      [0, 1],
      [1, 1],
      [2, 1],
      [1, 2],
    ],
    3,
    'gros',
  ),
  p(
    'grand_l',
    'GRANDE ÉQUERRE',
    [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 2],
      [2, 2],
    ],
    3,
    'gros',
  ),
  p(
    'grand_l2',
    'GRANDE ÉQUERRE B',
    [
      [0, 0],
      [1, 0],
      [2, 0],
      [2, 1],
      [2, 2],
    ],
    3,
    'gros',
  ),
  p(
    'escalier',
    'ESCALIER',
    [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 2],
      [2, 2],
    ],
    2,
    'gros',
  ),
  p(
    'diag2',
    'DIAGONALE',
    [
      [0, 0],
      [1, 1],
    ],
    3,
    'petit',
  ),
  p(
    'diag3',
    'GRANDE DIAGONALE',
    [
      [0, 0],
      [1, 1],
      [2, 2],
    ],
    2,
    'gros',
  ),
]

export const PIECE = Object.fromEntries(PIECES.map((x) => [x.id, x]))

/** Largeur et hauteur d'une pièce, en cases. */
export const encombrement = (piece) => ({
  w: Math.max(...piece.cases.map((c) => c[0])) + 1,
  h: Math.max(...piece.cases.map((c) => c[1])) + 1,
})

// --- Les transformations ---------------------------------------------------------
//
// Un bloc marqué. Il se pose comme les autres, et **au moment où sa ligne
// éclate**, il fait autre chose. C'est ce qui fait qu'on choisit où le mettre
// plutôt que de le poser où ça rentre.

/** Les effets que le résolveur sait appliquer. Le test compare cette liste au code. */
export const EFFETS = ['souffle', 'rayon', 'teinte', 'prime', 'dur']

const tr = (id, nom, effet, valeur, court, teinte, texte) => ({ id, nom, effet, valeur, court, teinte, texte })

export const TRANSFOS = [
  tr('bombe', 'BOMBE', 'souffle', 1, '✳', C.rouge, 'En éclatant, emporte les huit cases autour d’elle.'),
  tr('mine', 'MINE LOURDE', 'souffle', 2, '❉', C.rouge, 'En éclatant, emporte tout dans un rayon de deux cases.'),
  tr('rayon', 'RAYON', 'rayon', 1, '✛', C.cyan, 'En éclatant, emporte toute sa ligne et toute sa colonne.'),
  tr('prisme', 'PRISME', 'teinte', 1, '◈', C.violet, 'En éclatant, emporte tous les blocs de sa couleur.'),
  tr('lingot', 'LINGOT', 'prime', 3, '◆', C.accent, 'Vaut trois fois les points d’un bloc ordinaire.'),
  tr('roche', 'ROCHE', 'dur', 2, '▩', C.faible, 'Il faut la prendre dans deux éclats pour s’en débarrasser.'),
]

export const TRANSFO = Object.fromEntries(TRANSFOS.map((x) => [x.id, x]))

// --- Les mondes --------------------------------------------------------------------
//
// Un monde, c'est une grille, un objectif, une palette et **une** idée neuve.
// Les clés de `regles` sont lues une par une par `logique.js` ; en ajouter une
// demande d'écrire son effet, ce qu'un test vérifie.

/** Le vocabulaire des règles de monde. Rien d'autre n'est admis. */
export const REGLES = ['taille', 'prerempli', 'roche', 'montee', 'gel', 'bassin', 'semis']

const m = (id, nom, teinte, objectif, regles, texte) => ({ id, nom, teinte, objectif, regles, texte })

export const MONDES = [
  m(
    'cour',
    'LA COUR',
    C.cyan,
    800,
    { taille: 8, bassin: 'normal' },
    'Huit sur huit, rien d’autre. C’est là qu’on apprend à ne pas boucher ses coins.',
  ),
  m(
    'forge',
    'LA FORGE',
    C.accent,
    1100,
    { taille: 8, prerempli: 6, bassin: 'normal', semis: { lingot: 3 } },
    'Six blocs sont déjà là, et des lingots passent dans le tas.',
  ),
  m(
    'carriere',
    'LA CARRIÈRE',
    C.faible,
    1500,
    { taille: 8, roche: 5, bassin: 'normal', semis: { bombe: 3 } },
    'Cinq roches qu’il faut prendre deux fois. Les bombes servent à ça.',
  ),
  m(
    'atelier',
    'L’ATELIER',
    C.vert,
    1950,
    { taille: 9, bassin: 'normal', semis: { rayon: 3 } },
    'Neuf sur neuf : une case de plus, et tout ce qu’on savait se décale.',
  ),
  m(
    'crue',
    'LA CRUE',
    C.cyan,
    700,
    { taille: 8, montee: 9, bassin: 'normal', semis: { bombe: 2, rayon: 2 } },
    'Une rangée monte du bas toutes les neuf poses — mais un doublé la repousse. On ne joue plus pour marquer, on joue pour tenir.',
  ),
  m(
    'gel',
    'LE GEL',
    C.violet,
    3100,
    { taille: 8, gel: 3, bassin: 'normal', semis: { rayon: 3, prisme: 2 } },
    'Ce qui éclate laisse du givre. Une case gelée se reprend une seconde fois.',
  ),
  m(
    'orage',
    'L’ORAGE',
    C.rouge,
    3800,
    { taille: 8, bassin: 'gros', semis: { bombe: 3, mine: 2 } },
    'Que des grosses pièces. Il n’y a plus de place pour se rattraper.',
  ),
  m(
    'faille',
    'LA FAILLE',
    C.violet,
    900,
    { taille: 9, roche: 8, montee: 12, bassin: 'normal', semis: { mine: 3, prisme: 2 } },
    'Neuf sur neuf, huit roches, et l’eau qui monte. C’est le monde où l’on apprend à sacrifier une ligne.',
  ),
  m(
    'fournaise',
    'LA FOURNAISE',
    C.accent,
    1000,
    { taille: 8, prerempli: 10, montee: 10, gel: 2, bassin: 'gros', semis: { mine: 3, rayon: 3, lingot: 2 } },
    'Tout à la fois, et la moitié du plateau déjà pris.',
  ),
  m(
    'vide',
    'LE VIDE',
    C.texte,
    6600,
    { taille: 10, bassin: 'gros', semis: { prisme: 3, rayon: 2, lingot: 2 } },
    'Dix sur dix. Assez grand pour respirer, assez grand pour s’y perdre.',
  ),
]

export const MONDE = Object.fromEntries(MONDES.map((x) => [x.id, x]))

/**
 * Les mondes où une rangée monte ont un objectif **court**, et c'est mesuré.
 *
 * Au banc, une partie de crue plafonne autour de sept cents points avant de
 * déborder, quel que soit le rythme de la montée : leur difficulté n'est pas
 * d'atteindre un chiffre, c'est de rester en vie assez longtemps pour
 * l'atteindre. Un objectif calé sur les mondes calmes en aurait fait des murs
 * infranchissables plutôt que des mondes courts et tendus — c'est exactement
 * ce qui arrivait avec 2 200, franchi zéro fois sur quarante parties.
 */

/**
 * Après le dernier monde, on recommence — mais un cran plus haut.
 *
 * Le cycle ne change aucune règle : il multiplie l'objectif et ajoute des
 * blocs de départ. C'est le seul endroit du jeu où la difficulté monte sans
 * qu'une idée neuve apparaisse, et c'est assumé : à ce stade on ne joue plus
 * pour découvrir, on joue pour le record.
 */
export const mondeDe = (n) => {
  const cycle = Math.floor(n / MONDES.length)
  const base = MONDES[n % MONDES.length]
  if (cycle === 0) return { ...base, cycle }
  return {
    ...base,
    cycle,
    nom: `${base.nom} · ${'II III IV V VI VII VIII IX X'.split(' ')[Math.min(8, cycle - 1)]}`,
    objectif: Math.round(base.objectif * Math.pow(1.55, cycle)),
    regles: { ...base.regles, prerempli: (base.regles.prerempli ?? 0) + cycle * 3 },
  }
}

/** Le vivier de pièces d'un monde : c'est lui qui donne son grain à chaque plateau. */
export function bassinDe(regles) {
  const nom = regles.bassin ?? 'normal'
  if (nom === 'gros') return PIECES.filter((x) => x.famille !== 'petit')
  if (nom === 'petit') return PIECES.filter((x) => x.famille !== 'gros')
  return PIECES
}
