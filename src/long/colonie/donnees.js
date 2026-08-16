import { C } from '../../palette.js'

/**
 * Les tables de COLONIE : un réseau de ressources qui se nourrissent l'une
 * l'autre, pas une chaîne linéaire comme l'USINE.
 *
 * Rien ici ne lance de dé ni ne touche à un canvas — `logique.js` est seul à
 * décider, avec un hasard qui vient toujours du moteur.
 *
 * **Règle d'ajout seul** (comme dans `usine/donnees.js`) : on n'enlève jamais
 * une entrée de `BATIMENTS`, on ne réordonne jamais. Une sauvegarde stocke des
 * comptes par indice ; les bouger, c'est corrompre les colonies en cours.
 *
 * L'ordre de la table **compte** aussi pour la résolution d'un tour
 * (`logique.avance`) : elle est parcourue dans cet ordre, donc un bâtiment
 * placé avant un autre lui livre ses extrants dans le même tour. L'ATELIER
 * (4) tourne avant la FERME (5) pour cette raison : les outils du tour
 * nourrissent la ferme du même tour, plutôt que d'attendre le suivant.
 */

export const RESSOURCES = [
  { cle: 'nourriture', nom: 'NOURRITURE', couleur: C.vert },
  { cle: 'bois', nom: 'BOIS', couleur: C.accent },
  { cle: 'pierre', nom: 'PIERRE', couleur: C.cyan },
  { cle: 'outils', nom: 'OUTILS', couleur: C.violet },
]

/**
 * L'état de départ : une réserve de nourriture volontairement large.
 *
 * Un seul CAMPEMENT ne nourrit pas tout à fait les quatre premiers
 * habitants (voir son commentaire plus bas) : la réserve doit couvrir ce
 * déficit le temps qu'un deuxième bâtiment producteur arrive, sans quoi la
 * toute première minute de jeu joue une famine dont l'issue dépend d'un tirage
 * — réglé au banc, un joueur ne devrait jamais perdre sa colonie avant
 * d'avoir eu la moindre chance de réagir.
 */
export const DEPART = { nourriture: 45, bois: 25, pierre: 15, outils: 0, population: 4 }

/** La capacité de logement avant toute HUTTE construite — le campement de départ. */
export const LOGEMENT_DEPART = 4

/**
 * Ce qu'il faut de population pour ouvrir chaque palier de bâtiments.
 * Un palier ne se débloque jamais par un chronomètre : c'est la population
 * elle-même, la ressource la plus dure à obtenir, qui sert de verrou — un
 * joueur affamé ne peut pas rattraper son retard en attendant simplement.
 */
export const PALIERS = { 1: 9, 2: 24 }
export const NOMS_PALIER = ['DÉPART', 'ESSOR', 'EXPANSION']

/**
 * Les onze bâtiments de la colonie, en trois paliers.
 *
 * `postes` : combien d'habitants une instance occupe à plein régime.
 * `logement` : la capacité de population qu'il ajoute (0 pour les autres).
 * `consomme`/`produit` : quantité par seconde et par instance, à couverture
 * pleine (voir `couverture()` dans `logique.js`) — jamais de valeur en dur
 * ailleurs que dans `avance()`.
 * `coutBase`/`coutTaux` : le prix de la prochaine instance grandit comme
 * dans l'USINE, `coutBase * coutTaux ^ n`.
 */
