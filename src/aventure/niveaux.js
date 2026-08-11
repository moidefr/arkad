/**
 * Les niveaux de l'aventure, écrits en texte.
 *
 * Légende :
 *   #  bloc plein        ^  pic (mortel)
 *   o  pièce             X  sortie
 *   @  départ            .  vide
 *
 * Les lignes n'ont pas besoin d'être toutes de la même longueur, ni d'occuper
 * toute la hauteur : `normalise()` complète à droite et ajoute le ciel
 * au-dessus. On écrit donc seulement ce qui compte.
 *
 * Repères pour concevoir : le personnage avance tout seul et saute environ
 * 3 cases de long et 2 cases de haut. Un trou de 3 cases se franchit, un
 * trou de 4 non.
 */

export const TUILE = 20
export const RANGS = 16

export const NIVEAUX = [
  {
    nom: 'PREMIERS PAS',
    indice: 'appuie pour sauter',
    carte: [
      '..........oo................oo..............',
      '.........####..............####.............',
      '............................................',
      '....o..................o.................X..',
      '...####...............####..............####',
      '@...........................................',
      '#########...#########...##########..########',
    ],
  },
  {
    nom: 'LES PICS',
    indice: 'un pic, un saut',
    carte: [
      '................o..............o............',
      '.............#######........#######.........',
      '............................................',
      '....o...............o.....................X.',
      '............................................',
      '@...........................................',
      '######.^^.######.^^.####.^^^.######.^^.#####',
    ],
  },
  {
    nom: "L'ESCALIER",
    indice: 'monte, ça descend tout seul',
    carte: [
      '..................................o.......X.',
      '.................................######.####',
      '............................o...............',
      '...........................####.............',
      '.....................o......................',
      '....................####....................',
      '...............o............................',
      '..............####..........................',
      '........o...................................',
      '.......####.................................',
      '@...........................................',
      '#####....^^....^^......^^.........^^........',
    ],
  },
]

/** Complète la carte : padding à droite, ciel au-dessus. */
export function normalise(carte) {
  const largeur = Math.max(...carte.map((l) => l.length))
  const bas = carte.map((l) => l.padEnd(largeur, '.'))
  const ciel = Array.from({ length: Math.max(0, RANGS - bas.length) }, () => '.'.repeat(largeur))
  return [...ciel, ...bas]
}
