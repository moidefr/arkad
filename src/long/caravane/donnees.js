import { C } from '../../palette.js'

/**
 * Tout le contenu de CARAVANE, en tables — comme dans `usine/donnees.js`,
 * rien ici n'importe de quoi dessiner ni de quoi jouer un son, et rien ne
 * lance de dé. C'est ce qui permet de rejouer mille trajets en une seconde
 * sous `node --test` plutôt que de deviner l'équilibre.
 *
 * **Règle d'ajout seul** : on n'enlève jamais une entrée, on ne réordonne
 * jamais `MARCHANDISES` ni `MARCHES`. Une sauvegarde stocke des indices dans
 * ces deux tables (`cargaison[g]`, `ecarts[i][g]`, `marche`) ; les bouger,
 * c'est corrompre les parties en cours.
 */

const TEINTES = [C.cyan, C.vert, C.accent, C.violet, C.rouge, C.faible, C.cyan]

/**
 * Sept marchandises. `ref` est le prix de référence — celui vers lequel un
 * marché dérive quand plus personne n'y touche. `volat` est le cran dont
 * l'écart local bouge à chaque unité échangée : haut, un petit lot suffit à
 * faire grimper le prix ; bas, il faut acheter en gros pour le sentir.
 */
export const MARCHANDISES = [
  { id: 'sel', nom: 'SEL', ref: 6, volat: 0.016, couleur: TEINTES[0] },
  { id: 'bois', nom: 'BOIS', ref: 9, volat: 0.015, couleur: TEINTES[1] },
  { id: 'the', nom: 'THÉ', ref: 16, volat: 0.013, couleur: TEINTES[2] },
  { id: 'metal', nom: 'MÉTAL', ref: 28, volat: 0.012, couleur: TEINTES[3] },
  { id: 'soie', nom: 'SOIE', ref: 46, volat: 0.01, couleur: TEINTES[4] },
  { id: 'encens', nom: 'ENCENS', ref: 34, volat: 0.0105, couleur: TEINTES[5] },
  { id: 'epices', nom: 'ÉPICES', ref: 52, volat: 0.009, couleur: TEINTES[6] },
]

/**
 * Neuf marchés. `mult` — dans l'ordre de `MARCHANDISES` — est le multiplicateur
 * *permanent* du prix de référence local : c'est lui qui fait qu'un marché
 * produit une chose et en manque une autre, et c'est lui qui rend un trajet
 * intéressant même quand les écarts de conjoncture (voir `ecarts` dans
 * `logique.js`) sont retombés à plat. `x`/`y` positionnent le marché sur la
 * carte, en fraction de l'écran — jamais en pixels, pour rester indépendant
 * du gabarit.
 */
export const MARCHES = [
  { id: 'port-sel', nom: 'PORT-SEL', x: 0.1, y: 0.78, mult: [0.45, 1.3, 1.4, 1.5, 1.6, 1.3, 1.7] },
  { id: 'grisonne', nom: 'GRISONNE', x: 0.24, y: 0.34, mult: [1.3, 0.5, 1.2, 1.1, 1.6, 1.4, 1.7] },
  { id: 'valdor', nom: 'VALDOR', x: 0.42, y: 0.12, mult: [1.4, 1.2, 1.5, 0.5, 1.7, 1.6, 1.8] },
  { id: 'citadelle', nom: 'LA CITADELLE', x: 0.5, y: 0.46, mult: [1.0, 1.0, 1.0, 1.0, 1.1, 1.0, 1.1] },
  { id: 'oasis-verte', nom: 'OASIS-VERTE', x: 0.64, y: 0.72, mult: [1.2, 1.3, 0.55, 1.3, 1.5, 0.8, 1.3] },
  { id: 'kharabad', nom: 'KHARABAD', x: 0.82, y: 0.5, mult: [1.5, 1.5, 1.3, 1.4, 0.5, 0.6, 0.6] },
  { id: 'source-bleue', nom: 'SOURCE-BLEUE', x: 0.36, y: 0.88, mult: [0.8, 1.1, 1.2, 1.6, 1.5, 1.4, 1.6] },
  { id: 'cardamone', nom: 'CARDAMONE', x: 0.92, y: 0.22, mult: [1.6, 1.6, 1.4, 1.7, 1.3, 1.2, 0.45] },
  { id: 'noirval', nom: 'NOIRVAL', x: 0.14, y: 0.55, mult: [1.1, 0.7, 1.3, 1.2, 1.5, 1.5, 1.6] },
]

