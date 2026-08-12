import { C } from '../../../palette.js'

/**
 * Les processus.
 *
 * Un processus est défini par un **comportement**, pas par ses statistiques :
 * c'est ce qui fait qu'on apprend à jouer contre lui au lieu de le regarder
 * frapper. Et dans un même acte, deux processus ne partagent pas le couple
 * `(comportement, compétence principale)` — un test le vérifie, sinon on
 * remplit la table de jumeaux repeints.
 *
 * `resist` va de −0.5 (faiblesse franche) à +0.75 (mur). Trois nombres, et une
 * équipe mono-type finit par se heurter à quelque chose sans qu'aucune règle
 * ne l'interdise.
 */
export const PROCESSUS = [
  {
    id: 'veille',
    nom: 'VEILLE',
    acte: 1,
    couleur: C.faible,
    pv: 34,
    puiss: 6,
    vit: 8,
    blindage: 0,
    rang: 0,
    resist: { brut: 0, logique: 0, corruption: 0 },
    comp: ['p_griffe'],
    comportement: 'devant',
  },
  {
    id: 'balise',
    nom: 'BALISE',
    acte: 1,
    couleur: C.cyan,
    pv: 26,
    puiss: 6,
    vit: 12,
    blindage: 0,
    rang: 1,
    resist: { brut: -0.25, logique: 0.25, corruption: 0 },
    comp: ['p_verrou', 'p_griffe'],
    comportement: 'faible',
  },
  {
    id: 'tampon',
    nom: 'TAMPON',
    acte: 1,
    couleur: C.vert,
    pv: 58,
    puiss: 7,
    vit: 6,
    blindage: 3,
    rang: 0,
    resist: { brut: 0.4, logique: -0.4, corruption: 0 },
    comp: ['p_blindage', 'p_frappe'],
    comportement: 'tenace',
  },
  {
    id: 'boucle',
    nom: 'BOUCLE',
    acte: 1,
    couleur: C.violet,
    pv: 40,
    puiss: 7,
    vit: 10,
    blindage: 1,
    rang: 1,
    resist: { brut: 0, logique: 0, corruption: -0.5 },
    comp: ['p_injection'],
    comportement: 'rongeur',
  },
  {
    id: 'sentinelle',
    nom: 'SENTINELLE',
    acte: 1,
    couleur: C.rouge,
    pv: 50,
    puiss: 9,
    vit: 9,
    blindage: 2,
    rang: 0,
    resist: { brut: 0.2, logique: 0, corruption: 0.2 },
    comp: ['p_frappe', 'p_ecrase'],
    comportement: 'brutal',
  },
  {
    id: 'essaim',
    nom: 'ESSAIM',
    acte: 1,
    couleur: C.accent,
    pv: 28,
    puiss: 7,
    vit: 14,
    blindage: 0,
    rang: 0,
    resist: { brut: -0.3, logique: 0.3, corruption: 0 },
    comp: ['p_griffe'],
    comportement: 'presse',
  },
  {
    id: 'relais',
    nom: 'RELAIS',
    acte: 1,
    couleur: C.vert,
    pv: 42,
    puiss: 6,
    vit: 11,
    blindage: 1,
    rang: 1,
    resist: { brut: 0, logique: 0.25, corruption: -0.25 },
    comp: ['p_correctif', 'p_griffe'],
    comportement: 'soigneur',
  },
  {
    id: 'salvateur',
    nom: 'DIFFUSEUR',
    acte: 1,
    couleur: C.violet,
    pv: 44,
    puiss: 8,
    vit: 8,
    blindage: 1,
    rang: 1,
    resist: { brut: 0.15, logique: 0, corruption: 0.15 },
    comp: ['p_salve', 'p_griffe'],
    comportement: 'arrose',
  },
  {
    id: 'rouille',
    nom: 'ROUILLE',
    acte: 1,
    couleur: C.accent,
    pv: 52,
    puiss: 8,
    vit: 7,
    blindage: 3,
    rang: 0,
    resist: { brut: 0.3, logique: 0, corruption: -0.3 },
    comp: ['p_corrode', 'p_frappe'],
    comportement: 'rongeur',
  },
  {
    id: 'garde',
    nom: 'GARDE-BARRIÈRE',
    acte: 1,
    couleur: C.cyan,
    pv: 66,
    puiss: 9,
    vit: 7,
    blindage: 4,
    rang: 0,
    resist: { brut: 0.35, logique: -0.2, corruption: 0.1 },
    comp: ['p_ecrase', 'p_frappe'],
    comportement: 'brutal',
  },
]

/**
 * Les noyaux. Chacun **change une règle du combat** le temps du duel : c'est ce
 * qui les distingue d'un processus à grosse barre de vie.
 */
export const NOYAUX = [
  {
    id: 'n_veilleur',
    nom: 'LE VEILLEUR',
    acte: 1,
    boss: true,
    couleur: C.rouge,
    pv: 300,
    puiss: 11,
    vit: 9,
    blindage: 3,
    rang: 0,
    resist: { brut: 0.25, logique: -0.25, corruption: 0.1 },
    comp: ['p_ecrase', 'p_salve', 'p_blindage'],
    comportement: 'brutal',
    regle: 'tracage',
    dit: 'Le traçage monte deux fois plus vite. On ne gagne pas en durant.',
  },
  {
    id: 'n_metier',
    nom: 'LE MÉTIER À TISSER',
    acte: 1,
    boss: true,
    couleur: C.violet,
    pv: 240,
    puiss: 10,
    vit: 11,
    blindage: 1,
    rang: 1,
    resist: { brut: -0.2, logique: 0.4, corruption: -0.3 },
    comp: ['p_correctif', 'p_corrode', 'p_ecrase'],
    comportement: 'soigneur',
    regle: 'escorte',
    // L'escorte est écrite, pas tirée : un noyau qui répare ce qui le protège
    // n'a de sens que si ce qui le protège fait peur.
    escorte: ['sentinelle', 'rouille'],
    dit: 'Il ne se bat pas seul, et il répare ce qui l’escorte.',
  },
]

export const TOUS_PROCESSUS = [...PROCESSUS, ...NOYAUX]
export const PROC = Object.fromEntries(TOUS_PROCESSUS.map((p) => [p.id, p]))
