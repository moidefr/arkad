/**
 * Toute la règle du VIVIER, sans une ligne de dessin ni un seul son.
 *
 * Le hasard vient toujours du moteur (`hasard()` passé en paramètre), jamais
 * de `Math.random` — c'est ce qui permet de rejouer un bassin à l'identique
 * en test, et ce qui permet à `vivier-banc.mjs` de mesurer plutôt que de
 * deviner combien de temps prend une collection.
 */
import {
  TRAITS,
  FONDATEURS,
  CAPACITE,
  CYCLE_LENT,
  CYCLE_RAPIDE,
  COUT_PONTE,
  NOURRITURE_MAX,
  NOURRIR_GAIN,
  REGEN_NOURRITURE,
  CREDIT_MAX,
} from './donnees.js'

export const VERSION = 1
export const TOTAL_COMBOS = TRAITS.reduce((p, t) => p * t.valeurs.length, 1)

const nombreSur = (v, defaut = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : defaut)

// --- Génotype et phénotype ----------------------------------------------------------

/** Un allèle valide pour ce gène : un entier dans les bornes de la table. */
function alleleSain(v, n) {
  return Number.isInteger(v) && v >= 0 && v < n ? v : 0
}

function genotypeSain(g) {
  const sortie = {}
  for (const t of TRAITS) {
    const paire = g && Array.isArray(g[t.cle]) ? g[t.cle] : []
    sortie[t.cle] = [alleleSain(paire[0], t.valeurs.length), alleleSain(paire[1], t.valeurs.length)]
  }
  return sortie
}

function genotypeFondateur(f) {
  const g = {}
  for (const t of TRAITS) g[t.cle] = [...f[t.cle]]
  return g
}

/** Le phénotype : pour chaque gène, l'allèle de rang le plus dominant porté. */
export function phenotype(genotype) {
  return TRAITS.map((t) => t.valeurs[Math.min(genotype[t.cle][0], genotype[t.cle][1])].id)
}

export const comboId = (phen) => phen.join('|')

/**
 * La combinaison numéro `indice` (0 à `TOTAL_COMBOS - 1`), dans un ordre fixe
 * et déterministe — c'est ce qui permet à la grille de collection de garder
 * toujours la même case pour la même combinaison, d'une image à l'autre.
 */
export function comboDeIndex(indice) {
  let reste = indice
  const phen = new Array(TRAITS.length)
  for (let k = TRAITS.length - 1; k >= 0; k--) {
    const n = TRAITS[k].valeurs.length
    phen[k] = TRAITS[k].valeurs[reste % n].id
    reste = Math.floor(reste / n)
  }
  return phen
}

function comboValide(id) {
  if (typeof id !== 'string') return false
  const parts = id.split('|')
  return parts.length === TRAITS.length && TRAITS.every((t, i) => t.valeurs.some((v) => v.id === parts[i]))
}

/** Ajoute au registre si c'est neuf. Renvoie l'id découvert, ou `null`. */
function decouvre(e, phen) {
  const id = comboId(phen)
  if (e.decouvertes.includes(id)) return null
  e.decouvertes.push(id)
  return id
}

// --- État --------------------------------------------------------------------------

/** Un bassin neuf : les fondatrices, et leurs combinaisons déjà connues. */
export function neuf() {
  const bassin = FONDATEURS.map((f, i) => ({ id: i, genotype: genotypeFondateur(f), naissance: 0 }))
  const e = {
    v: VERSION,
    bassin,
    suivant: bassin.length,
    curseur: 0,
    decouvertes: [],
    naissances: bassin.length,
    nourriture: 0,
    minuterie: CYCLE_LENT,
    temps: 0,
    quand: 0,
  }
  for (const c of bassin) decouvre(e, phenotype(c.genotype))
  return e
}

/**
 * `null` si la sauvegarde n'est pas de ce format, ou si le bassin est trop
 * abîmé pour repartir (moins de deux créatures) — plutôt que de deviner ses
 * champs manquants, on repart à neuf.
 */
export function migre(brut) {
  if (!brut || brut.v !== VERSION) return null
  const bassin = Array.isArray(brut.bassin)
    ? brut.bassin
        .filter((c) => c && typeof c === 'object')
        .map((c) => ({ id: Math.floor(nombreSur(c.id)), genotype: genotypeSain(c.genotype), naissance: nombreSur(c.naissance) }))
    : []
  if (bassin.length < 2) return null

  return {
    v: VERSION,
    bassin,
    suivant: Math.max(Math.floor(nombreSur(brut.suivant)), ...bassin.map((c) => c.id)) + 1,
    curseur: Math.max(0, Math.floor(nombreSur(brut.curseur))),
    decouvertes: Array.isArray(brut.decouvertes) ? [...new Set(brut.decouvertes.filter(comboValide))] : [],
    naissances: Math.max(bassin.length, Math.floor(nombreSur(brut.naissances, bassin.length))),
    nourriture: Math.max(0, Math.min(NOURRITURE_MAX, nombreSur(brut.nourriture))),
    minuterie: Math.max(0, nombreSur(brut.minuterie, CYCLE_LENT)) || CYCLE_LENT,
    temps: Math.max(0, nombreSur(brut.temps)),
    quand: nombreSur(brut.quand),
  }
}