/**
 * Le graphe : pas une ligne, un réseau — LA CITADELLE (5 routes) en carrefour,
 * NOIRVAL et CARDAMONE en impasses relatives (2). `duree` est en secondes de
 * jeu réel (le temps s'écoule que la borne soit ouverte ou non, voir
 * `credite()`), `risque` la probabilité qu'un incident (vol ou taxe) frappe à
 * l'arrivée.
 */
export const ROUTES = [
  { a: 0, b: 1, duree: 240, risque: 0.04 },
  { a: 0, b: 6, duree: 200, risque: 0.03 },
  { a: 0, b: 8, duree: 160, risque: 0.02 },
  { a: 1, b: 8, duree: 150, risque: 0.03 },
  { a: 1, b: 2, duree: 320, risque: 0.07 },
  { a: 1, b: 3, duree: 260, risque: 0.04 },
  { a: 2, b: 3, duree: 300, risque: 0.06 },
  { a: 3, b: 4, duree: 280, risque: 0.05 },
  { a: 3, b: 5, duree: 360, risque: 0.08 },
  { a: 3, b: 6, duree: 300, risque: 0.05 },
  { a: 4, b: 5, duree: 240, risque: 0.06 },
  { a: 4, b: 6, duree: 200, risque: 0.04 },
  { a: 5, b: 7, duree: 300, risque: 0.07 },
  // Le raccourci de montagne : le seul lien direct entre VALDOR et CARDAMONE,
  // deux marchés qui se manquent l'un l'autre (métal et épices) — long, et le
  // plus risqué du réseau.
  { a: 2, b: 7, duree: 480, risque: 0.12 },
]

// --- Économie et flotte --------------------------------------------------------

export const ARGENT_DEPART = 150

/** Bornes de l'écart de conjoncture : un marché ne s'assèche ni ne s'inonde. */
export const ECART_MIN = 0.4
export const ECART_MAX = 2.2

/**
 * Demi-vie de l'écart, en secondes : le temps pour qu'un prix chahuté revienne
 * à mi-chemin de son niveau normal. Réglé au banc — plus court, une conjoncture
 * ne dure pas assez pour qu'un aller-retour vaille le coup ; plus long, le
 * premier passage sur un marché l'épuise pour de bon.
 */
export const DEMI_VIE_ECART = 420

export const CAPACITE_PAR_CHARRETTE = 20
export const COUT_CHARRETTE_BASE = 400
export const COUT_CHARRETTE_TAUX = 1.45

/**
 * L'entretien de la flotte coûte cher **tout le temps**, en route comme au
 * marché — c'est ce qui rend une charrette inactive une dépense et pas
 * seulement un plafond de capacité qu'on relève une fois pour toutes.
 */
export const ENTRETIEN_PAR_CHARRETTE = 0.012

/** Dette au-delà de laquelle le créancier reprend une charrette et la moitié du chargement. */
export const SEUIL_BANQUEROUTE = 200

export const FRACTION_VOL = 0.35
export const FRACTION_TAXE = 0.25

/**
 * Le courtier prend sa part sur toute vente : sans elle, acheter puis
 * revendre aussitôt au même endroit serait à peu près blanc (l'écart
 * remonté par l'achat redescend exactement du même pas en vendant), ce qui
 * ferait un aller-retour instantané et sans risque. Avec elle, il faut que
 * le temps passe ou que le marché change pour que le commerce paie.
 */
export const FRAIS_VENTE = 0.04

/** Le crédit hors ligne est plafonné à deux jours : au-delà, ça ne change plus rien à mesurer. */
export const HORS_LIGNE_MAX = 172800

/** Unités achetées ou vendues par appui — un seul tap doit peser, pas égrener une unité à la fois. */
export const LOT_ECHANGE = 10
