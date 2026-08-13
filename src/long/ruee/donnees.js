/**
 * RUÉE — la matière : les motifs, et les niveaux qui les enchaînent.
 *
 * **Pourquoi des motifs plutôt que des niveaux dessinés d'un bloc.** Un jeu
 * de ce genre se joue par cœur : on meurt, on recommence, on apprend un
 * passage. Le passage est donc l'unité réelle du jeu, pas le niveau. En en
 * faisant l'unité du *fichier* aussi, on gagne trois choses qu'un long ruban
 * de cases ne donne pas :
 *
 *   - chaque motif se vérifie **seul** au banc — un motif infranchissable est
 *     trouvé à la ligne près, au lieu d'un niveau qui « bloque vers 40 % » ;
 *   - un niveau devient une liste courte, lisible, qu'on réordonne pour régler
 *     une courbe de difficulté sans redessiner une case ;
 *   - un motif appris dans un niveau se reconnaît dans le suivant, ce qui est
 *     exactement ce qu'on veut d'un jeu qui s'apprend.
 *
 * **La grille.** Onze rangées, la dernière étant le sol : `#` sol présent,
 * espace = trou. Au-dessus, `.` est vide et le reste est du contenu. Un motif
 * est aussi large qu'il veut ; le niveau les met bout à bout avec du repos
 * entre eux.
 */

export const RANGEES = 11
export const SOL = RANGEES - 1

/**
 * Le vocabulaire d'une case. Une lettre, une chose, et rien d'implicite.
 *
 * **Un portail occupe toute la hauteur de sa colonne**, et ce n'est pas un
 * détail de dessin. Tant qu'il ne faisait que deux cases, le solveur sautait
 * par-dessus et jouait la section suivante dans le mauvais véhicule — la
 * gravité inversée était décorative, et personne ne l'aurait vu en relisant les
 * motifs. Un portail est une porte : on la franchit, on ne la contourne pas.
 */
export const CASES = {
  '.': 'vide',
  '#': 'bloc',
  '^': 'pic', // tue au contact
  o: 'orbe', // un appui en l'air redonne un saut
  _: 'tremplin', // relance tout seul, plus haut qu'un saut
  b: 'orbeInverse', // un appui en l'air retourne la gravité *et* relance
  S: 'portailVaisseau',
  W: 'portailOnde',
  C: 'portailCube',
  G: 'portailGravite', // retourne le monde, quel que soit le véhicule
  '>': 'portailRapide',
  '<': 'portailLent',
}

const m = (id, nom, difficulte, mode, cases) => ({ id, nom, difficulte, mode, cases, large: cases[0].length })

/**
 * Les motifs. `difficulte` va de 1 à 5 et ne sert qu'à composer les niveaux ;
 * c'est le banc qui dit la vérité sur ce qui est franchissable.
 *
 * `mode` dit dans quel véhicule le motif se joue — un couloir de vaisseau
 * n'a aucun sens à pied, et un test vérifie qu'aucun niveau ne les mélange.
 */