export const BATIMENTS = [
  // --- Palier 0 : ce qu'on peut bâtir dès la première minute -----------------
  {
    id: 'campement',
    nom: 'CAMPEMENT',
    dit: 'cueillette et petit gibier',
    palier: 0,
    postes: 1,
    logement: 0,
    consomme: {},
    produit: { nourriture: 0.26 },
    coutBase: { bois: 22 },
    coutTaux: 1.16,
    couleur: C.vert,
  },
  {
    id: 'bucheron',
    nom: 'BÛCHERON',
    dit: 'coupe le bois de la lisière',
    palier: 0,
    postes: 1,
    logement: 0,
    consomme: {},
    produit: { bois: 0.3 },
    coutBase: { pierre: 12 },
    coutTaux: 1.16,
    couleur: C.accent,
  },
  {
    id: 'carriere',
    nom: 'CARRIÈRE',
    dit: 'extrait la pierre à la main',
    palier: 0,
    postes: 1,
    logement: 0,
    consomme: {},
    produit: { pierre: 0.22 },
    coutBase: { bois: 22 },
    coutTaux: 1.16,
    couleur: C.cyan,
  },
  {
    id: 'hutte',
    nom: 'HUTTE',
    dit: 'loge trois habitants de plus',
    palier: 0,
    postes: 0,
    logement: 3,
    consomme: {},
    produit: {},
    coutBase: { bois: 32 },
    coutTaux: 1.24,
    couleur: C.faible,
  },
  // --- Palier 1 : dès neuf habitants -------------------------------------------
  {
    id: 'atelier',
    nom: 'ATELIER',
    dit: 'bois et pierre en outils',
    palier: 1,
    postes: 2,
    logement: 0,
    consomme: { bois: 0.35, pierre: 0.25 },
    produit: { outils: 0.28 },
    coutBase: { bois: 48, pierre: 36 },
    coutTaux: 1.19,
    couleur: C.violet,
  },
  {
    id: 'ferme',
    nom: 'FERME',
    dit: 'des outils pour de vraies récoltes',
    palier: 1,
    postes: 2,
    logement: 0,
    consomme: { outils: 0.2 },
    produit: { nourriture: 2.0 },
    coutBase: { bois: 48, outils: 10 },
    coutTaux: 1.19,
    couleur: C.vert,
  },
  {
    id: 'maison',
    nom: 'MAISON',
    dit: 'loge six habitants de plus',
    palier: 1,
    postes: 0,
    logement: 6,
    consomme: {},
    produit: {},
    coutBase: { bois: 65, pierre: 48 },
    coutTaux: 1.26,
    couleur: C.faible,
  },
  // --- Palier 2 : dès vingt-quatre habitants ------------------------------------
  {
    id: 'carriereProfonde',
    nom: 'CARRIÈRE PROFONDE',
    dit: 'des outils pour creuser plus bas',
    palier: 2,
    postes: 2,
    logement: 0,
    consomme: { outils: 0.12 },
    produit: { pierre: 0.65 },
    coutBase: { bois: 95, outils: 22 },
    coutTaux: 1.22,
    couleur: C.cyan,
  },
  {
    id: 'forge',
    nom: 'FORGE',
    dit: 'des outils en plus grand nombre',
    palier: 2,
    postes: 3,
    logement: 0,
    consomme: { bois: 0.45, pierre: 0.45 },
    produit: { outils: 0.95 },
    coutBase: { bois: 140, pierre: 140 },
    coutTaux: 1.22,
    couleur: C.violet,
  },
  {
    id: 'grandeFerme',
    nom: 'GRANDE FERME',
    dit: 'des champs entiers, bien outillés',
    palier: 2,
    postes: 3,
    logement: 0,
    consomme: { outils: 0.32 },
    produit: { nourriture: 4.0 },
    coutBase: { bois: 115, outils: 42 },
    coutTaux: 1.22,
    couleur: C.vert,
  },
  {
    id: 'place',
    nom: 'PLACE',
    dit: 'loge douze habitants de plus',
    palier: 2,
    postes: 0,
    logement: 12,
    consomme: {},
    produit: {},
    coutBase: { bois: 180, pierre: 140 },
    coutTaux: 1.28,
    couleur: C.faible,
  },
]

// --- Rythme de la population -------------------------------------------------

/** Ce qu'un habitant mange par seconde. */
export const CONSO_HABITANT = 0.11

/** Combien de postes un habitant couvre, à pleine forme. */
export const RENDEMENT_HABITANT = 1

/**
 * Vitesse à laquelle la population comble l'écart avec ses logements — une
 * fraction de l'écart par seconde, pas un compte à rebours fixe : plus les
 * logements sont loin devant, plus la colonie grandit vite dans l'absolu,
 * et la croissance ralentit d'elle-même en approchant du plafond.
 *
 * Réglé au banc : plus haut, une colonie bien nourrie remplissait ses
 * logements en quelques minutes et le jeu n'avait plus rien à offrir passé
 * la première demi-heure.
 */
export const TAUX_CROISSANCE = 0.0022

/**
 * La famine coûte des habitants par deux voies à la fois : une part
 * proportionnelle à la population (une grande colonie perd plus de monde
 * dans l'absolu) et une part fixe (sans elle, une colonie de trois habitants
 * ne meurt jamais tout à fait — la décroissance proportionnelle seule
 * s'approche de zéro sans jamais l'atteindre).
 */
export const TAUX_FAMINE_PROP = 0.012
export const TAUX_FAMINE_ABS = 0.04

/**
 * Une famine qui dure finit par coûter un bâtiment, pas seulement des
 * habitants : les tuiles quittent leur poste, l'outil rouille, la ferme
 * retourne en friche. C'est ce qui rend une négligence prolongée bien plus
 * chère qu'une simple pénurie passagère.
 */
export const FAMINE_SEUIL_ABANDON = 45

/** Le crédit d'absence, borné comme dans l'USINE — douze heures, pas plus. */
export const HORS_LIGNE_MAX_S = 12 * 3600
export const PAS_HORSLIGNE = 20