export const sauvegarde = (e) => ({
  v: VERSION,
  bassin: e.bassin.map((c) => ({ id: c.id, genotype: c.genotype, naissance: c.naissance })),
  suivant: e.suivant,
  curseur: e.curseur,
  decouvertes: e.decouvertes,
  naissances: e.naissances,
  nourriture: e.nourriture,
  minuterie: e.minuterie,
  temps: e.temps,
  quand: Date.now(),
})

// --- Croisement ----------------------------------------------------------------------

/** L'allèle transmis pour un gène : l'un des deux, au hasard, indépendamment des autres gènes. */
function alleleTransmis(genotype, cle, hasard) {
  const paire = genotype[cle]
  return paire[hasard() < 0.5 ? 0 : 1]
}

/** Le génotype d'un enfant : un allèle de chaque parent, gène par gène. */
export function croise(a, b, hasard) {
  const g = {}
  for (const t of TRAITS) g[t.cle] = [alleleTransmis(a.genotype, t.cle, hasard), alleleTransmis(b.genotype, t.cle, hasard)]
  return g
}

/** Deux parents distincts, tirés dans le bassin. */
function choisirParents(bassin, hasard) {
  const i = Math.floor(hasard() * bassin.length)
  let k = Math.floor(hasard() * (bassin.length - 1))
  if (k >= i) k++
  return [bassin[i], bassin[k]]
}

/**
 * Une ponte : deux créatures du bassin se croisent, l'enfant naît. Les
 * fondatrices (les `FONDATEURS.length` premières places) ne sont jamais
 * remplacées ; passé `CAPACITE`, la naissance suivante prend la place de la
 * plus ancienne des autres, en boucle — un bassin qui vit, pas qui déborde.
 */
export function ponte(e, hasard, ev = {}) {
  if (e.bassin.length < 2) return null
  const [a, b] = choisirParents(e.bassin, hasard)
  const genotype = croise(a, b, hasard)
  const enfant = { id: e.suivant++, genotype, naissance: e.temps }
  const phen = phenotype(genotype)

  if (e.bassin.length < CAPACITE) e.bassin.push(enfant)
  else {
    const fixes = FONDATEURS.length
    const slot = fixes + (e.curseur % (CAPACITE - fixes))
    e.curseur++
    e.bassin[slot] = enfant
  }
  e.naissances++

  ev.ne = enfant
  ev.phenotype = phen
  ev.decouverte = decouvre(e, phen)
  return enfant
}

// --- Nourriture et temps --------------------------------------------------------------

/** Un appui du joueur : un geste simple, jamais nécessaire, jamais urgent. */
export function nourrir(e) {
  if (e.nourriture >= NOURRITURE_MAX) return false
  e.nourriture = Math.min(NOURRITURE_MAX, e.nourriture + NOURRIR_GAIN)
  return true
}

/**
 * Une image de jeu. La nourriture se régénère doucement toute seule ; quand
 * la minuterie tombe à zéro, une ponte se déclenche et consomme une unité de
 * nourriture si elle en trouve — ce qui raccourcit le cycle suivant.
 */
export function avance(e, dt, hasard, ev = {}) {
  e.temps += dt
  e.nourriture = Math.min(NOURRITURE_MAX, e.nourriture + dt * REGEN_NOURRITURE)
  e.minuterie -= dt
  if (e.minuterie > 0) return ev

  const rapide = e.nourriture >= COUT_PONTE
  if (rapide) e.nourriture -= COUT_PONTE
  ponte(e, hasard, ev)
  e.minuterie += rapide ? CYCLE_RAPIDE : CYCLE_LENT
  ev.rapide = rapide
  return ev
}

/**
 * Le crédit d'absence : on saute directement d'une ponte à la suivante au
 * lieu de simuler seconde par seconde une absence qui peut durer des jours.
 * Une horloge reculée ne crédite rien — ce serait la triche la plus facile.
 */
export function credite(e, maintenant, hasard) {
  const depuis = e.quand
  e.quand = maintenant
  if (!depuis || maintenant <= depuis) return { naissances: 0, decouvertes: 0 }

  let ecoule = Math.min(CREDIT_MAX, (maintenant - depuis) / 1000)
  const avantNaissances = e.naissances
  const avantDecouvertes = e.decouvertes.length

  let garde = 0
  while (ecoule > 0 && garde++ < 20000) {
    const pas = Math.min(ecoule, Math.max(0, e.minuterie))
    avance(e, pas, hasard)
    ecoule -= pas
  }
  return { naissances: e.naissances - avantNaissances, decouvertes: e.decouvertes.length - avantDecouvertes }
}