export const MOTIFS = [
  // --- Le sol, et ce qui dépasse ------------------------------------------------
  m('plat', 'LE PLAT', 1, 'cube', [
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '##########',
  ]),

  m('pic1', 'UN PIC', 1, 'cube', [
    '......',
    '......',
    '......',
    '......',
    '......',
    '......',
    '......',
    '......',
    '......',
    '..^...',
    '######',
  ]),

  m('pic2', 'DEUX PICS', 2, 'cube', [
    '.........',
    '.........',
    '.........',
    '.........',
    '.........',
    '.........',
    '.........',
    '.........',
    '.........',
    '..^...^..',
    '#########',
  ]),

  m('pics3', 'TROIS DE SUITE', 3, 'cube', [
    '........',
    '........',
    '........',
    '........',
    '........',
    '........',
    '........',
    '........',
    '........',
    '..^^^...',
    '########',
  ]),

  m('marche', 'LA MARCHE', 1, 'cube', [
    '........',
    '........',
    '........',
    '........',
    '........',
    '........',
    '........',
    '........',
    '....####',
    '....####',
    '########',
  ]),

  m('escalier', 'L’ESCALIER', 2, 'cube', [
    '............',
    '............',
    '............',
    '............',
    '............',
    '............',
    '........####',
    '......######',
    '....########',
    '..##########',
    '############',
  ]),

  m('trou', 'LE TROU', 2, 'cube', [
    '........',
    '........',
    '........',
    '........',
    '........',
    '........',
    '........',
    '........',
    '........',
    '........',
    '###..###',
  ]),

  m('trouLarge', 'LE GRAND TROU', 3, 'cube', [
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '###....###',
  ]),

  // Une plateforme se pose là où l'arc **retombe**, pas là où il monte. Le saut
  // décolle avant le pic (au plus tard à 41 px du motif) et redescend 92 px
  // plus loin : la dalle commence donc à la case 4. Plus tôt, on la traverse
  // par en dessous ; plus tard, on retombe au sol et on meurt sur son flanc.
  m('plateforme', 'LA PLATEFORME', 2, 'cube', [
    '............',
    '............',
    '............',
    '............',
    '............',
    '............',
    '............',
    '....####....',
    '............',
    '..^......^..',
    '############',
  ]),

  // Trois cases de haut, pas plus : le saut monte de 3,2 cases, donc un pilier
  // plus haut n'est pas « difficile », il est un mur. Le premier jet en faisait
  // sept, et le banc l'a dit tout de suite.
  m('pilier', 'LE PILIER', 3, 'cube', [
    '............',
    '............',
    '............',
    '............',
    '............',
    '............',
    '............',
    '....###.....',
    '....###.....',
    '..^.###.....',
    '############',
  ]),

  m('dents', 'LES DENTS', 4, 'cube', [
    '..............',
    '..............',
    '..............',
    '..............',
    '..............',
    '..............',
    '..............',
    '..........####',
    '.....####.####',
    '..^..####.####',
    '##############',
  ]),

  m('couloirBas', 'SOUS LA DALLE', 3, 'cube', [
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '##########',
    '..........',
    '..........',
    '..........',
    '..^....^..',
    '##########',
  ]),

  // --- Ce qui relance -----------------------------------------------------------
  m('orbe', 'L’ORBE', 3, 'cube', [
    '............',
    '............',
    '............',
    '............',
    '............',
    '............',
    '............',
    '.....o......',
    '............',
    '............',
    '###......###',
  ]),

  // Les orbes sont à la rangée 7, pas plus haut : le sommet du saut place le
  // cube à la rangée 6 et demie, donc une orbe à la rangée 5 est hors de
  // portée — elle ne rend pas le passage dur, elle le rend faux.
  m('orbeDouble', 'DEUX ORBES', 4, 'cube', [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '.....o.....o....',
    '................',
    '................',
    '###..........###',
  ]),

  m('tremplin', 'LE TREMPLIN', 2, 'cube', [
    '............',
    '............',
    '............',
    '............',
    '............',
    '............',
    '............',
    '........####',
    '........####',
    '..._....####',
    '############',
  ]),

  // --- Le vaisseau --------------------------------------------------------------
  m('volEntree', 'ON DÉCOLLE', 1, 'cube', [
    '...S....',
    '...S....',
    '...S....',
    '...S....',
    '...S....',
    '...S....',
    '...S....',
    '...S....',
    '...S....',
    '...S....',
    '########',
  ]),

  m('volPlat', 'LE COULOIR', 1, 'vaisseau', [
    '##########',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '##########',
  ]),

  m('volResserre', 'ÇA SE RESSERRE', 3, 'vaisseau', [
    '##########',
    '##########',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '##########',
    '##########',
    '##########',
  ]),

  m('volVague', 'LA VAGUE', 4, 'vaisseau', [
    '############',
    '#####.......',
    '#####.......',
    '............',
    '.......#####',
    '.......#####',
    '............',
    '#####.......',
    '#####.......',
    '............',
    '############',
  ]),

  m('volPics', 'LES DENTS DU HAUT', 4, 'vaisseau', [
    '##########',
    '..^....^..',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..^....^..',
    '##########',
  ]),

  m('volSortie', 'ON REPOSE', 1, 'vaisseau', [
    '##########',
    '...C......',
    '...C......',
    '...C......',
    '...C......',
    '...C......',
    '...C......',
    '...C......',
    '...C......',
    '...C......',
    '##########',
  ]),

  // --- La gravité qui se retourne -------------------------------------------------
  //
  // Le plafond devient le sol. Ce n'est pas un véhicule de plus : c'est le même
  // cube, le même saut, la même lecture — à l'envers. D'où le fait qu'on peut
  // reprendre ici les motifs du sol sans les redessiner, simplement retournés.

  m('gravEntree', 'LE MONDE BASCULE', 2, 'cube', [
    '##########',
    '....G.....',
    '....G.....',
    '....G.....',
    '....G.....',
    '....G.....',
    '....G.....',
    '....G.....',
    '....G.....',
    '....G.....',
    '##########',
  ]),

  m('gravPics', 'AU PLAFOND', 3, 'cube', [
    '##########',
    '..^....^..',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '##########',
  ]),

  m('gravMarche', 'LA MARCHE À L’ENVERS', 3, 'cube', [
    '##########',
    '####......',
    '####......',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '##########',
  ]),

  m('gravRetour', 'ON REDESCEND', 2, 'cube', [
    '##########',
    '....G.....',
    '....G.....',
    '....G.....',
    '....G.....',
    '....G.....',
    '....G.....',
    '....G.....',
    '....G.....',
    '....G.....',
    '##########',
  ]),

  m('orbeInverse', 'L’ORBE BLEUE', 4, 'cube', [
    '##########',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '.....b....',
    '..........',
    '..........',
    '###....###',
  ]),

  // --- L'onde ---------------------------------------------------------------------
  //
  // Le portail se prend en l'air, comme celui du vaisseau : entrer en onde au
  // ras du sol ne laisse pas une image pour réagir, et un passage à une image
  // près n'est pas un passage.

  m('ondeEntree', 'LE FIL', 2, 'cube', [
    '##########',
    '....W.....',
    '....W.....',
    '....W.....',
    '....W.....',
    '....W.....',
    '....W.....',
    '....W.....',
    '....W.....',
    '....W.....',
    '##########',
  ]),

  m('ondePlat', 'TIRER LE TRAIT', 1, 'onde', [
    '##########',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '##########',
  ]),

  m('ondeCouloir', 'LE COULOIR FIN', 4, 'onde', [
    '##########',
    '##########',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '##########',
    '##########',
    '##########',
  ]),

  // Trois cases de passage, pas deux. Une onde avance d'une case en hauteur
  // pour une case en largeur : dans un couloir de deux, elle touche avant
  // d'avoir fini de tourner, et le motif n'est pas dur — il est faux.
  m('ondeEscalier', 'EN ESCALIER', 4, 'onde', [
    '############',
    '############',
    '###.........',
    '###.........',
    '............',
    '............',
    '............',
    '........####',
    '############',
    '############',
    '############',
  ]),

  m('ondeSortie', 'ON SE REPOSE', 1, 'onde', [
    '##########',
    '....C.....',
    '....C.....',
    '....C.....',
    '....C.....',
    '....C.....',
    '....C.....',
    '....C.....',
    '....C.....',
    '....C.....',
    '##########',
  ]),

  // --- La vitesse ---------------------------------------------------------------
  m('accelere', 'PLUS VITE', 1, 'cube', [
    '...>..',
    '...>..',
    '...>..',
    '...>..',
    '...>..',
    '...>..',
    '...>..',
    '...>..',
    '...>..',
    '...>..',
    '######',
  ]),

  m('ralentit', 'PLUS LENT', 1, 'cube', [
    '...<..',
    '...<..',
    '...<..',
    '...<..',
    '...<..',
    '...<..',
    '...<..',
    '...<..',
    '...<..',
    '...<..',
    '######',
  ]),
]

