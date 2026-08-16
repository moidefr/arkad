import { C } from '../../palette.js'

/**
 * Les tables du VIVIER. Rien ici ne dessine ni ne lance de dé — c'est
 * `logique.js` qui décide, avec un hasard qui vient toujours du moteur.
 *
 * Quatre gènes, chacun avec ses allèles rangés **du plus dominant (index 0)
 * au plus récessif (dernier index)** : le phénotype d'une créature, pour un
 * gène donné, est toujours l'allèle de plus petit index qu'elle porte. Un
 * allèle récessif ne disparaît jamais — il se cache derrière un dominant,
 * porté sans se voir, prêt à ressortir le jour où deux porteurs se
 * croisent. C'est tout le moteur génétique du jeu, volontairement simple :
 * pas de liaison entre gènes, pas de mutation, deux allèles par gène.
 *
 * **Règle d'ajout seul** : on n'enlève jamais une valeur et on ne réordonne
 * jamais un rang de dominance. Une sauvegarde stocke des index d'allèle ; les
 * bouger, c'est changer le sens d'une créature déjà née.
 */
export const TRAITS = [
  {
    cle: 'couleur',
    nom: 'ROBE',
    valeurs: [
      { id: 'ambre', nom: 'AMBRE', couleur: C.accent },
      { id: 'violette', nom: 'VIOLETTE', couleur: C.violet },
      { id: 'cyan', nom: 'CYAN', couleur: C.cyan },
      { id: 'verte', nom: 'VERTE', couleur: C.vert },
    ],
  },
  {
    cle: 'forme',
    nom: 'SILHOUETTE',
    valeurs: [
      { id: 'ronde', nom: 'RONDE' },
      { id: 'anguleuse', nom: 'ANGULEUSE' },
      { id: 'elancee', nom: 'ÉLANCÉE' },
    ],
  },
  {
    cle: 'motif',
    nom: 'MOTIF',
    valeurs: [
      { id: 'uni', nom: 'UNI' },
      { id: 'tachete', nom: 'TACHETÉ' },
      { id: 'raye', nom: 'RAYÉ' },
    ],
  },
  {
    cle: 'taille',
    nom: 'GABARIT',
    valeurs: [
      { id: 'grand', nom: 'GRAND', echelle: 1 },
      { id: 'moyen', nom: 'MOYEN', echelle: 0.78 },
      { id: 'petit', nom: 'PETIT', echelle: 0.58 },
    ],
  },
]

/**
 * Les créatures fondatrices du bassin. Chacune porte une paire d'allèles par
 * gène (indices dans `TRAITS[i].valeurs`) — jamais sa seule apparence.
 *
 * Choisies pour que **chaque allèle de chaque gène** soit porté par au moins
 * une fondatrice : c'est ce qui garantit que rien dans la collection n'est
 * inatteignable par construction (`vivier-banc.mjs` le mesure, le test de
 * cohérence le vérifie). Elles restent au bassin pour toujours — voir
 * `CAPACITE` — pour que ce réservoir d'allèles ne s'éteigne jamais.
 */
export const FONDATEURS = [
  { couleur: [0, 1], forme: [0, 1], motif: [0, 1], taille: [0, 1] },
  { couleur: [2, 3], forme: [2, 0], motif: [2, 0], taille: [2, 0] },
  { couleur: [1, 2], forme: [1, 2], motif: [1, 2], taille: [1, 2] },
  { couleur: [3, 0], forme: [0, 2], motif: [0, 2], taille: [0, 2] },
]

/**
 * Taille du bassin actif. Les fondatrices (voir ci-dessus) occupent les
 * premières places pour toujours ; le reste tourne, la naissance la plus
 * ancienne cédant sa place à la suivante — un bassin qui vit, pas un musée.
 */
export const CAPACITE = 16

/**
 * Le rythme des pontes, en secondes. Sans nourriture en réserve, le bassin
 * ponde lentement mais ne s'arrête jamais — c'est ce qui fait tourner le jeu
 * hors ligne. Avec de la nourriture, le cycle est presque quatre fois plus
 * court : nourrir accélère, sans jamais être nécessaire.
 */
export const CYCLE_LENT = 900 // 15 minutes
export const CYCLE_RAPIDE = 240 // 4 minutes

export const COUT_PONTE = 1 // nourriture consommée par une ponte accélérée
export const NOURRITURE_MAX = 6
export const NOURRIR_GAIN = 2 // ce que rapporte un appui sur NOURRIR
/**
 * Régénération passive : une unité toutes les demi-heures.
 *
 * Assez lente pour qu'un bassin livré à lui-même ponde surtout au rythme
 * lent (`CYCLE_LENT`), avec un coup de rapide de temps en temps ; assez
 * rapide tout de même pour qu'une absence ne soit jamais figée. Mesuré au
 * banc : une régénération plus généreuse (une unité toutes les trois
 * minutes) suffisait à elle seule à maintenir le cycle rapide en permanence,
 * et nourrir activement ne changeait plus rien — voir `vivier-banc.mjs`.
 */
export const REGEN_NOURRITURE = 1 / 1800

/**
 * Le crédit hors ligne est plafonné à trois jours : au-delà, la borne aurait
 * simulé des dizaines de milliers de pontes d'un coup pour une absence qui,
 * de toute façon, ne se reproduit pas tous les jours.
 */
export const CREDIT_MAX = 3 * 24 * 3600

export const TOTAL_COMBOS = TRAITS.reduce((p, t) => p * t.valeurs.length, 1)

/** Colonnes de la grille de collection — 108 combinaisons, douze par ligne. */
export const COLONNES_GRILLE = 12
