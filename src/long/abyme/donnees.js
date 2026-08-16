import { C } from '../../palette.js'

/**
 * Tout le contenu de l'ABYME, en tables. Rien ici n'importe `dessin.js` ni ne
 * lance de dé — c'est `logique.js` qui décide, avec un hasard qui vient
 * toujours du moteur (voir `expedition/donnees.js` pour la même discipline).
 *
 * DONJON, l'ancien jeu, reposait sur de l'équipement plat (+X dégâts/armure) :
 * un seul stuff optimal, connu d'avance. Ici, les RELIQUES changent des
 * **règles** — la case touchée, ce qui blesse, ce qui esquive — pas seulement
 * des nombres. C'est ce qui donne une raison de varier les descentes.
 */

export const LARGEUR = 7
export const HAUTEUR = 7

export const DIRS = {
  haut: { dx: 0, dy: -1 },
  bas: { dx: 0, dy: 1 },
  gauche: { dx: -1, dy: 0 },
  droite: { dx: 1, dy: 0 },
}

// --- Le joueur -----------------------------------------------------------------

export const VIE_DEPART = 30
export const ATTAQUE_BASE = 4
export const ECHO_MAX = 24
export const PORTEE_ARC = 4
export const PIEGE_DEGATS = 3
export const PEAU_DURCIE_BONUS = 5
export const ALLIE_DEGATS = 2
export const ECHO_DEVORANT_COUT = 8
export const ECHO_DEVORANT_SOIN = 3

// --- Le bestiaire ----------------------------------------------------------------

/**
 * Quatre comportements distincts, pas quatre jeux de statistiques : c'est ce
 * qui manquait à DONJON. `croissanceVie`/`croissanceDegats` sont appliquées
 * par étage — `logique.js` les additionne, jamais ce fichier.
 */
export const MONSTRES = {
  rodeur: {
    nom: 'RÔDEUR',
    comportement: 'rodeur', // fonce droit sur le joueur, chaque tour
    couleur: C.rouge,
    vie: 5,
    degats: 2,
    croissanceVie: 0.5,
    croissanceDegats: 0.1,
  },
  tireur: {
    nom: 'TIREUR',
    comportement: 'tireur', // tire à distance en ligne droite, recule à bout portant
    couleur: C.cyan,
    vie: 4,
    degats: 2,
    croissanceVie: 0.4,
    croissanceDegats: 0.08,
    portee: 4,
  },
  spectre: {
    nom: 'SPECTRE',
    comportement: 'spectre', // ignore les murs, esquive une attaque sur trois
    couleur: C.violet,
    vie: 5,
    degats: 2,
    croissanceVie: 0.45,
    croissanceDegats: 0.09,
    esquive: 0.35,
  },
  colosse: {
    nom: 'COLOSSE',
    comportement: 'colosse', // n'agit qu'un tour sur deux, mais frappe fort
    couleur: C.faible,
    vie: 10,
    degats: 4,
    croissanceVie: 0.9,
    croissanceDegats: 0.15,
  },
}

/** À quelle profondeur chaque type commence à apparaître, et son poids de tirage. */
export const APPARITION = [
  { type: 'rodeur', depart: 1, poids: 5 },
  { type: 'tireur', depart: 2, poids: 3 },
  { type: 'spectre', depart: 3, poids: 3 },
  { type: 'colosse', depart: 5, poids: 2 },
]

// --- Les reliques ------------------------------------------------------------------

/**
 * Dix-huit reliques. La majorité change une règle du combat ou du
 * déplacement ; quelques-unes restent de purs bonus chiffrés, pour donner
 * aussi des choix simples entre deux descentes plus tactiques.
 */
