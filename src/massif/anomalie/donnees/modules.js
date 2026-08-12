import { C } from '../../../palette.js'

/**
 * Les modules — ce qu'un opérateur charge en mémoire.
 *
 * Trois emplacements par opérateur, jamais plus. Un module écoute un **tag**
 * émis par les compétences et fait quelque chose quand il passe : c'est ce bus
 * de trente lignes qui produit les combinaisons, et non des règles écrites une
 * par une.
 *
 * **Les paires antagonistes** vont par deux et s'excluent définitivement :
 * prendre l'un verrouille l'autre pour la partie, et le butin l'annonce avant
 * le choix. Avec les trois emplacements, le surcoût d'axe et les plafonds
 * d'état, c'est le quatrième garde-fou contre la combinaison qui gagne toute
 * seule — le défaut qui avait tué ASCENSION, où l'on cumulait les huit
 * reliques du jeu sans aucune limite.
 */

export const DECLENCHEURS = [
  'BRUT',
  'LOGIQUE',
  'CORRUPTION',
  'SOIN',
  'DEPLACE',
  'MARQUE',
  'ZONE',
  'FIN',
  'PARE',
  'CYCLE',
]

export const MODULES = [
  // --- Passifs : un chiffre, tout le temps -------------------------------------
  { id: 'md_plaque', nom: 'PLAQUE', dit: '+3 de blindage', famille: 'coque', blindage: 3 },
  {
    id: 'md_masse',
    nom: 'MASSE INERTE',
    dit: '+12 d’intégrité maximale, −1 de vitesse',
    famille: 'coque',
    pvMax: 12,
    vit: -1,
  },
  {
    id: 'md_alliage',
    nom: 'ALLIAGE LÉGER',
    dit: '+2 de vitesse, −4 d’intégrité maximale',
    famille: 'coque',
    vit: 2,
    pvMax: -4,
  },
  { id: 'md_noyaudur', nom: 'NOYAU DUR', dit: '+2 de puissance', famille: 'calcul', puiss: 2 },
  { id: 'md_horloge', nom: 'HORLOGE FINE', dit: '+3 de vitesse', famille: 'calcul', vit: 3 },
  { id: 'md_reserve', nom: 'RÉSERVE', dit: '+8 d’intégrité maximale', famille: 'coque', pvMax: 8 },

  // --- Greffons : ils modifient un tag ------------------------------------------
  {
    id: 'md_percant',
    nom: 'PERÇANT',
    dit: 'les compétences BRUT ignorent le rang',
    famille: 'portee',
    greffe: { tag: 'BRUT', perce: true },
  },
  {
    id: 'md_diffus',
    nom: 'DIFFUSEUR',
    dit: 'les compétences ZONE frappent 20 % plus fort',
    famille: 'portee',
    greffe: { tag: 'ZONE', mult: 0.2 },
  },
  {
    id: 'md_scalpel',
    nom: 'SCALPEL',
    dit: 'les compétences LOGIQUE frappent 25 % plus fort',
    famille: 'lame',
    greffe: { tag: 'LOGIQUE', mult: 0.25 },
  },
  {
    id: 'md_gangrene',
    nom: 'GANGRÈNE',
    dit: 'les fuites posées durent une pile de plus',
    famille: 'lame',
    greffe: { tag: 'CORRUPTION', fuite: 2 },
  },
  {
    id: 'md_marteau',
    nom: 'MARTEAU',
    dit: 'les compétences BRUT frappent 25 % plus fort',
    famille: 'lame',
    greffe: { tag: 'BRUT', mult: 0.25 },
  },

  // --- Déclenchés : ils écoutent le bus de tags -----------------------------------
  {
    id: 'md_moisson',
    nom: 'MOISSON',
    dit: 'chaque MARQUE posée rend 1 cycle',
    famille: 'economie',
    ecoute: 'MARQUE',
    cycles: 1,
  },
  {
    id: 'md_relance',
    nom: 'RELANCE',
    dit: 'chaque FIN rend 1 cycle',
    famille: 'economie',
    ecoute: 'FIN',
    cycles: 1,
  },
  {
    id: 'md_sillage',
    nom: 'SILLAGE',
    dit: 'chaque DÉPLACE donne 6 de pare-feu au porteur',
    famille: 'garde',
    ecoute: 'DEPLACE',
    pare: 6,
  },
  {
    id: 'md_rempart',
    nom: 'REMPART',
    dit: 'chaque ZONE donne 5 de pare-feu à toute l’équipe',
    famille: 'garde',
    ecoute: 'ZONE',
    pareEquipe: 5,
  },
  {
    id: 'md_transfusion',
    nom: 'TRANSFUSION',
    dit: 'chaque SOIN rend aussi 4 d’intégrité au porteur',
    famille: 'garde',
    ecoute: 'SOIN',
    soinSoi: 4,
  },
  {
    id: 'md_echo',
    nom: 'ÉCHO',
    dit: 'chaque CORRUPTION pose une MARQUE',
    famille: 'traque',
    ecoute: 'CORRUPTION',
    marque: 1,
  },
  {
    id: 'md_traceur',
    nom: 'TRACEUR',
    dit: 'chaque BRUT pose une MARQUE',
    famille: 'traque',
    ecoute: 'BRUT',
    marque: 1,
  },
  {
    id: 'md_dissipe',
    nom: 'DISSIPATEUR',
    dit: 'chaque PARE fait redescendre le traçage de 5',
    famille: 'discretion',
    ecoute: 'PARE',
    tracage: -5,
  },
  {
    id: 'md_masque',
    nom: 'MASQUE',
    dit: 'le traçage monte 30 % moins vite',
    famille: 'discretion',
    tracageMult: 0.7,
  },
  {
    id: 'md_surtension',
    nom: 'SURTENSION',
    dit: '+1 cycle maximum, le traçage monte 30 % plus vite',
    famille: 'discretion',
    cyclesMax: 1,
    tracageMult: 1.3,
  },

  // --- Deuxième vague -------------------------------------------------------
  {
    id: 'md_carenage',
    nom: 'CARÉNAGE',
    dit: '+5 de blindage, −2 de vitesse',
    famille: 'coque',
    blindage: 5,
    vit: -2,
  },
  {
    id: 'md_amorce',
    nom: 'AMORCE VIVE',
    dit: '+4 de vitesse, −2 de blindage',
    famille: 'coque',
    blindage: -2,
    vit: 4,
  },
  {
    id: 'md_noyaufroid',
    nom: 'NOYAU FROID',
    dit: '+3 de puissance, −3 de vitesse',
    famille: 'calcul',
    vit: -3,
    puiss: 3,
  },
  {
    id: 'md_courtcircuit',
    nom: 'CIRCUIT COURT',
    dit: '+2 cycles maximum, −8 d’intégrité maximale',
    famille: 'economie',
    pvMax: -8,
    cyclesMax: 2,
  },
  {
    id: 'md_busetroit',
    nom: 'BUS ÉTROIT',
    dit: '−1 cycle maximum, +3 de blindage',
    famille: 'economie',
    blindage: 3,
    cyclesMax: -1,
  },
  {
    id: 'md_voilemate',
    nom: 'VOILE MATE',
    dit: 'le traçage monte 40 % moins vite, −2 de puissance',
    famille: 'discretion',
    puiss: -2,
    tracageMult: 0.6,
  },
  {
    id: 'md_sonde',
    nom: 'SONDE',
    dit: 'les compétences LOGIQUE ignorent le rang',
    famille: 'portee',
    greffe: { tag: 'LOGIQUE', perce: true },
  },
  {
    id: 'md_crochet',
    nom: 'CROCHET',
    dit: 'les compétences MARQUE ignorent le rang',
    famille: 'portee',
    greffe: { tag: 'MARQUE', perce: true },
  },
  {
    id: 'md_relais',
    nom: 'RELAIS',
    dit: 'les compétences DÉPLACE frappent 25 % plus fort',
    famille: 'portee',
    greffe: { tag: 'DEPLACE', mult: 0.25 },
  },
  {
    id: 'md_nappe',
    nom: 'NAPPE',
    dit: 'les compétences ZONE allongent les fuites de 2',
    famille: 'lame',
    greffe: { tag: 'ZONE', fuite: 2 },
  },
  {
    id: 'md_couperet',
    nom: 'COUPERET',
    dit: 'les compétences FIN frappent 35 % plus fort',
    famille: 'lame',
    greffe: { tag: 'FIN', mult: 0.35 },
  },
  {
    id: 'md_communion',
    nom: 'COMMUNION',
    dit: 'chaque PARE donne 4 de pare-feu à toute l’équipe',
    famille: 'garde',
    ecoute: 'PARE',
    pareEquipe: 4,
  },
  {
    id: 'md_carapace',
    nom: 'CARAPACE',
    dit: 'chaque PARE donne 12 de pare-feu au porteur seul',
    famille: 'garde',
    ecoute: 'PARE',
    pare: 12,
  },
  {
    id: 'md_reflux',
    nom: 'REFLUX',
    dit: 'chaque LOGIQUE rend 3 d’intégrité au porteur',
    famille: 'garde',
    ecoute: 'LOGIQUE',
    soinSoi: 3,
  },
  {
    id: 'md_curee',
    nom: 'CURÉE',
    dit: 'chaque FIN rend 6 d’intégrité au porteur',
    famille: 'garde',
    ecoute: 'FIN',
    soinSoi: 6,
  },
  {
    id: 'md_baume',
    nom: 'BAUME',
    dit: 'chaque SOIN rend 1 cycle',
    famille: 'economie',
    ecoute: 'SOIN',
    cycles: 1,
  },
  {
    id: 'md_curseur',
    nom: 'CURSEUR',
    dit: 'chaque DÉPLACE pose une MARQUE',
    famille: 'traque',
    ecoute: 'DEPLACE',
    marque: 1,
  },
  {
    id: 'md_metronome',
    nom: 'MÉTRONOME',
    dit: 'chaque CYCLE fait redescendre le traçage de 6',
    famille: 'discretion',
    ecoute: 'CYCLE',
    tracage: -6,
  },
]

export const MODULE = Object.fromEntries(MODULES.map((m) => [m.id, m]))

/**
 * Les paires antagonistes. Prendre l'un verrouille l'autre **pour la partie**,
 * pas seulement pour l'opérateur : sinon il suffirait de les répartir.
 */
export const ANTAGONISTES = [
  ['md_masse', 'md_alliage'],
  ['md_masque', 'md_surtension'],
  ['md_marteau', 'md_scalpel'],
  ['md_moisson', 'md_relance'],
  ['md_carenage', 'md_amorce'],
  ['md_courtcircuit', 'md_busetroit'],
  ['md_communion', 'md_carapace'],
  ['md_couperet', 'md_metronome'],
]

export const oppose = (id) => {
  const paire = ANTAGONISTES.find((p) => p.includes(id))
  return paire ? paire.find((x) => x !== id) : null
}

export const COULEUR_FAMILLE = {
  coque: C.vert,
  calcul: C.cyan,
  portee: C.accent,
  lame: C.rouge,
  economie: C.accent,
  garde: C.vert,
  traque: C.violet,
  discretion: C.cyan,
}

export const EMPLACEMENTS_MODULE = 3