export const PAR_ID = Object.fromEntries(MOTIFS.map((x) => [x.id, x]))

/** Une pause entre deux motifs : du sol, et rien dessus. */
export const repos = (n) => ({ repos: n })

/**
 * Une pause **couverte** : du sol *et* un plafond.
 *
 * Indispensable dans une section à gravité inversée. Un repos ordinaire n'a
 * pas de plafond, donc une fois le monde retourné le joueur monte et sort de
 * la grille — le niveau devient infranchissable au premier espace entre deux
 * motifs, et le motif n'y est pour rien.
 */
export const reposCouvert = (n) => ({ repos: n, couvert: true })

/**
 * Les niveaux. `bande` est l'identifiant du morceau qui l'accompagne, et il
 * n'est pas décoratif : c'est son tempo qui donne la vitesse de défilement,
 * donc le niveau *est* calé sur sa musique.
 */
export const NIVEAUX = [
  {
    id: 'premiere',
    nom: 'PREMIÈRE RUÉE',
    bande: 'ruee1',
    vitesse: 1,
    suite: [
      repos(6),
      'pic1',
      repos(4),
      'pic1',
      repos(3),
      'marche',
      repos(3),
      'pic2',
      repos(4),
      'trou',
      repos(3),
      'plateforme',
      repos(4),
      'pic1',
      repos(3),
      'escalier',
      repos(5),
      'pic2',
      repos(6),
    ],
  },
  {
    id: 'ferraille',
    nom: 'LA FERRAILLE',
    bande: 'ruee2',
    vitesse: 1,
    suite: [
      repos(6),
      'pic2',
      repos(3),
      'plateforme',
      repos(3),
      'trou',
      repos(2),
      'pics3',
      repos(4),
      'couloirBas',
      repos(3),
      'tremplin',
      repos(3),
      'pilier',
      repos(3),
      'trouLarge',
      repos(4),
      'escalier',
      repos(5),
    ],
  },
  {
    id: 'envol',
    nom: 'L’ENVOL',
    bande: 'ruee3',
    vitesse: 1,
    suite: [
      repos(6),
      'pic1',
      repos(3),
      'marche',
      repos(4),
      'volEntree',
      'volPlat',
      'volResserre',
      'volPlat',
      'volPics',
      'volPlat',
      'volSortie',
      repos(4),
      'pic2',
      repos(3),
      'plateforme',
      repos(5),
    ],
  },
  {
    id: 'orbite',
    nom: 'LES ORBES',
    bande: 'ruee4',
    vitesse: 1,
    suite: [
      repos(6),
      'pic2',
      repos(3),
      'orbe',
      repos(4),
      'tremplin',
      repos(3),
      'orbe',
      repos(3),
      'pics3',
      repos(3),
      'orbeDouble',
      repos(4),
      'pilier',
      repos(3),
      'dents',
      repos(5),
    ],
  },
  {
    id: 'derniere',
    nom: 'LA DERNIÈRE',
    bande: 'ruee5',
    vitesse: 1.15,
    suite: [
      repos(6),
      'pics3',
      repos(3),
      'dents',
      repos(3),
      'orbe',
      repos(3),
      'volEntree',
      'volPlat',
      'volVague',
      'volPlat',
      'volResserre',
      'volSortie',
      repos(3),
      'pilier',
      repos(2),
      'orbeDouble',
      repos(3),
      'trouLarge',
      repos(2),
      'pics3',
      repos(6),
    ],
  },
  {
    id: 'renverse',
    nom: 'À L’ENVERS',
    bande: 'ruee6',
    vitesse: 1,
    suite: [
      repos(6),
      'pic2',
      repos(3),
      'gravEntree',
      reposCouvert(3),
      'gravPics',
      reposCouvert(2),
      'gravMarche',
      reposCouvert(3),
      'gravPics',
      reposCouvert(3),
      'gravRetour',
      repos(4),
      'pics3',
      repos(3),
      'plateforme',
      repos(5),
    ],
  },
  {
    id: 'fil',
    nom: 'LE FIL',
    bande: 'ruee7',
    vitesse: 1,
    suite: [
      repos(6),
      'pic1',
      repos(3),
      'marche',
      repos(4),
      'ondeEntree',
      'ondePlat',
      'ondeCouloir',
      'ondePlat',
      'ondeEscalier',
      'ondePlat',
      'ondeSortie',
      repos(4),
      'orbe',
      repos(3),
      'pic2',
      repos(5),
    ],
  },
  {
    id: 'tout',
    nom: 'TOUT EN MÊME TEMPS',
    bande: 'ruee8',
    vitesse: 1.1,
    suite: [
      repos(6),
      'pics3',
      repos(3),
      'gravEntree',
      reposCouvert(2),
      'gravPics',
      reposCouvert(2),
      'gravRetour',
      repos(3),
      'volEntree',
      'volPlat',
      'volVague',
      'volPlat',
      'volSortie',
      repos(3),
      'ondeEntree',
      'ondePlat',
      'ondeCouloir',
      'ondePlat',
      'ondeSortie',
      repos(7),
      'dents',
      repos(2),
      'orbeDouble',
      repos(3),
      'pics3',
      repos(6),
    ],
  },
]

export const NIVEAU_PAR_ID = Object.fromEntries(NIVEAUX.map((n) => [n.id, n]))