export const RELIQUES = [
  { id: 'lame-fourchue', nom: 'LAME FOURCHUE', dit: 'touche aussi la case derrière la cible' },
  { id: 'poigne-de-fer', nom: 'POIGNE DE FER', dit: 'repousse au lieu de blesser à plein ; écrase contre un mur pour le double' },
  { id: 'arc-improvise', nom: 'ARC DE FORTUNE', dit: 'frappe à distance en ligne droite, pour 1 dégât de moins' },
  { id: 'pas-fantome', nom: 'PAS FANTÔME', dit: 'traverse un mur, une fois par étage' },
  { id: 'pieges-mous', nom: 'PIÈGES ÉMOUSSÉS', dit: 'les pièges ralentissent au lieu de blesser' },
  { id: 'echo-du-coup', nom: 'ÉCHO DU COUP', dit: 'un ennemi tué : les autres ne jouent pas ce tour' },
  { id: 'bouclier-vivant', nom: 'BOUCLIER VIVANT', dit: 'le premier coup de l’étage ne fait qu’1 dégât' },
  { id: 'chasse-fantome', nom: 'TRAQUE-SPECTRE', dit: 'tes coups ne sont plus esquivables' },
  { id: 'charnier', nom: 'CHARNIER', dit: 'les cadavres bloquent les tirs ennemis' },
  { id: 'symbiose', nom: 'SYMBIOSE', dit: 'chaque dégât subi te rend 2 ÉCHO' },
  { id: 'echo-devorant', nom: 'ÉCHO DÉVORANT', dit: 'attendre avec 8 ÉCHO ou plus soigne 3 PV' },
  { id: 'oeil-grand-ouvert', nom: 'ŒIL GRAND OUVERT', dit: 'les pièges de l’étage sont visibles dès l’entrée' },
  { id: 'desarmeur', nom: 'DÉSARMEUR', dit: 'un ennemi frappé perd son tour suivant' },
  { id: 'seuil-de-la-douleur', nom: 'SEUIL DE LA DOULEUR', dit: 'le coup fatal de l’étage laisse 1 PV et repousse l’ennemi' },
  { id: 'coeur-de-colosse', nom: 'CŒUR DE COLOSSE', dit: '+2 dégâts contre les COLOSSES, -1 contre le reste' },
  { id: 'peau-durcie', nom: 'PEAU DURCIE', dit: `+${PEAU_DURCIE_BONUS} de vie maximale, immédiatement` },
  { id: 'vestige-ami', nom: 'VESTIGE AMI', dit: 'le premier ennemi tué de l’étage rejoint ton camp' },
  { id: 'sang-froid', nom: 'SANG-FROID', dit: 'attendre sur place soigne 1 PV au lieu de rien faire' },
]

/**
 * Trois combos à deux reliques, identifiables et non additifs : posséder les
 * deux ne fait pas qu'empiler leurs effets, ça débloque un troisième
 * comportement qu'aucune des deux n'a seule.
 */
export const SYNERGIES = [
  {
    id: 'percee',
    nom: 'PERCÉE',
    requises: ['lame-fourchue', 'poigne-de-fer'],
    dit: 'le coup qui repousse traverse toute la ligne, pas seulement la cible',
  },
  {
    id: 'tir-du-sacrifice',
    nom: 'TIR DU SACRIFICE',
    requises: ['symbiose', 'arc-improvise'],
    dit: 'un tir à distance consomme tout ton ÉCHO en dégâts bonus',
  },
  {
    id: 'embuscade',
    nom: 'EMBUSCADE',
    requises: ['pas-fantome', 'charnier'],
    dit: 'après une traversée de mur, ta prochaine attaque frappe pour le double',
  },
]

// --- Méta-progression --------------------------------------------------------------

/**
 * Six reliques toujours proposables, seize de plus qui se débloquent avec les
 * ossements ramenés des descentes précédentes — la mort n'efface pas tout,
 * à la manière de REMPART. `logique.reliquesDeMeta` fait le calcul ;
 * `index.js` est seul à lire/écrire la monnaie, via `stockage.js`.
 */
export const BASE_DEBLOQUEES = ['lame-fourchue', 'pieges-mous', 'symbiose', 'peau-durcie', 'sang-froid', 'desarmeur']

export const ORDRE_DEBLOCAGE = [
  'bouclier-vivant',
  'coeur-de-colosse',
  'oeil-grand-ouvert',
  'pas-fantome',
  'chasse-fantome',
  'charnier',
  'poigne-de-fer',
  'vestige-ami',
  'arc-improvise',
  'echo-du-coup',
  'echo-devorant',
  'seuil-de-la-douleur',
]

/** Un déblocage tous les douze ossements — mesuré et retenu au banc. */
export const SEUIL_DEBLOCAGE = 12
