/**
 * Les tables de BRÈCHE : les pièces et les transformations.
 *
 * Tout est de la donnée. Une transformation est une clé prise dans `EFFETS`,
 * appliquée par un unique résolveur, et un test refuse toute clé qui n'est lue
 * nulle part — c'est ce qui empêche un contenu décoratif.
 *
 * **Il n'y a plus de mondes.** La partie est sans fin : un seul plateau de
 * huit sur huit, aucun objectif, aucun palier à franchir. Ce qui monte, c'est
 * ce que le directeur (`directeur.js`) décide de donner. Les dix mondes et
 * leurs sept règles ont été retirés d'un bloc plutôt que désactivés : une
 * mécanique qu'on garde « au cas où » finit par être lue par quelque chose.
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

/**
 * Les cinquante bandes-son ne suivent plus des mondes — il n'y en a plus.
 * Elles suivent le score : un palier tous les `PAR_PALIER` points, et la
 * musique change sous les doigts sans qu'aucun écran ne s'interpose.
 *
 * Le pas est calé au banc. À 2 200 points, l'automate moyen finissait à 0,7
 * palier : la musique ne changeait jamais, et quarante-neuf des cinquante
 * bandes étaient injouables en pratique. À 900, il en traverse deux ou trois,
 * un bon joueur une dizaine, et les cinquante restent l'affaire d'une partie
 * exceptionnelle — ce qui est le but.
 */
export const PAR_PALIER = 900
export const palierDe = (score) => Math.floor(Math.max(0, score) / PAR_PALIER)
