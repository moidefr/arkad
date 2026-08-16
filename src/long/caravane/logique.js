import {
  MARCHANDISES,
  MARCHES,
  ROUTES,
  ARGENT_DEPART,
  ECART_MIN,
  ECART_MAX,
  DEMI_VIE_ECART,
  CAPACITE_PAR_CHARRETTE,
  COUT_CHARRETTE_BASE,
  COUT_CHARRETTE_TAUX,
  ENTRETIEN_PAR_CHARRETTE,
  SEUIL_BANQUEROUTE,
  FRACTION_VOL,
  FRACTION_TAXE,
  FRAIS_VENTE,
  HORS_LIGNE_MAX,
} from './donnees.js'

/**
 * Toute la règle de CARAVANE, sans une ligne de dessin ni un seul son.
 *
 * Le hasard vient toujours du moteur (`hasard()` passé en paramètre), jamais
 * de `Math.random` — c'est la convention déjà en place dans usine/breche/ruee/
 * expedition, et c'est ce qui rend un incident de trajet rejouable à
 * l'identique en test.
 */

export const VERSION = 1

// Facteur de décroissance par seconde, dérivé de la demi-vie : appliquer
// `Math.pow(DECAY, dt)` n'importe quel nombre de fois pour un total de `dt`
// secondes donne exactement le même résultat qu'un seul appel avec ce total —
// c'est ce qui rend le crédit hors ligne exact plutôt qu'une approximation.
const DECAY = Math.pow(0.5, 1 / DEMI_VIE_ECART)

// --- État ----------------------------------------------------------------------

export function neuf() {
  return {
    v: VERSION,
    marche: 3, // on démarre à LA CITADELLE, le carrefour du réseau
    argent: ARGENT_DEPART,
    cargaison: MARCHANDISES.map(() => 0),
    ecarts: MARCHES.map(() => MARCHANDISES.map(() => 1)),
    charrettes: 1,
    enRoute: null,
    dette: 0,
    jours: 0,
    voyages: 0,
    banqueroutes: 0,
    quand: 0,
  }
}

const nb = (v, defaut = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : defaut)

/**
 * `null` si la sauvegarde n'est pas de ce format — plutôt que de deviner ses
 * champs manquants, on repart à neuf (voir `usine/logique.js` et
 * `expedition/logique.js`, le même choix y est fait).
 */
export function migre(brut) {
  if (!brut || typeof brut !== 'object' || brut.v !== VERSION) return null
  const e = neuf()

  e.marche = Number.isInteger(brut.marche) && brut.marche >= 0 && brut.marche < MARCHES.length ? brut.marche : 0
  e.argent = Math.max(0, nb(brut.argent, ARGENT_DEPART))
  e.charrettes = Math.max(1, Math.floor(nb(brut.charrettes, 1)))
  e.dette = Math.max(0, nb(brut.dette))
  e.jours = Math.max(0, nb(brut.jours))
  e.voyages = Math.max(0, Math.floor(nb(brut.voyages)))
  e.banqueroutes = Math.max(0, Math.floor(nb(brut.banqueroutes)))
  e.quand = nb(brut.quand)

  if (Array.isArray(brut.cargaison)) {
    e.cargaison = MARCHANDISES.map((_, g) => Math.max(0, Math.floor(nb(brut.cargaison[g]))))
  }
  if (Array.isArray(brut.ecarts)) {
    e.ecarts = MARCHES.map((_, i) =>
      MARCHANDISES.map((_, g) => {
        const v = brut.ecarts[i]?.[g]
        return typeof v === 'number' && Number.isFinite(v) ? Math.min(ECART_MAX, Math.max(ECART_MIN, v)) : 1
      }),
    )
  }
  if (brut.enRoute && typeof brut.enRoute === 'object') {
    const r = brut.enRoute
    if (Number.isInteger(r.vers) && r.vers >= 0 && r.vers < MARCHES.length && Number.isFinite(r.restant)) {
      e.enRoute = {
        vers: r.vers,
        restant: Math.max(0, r.restant),
        duree: nb(r.duree, r.restant),
        risque: Math.max(0, Math.min(1, nb(r.risque))),
        depuis: Number.isInteger(r.depuis) ? r.depuis : e.marche,
      }
    }
  }
  return e
}

export const sauvegarde = (e) => ({
  v: VERSION,
  marche: e.marche,
  argent: e.argent,
  cargaison: e.cargaison,
  ecarts: e.ecarts,
  charrettes: e.charrettes,
  enRoute: e.enRoute,
  dette: e.dette,
  jours: e.jours,
  voyages: e.voyages,
  banqueroutes: e.banqueroutes,
  quand: Date.now(),
})

// --- Flotte et cargaison ---------------------------------------------------------

export const capacite = (e) => e.charrettes * CAPACITE_PAR_CHARRETTE
export const cargaisonTotale = (e) => e.cargaison.reduce((s, n) => s + n, 0)
export const placeLibre = (e) => capacite(e) - cargaisonTotale(e)
export const coutCharrette = (e) => Math.floor(COUT_CHARRETTE_BASE * Math.pow(COUT_CHARRETTE_TAUX, e.charrettes - 1))

/** La valeur totale de ce qu'on possède, au prix de référence — le score de la partie. */
export function patrimoine(e) {
  let v = e.argent - e.dette
  for (let g = 0; g < e.cargaison.length; g++) v += e.cargaison[g] * MARCHANDISES[g].ref
  return v
}

export function acheteCharrette(e) {
  if (e.enRoute) return false
  const prix = coutCharrette(e)
  if (e.argent < prix) return false
  e.argent -= prix
  e.charrettes++
  return true
}

// --- Prix et échanges --------------------------------------------------------------

/** Le prix courant d'une marchandise sur un marché : référence × vocation du lieu × conjoncture. */
export function prix(e, i, g) {
  return MARCHANDISES[g].ref * MARCHES[i].mult[g] * e.ecarts[i][g]
}

/**
 * Achète jusqu'à `qte` unités de `g` sur le marché courant : chaque unité
 * achetée fait un peu grimper le prix de la suivante (l'écart local monte),
 * donc un gros achat coûte plus cher à l'unité qu'un petit — c'est l'offre et
 * la demande, pas un prix affiché une fois pour toutes. S'arrête dès que la
 * caisse ou la place manque ; ne fait jamais planter, ne rend jamais un achat
 * partiel invisible : `qte` dans le retour dit ce qui a vraiment été pris.
 */
export function achete(e, g, qte) {
  if (e.enRoute || qte <= 0) return { qte: 0, cout: 0 }
  const i = e.marche
  const max = Math.min(qte, placeLibre(e))
  let ecart = e.ecarts[i][g]
  let cout = 0
  let n = 0
  for (; n < max; n++) {
    const p = MARCHANDISES[g].ref * MARCHES[i].mult[g] * ecart
    if (cout + p > e.argent) break
    cout += p
    ecart = Math.min(ECART_MAX, ecart + MARCHANDISES[g].volat)
  }
  if (n > 0) {
    e.argent -= Math.round(cout)
    e.cargaison[g] += n
    e.ecarts[i][g] = ecart
  }
  return { qte: n, cout: Math.round(cout) }
}

/**
 * Le pendant de `achete` : vendre fait baisser le prix local, unité après
 * unité. L'écart baisse *avant* que le prix de l'unité ne soit lu — le
 * symétrique exact de `achete`, qui le fait monter *après* — pour qu'un
 * achat suivi d'une revente immédiate retombe sur le même chemin de prix,
 * pas sur un cran au-dessus. `FRAIS_VENTE` est le coup de pouce qui manquait
 * encore : sans lui, ce même aller-retour est blanc à l'arrondi près, ce qui
 * en fait un profit gratuit une fois sur deux.
 */
export function vend(e, g, qte) {
  if (e.enRoute || qte <= 0) return { qte: 0, gain: 0 }
  const i = e.marche
  const max = Math.min(qte, e.cargaison[g])
  let ecart = e.ecarts[i][g]
  let gain = 0
  let n = 0
  for (; n < max; n++) {
    ecart = Math.max(ECART_MIN, ecart - MARCHANDISES[g].volat)
    gain += MARCHANDISES[g].ref * MARCHES[i].mult[g] * ecart
  }
  if (n > 0) {
    e.argent += Math.round(gain * (1 - FRAIS_VENTE))
    e.cargaison[g] -= n
    e.ecarts[i][g] = ecart
  }
  return { qte: n, gain: Math.round(gain * (1 - FRAIS_VENTE)) }
}

// --- Le réseau ---------------------------------------------------------------------

export function routeEntre(a, b) {
  return ROUTES.find((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a))
}

/** Les marchés voisins de `i`, avec la durée et le risque du trajet pour s'y rendre. */
export function connexions(i) {
  return ROUTES.filter((r) => r.a === i || r.b === i).map((r) => ({
    vers: r.a === i ? r.b : r.a,
    duree: r.duree,
    risque: r.risque,
  }))
}

export function partir(e, vers) {
  if (e.enRoute) return false
  const route = routeEntre(e.marche, vers)
  if (!route) return false
  e.enRoute = { vers, restant: route.duree, duree: route.duree, risque: route.risque, depuis: e.marche }
  return true
}

function arrivee(e, hasard, ev) {
  const route = e.enRoute
  e.marche = route.vers
  e.enRoute = null
  e.voyages++
  if (hasard() >= route.risque) return
  if (hasard() < 0.5 && cargaisonTotale(e) > 0) {
    let perte = 0
    for (let g = 0; g < e.cargaison.length; g++) {
      const n = Math.ceil(e.cargaison[g] * FRACTION_VOL)
      e.cargaison[g] -= n
      perte += n
    }
    ev.incident = { type: 'vol', perte }
  } else if (e.argent > 0) {
    const perte = Math.round(e.argent * FRACTION_TAXE)
    e.argent -= perte
    ev.incident = { type: 'taxe', perte }
  }
}

/**
 * La faillite : le créancier reprend une charrette et la moitié de ce qui
 * roule dedans, et la dette est effacée. Pas de mort possible dans ce jeu —
 * c'est ça, le fond du filet, et il coûte cher plutôt que d'être indolore.
 */
function banqueroute(e, ev) {
  e.dette = 0
  e.charrettes = Math.max(1, e.charrettes - 1)
  for (let g = 0; g < e.cargaison.length; g++) e.cargaison[g] = Math.floor(e.cargaison[g] * 0.5)
  e.banqueroutes++
  ev.banqueroute = true
}

/** L'écart de tous les marchés glisse vers 1, que la borne soit ouverte ou non. */
function decroit(e, dt) {
  if (dt <= 0) return
  const f = Math.pow(DECAY, dt)
  for (const ligne of e.ecarts) for (let g = 0; g < ligne.length; g++) ligne[g] = 1 + (ligne[g] - 1) * f
}

/** L'entretien de la flotte : payé s'il y a la caisse, mis en dette sinon. */
function entretien(e, dt, ev) {
  const cout = e.charrettes * ENTRETIEN_PAR_CHARRETTE * dt
  if (cout <= 0) return
  if (e.argent >= cout) {
    e.argent -= cout
    return
  }
  e.dette += cout - e.argent
  e.argent = 0
  if (e.dette >= SEUIL_BANQUEROUTE) banqueroute(e, ev)
}

/** Une image de jeu. `hasard` vient du moteur, jamais de `Math.random`. */
export function avance(e, dt, hasard, ev = {}) {
  decroit(e, dt)
  entretien(e, dt, ev)
  if (e.enRoute) {
    e.enRoute.restant -= dt
    if (e.enRoute.restant <= 0) arrivee(e, hasard, ev)
  }
  e.jours += dt
  return ev
}

/**
 * Le crédit d'absence : la décroissance des écarts est exacte quel que soit
 * le pas (voir `DECAY`), donc pas besoin de rejouer seconde par seconde —
 * seul un trajet en cours (au plus un) peut s'achever pendant l'absence.
 */
export function credite(e, hasard, maintenant = Date.now()) {
  const depuis = e.quand
  e.quand = maintenant
  const ev = {}
  if (!depuis || maintenant <= depuis) return ev
  const ecoule = Math.min(HORS_LIGNE_MAX, (maintenant - depuis) / 1000)
  decroit(e, ecoule)
  entretien(e, ecoule, ev)
  if (e.enRoute) {
    e.enRoute.restant -= ecoule
    if (e.enRoute.restant <= 0) arrivee(e, hasard, ev)
  }
  e.jours += ecoule
  ev.ecoule = ecoule
  return ev
}

// --- Affichage -----------------------------------------------------------------

/** 1.2k, 34.5M… comme dans usine/logique.js, pour ne jamais déborder l'écran. */
export function nombre(v) {
  if (!Number.isFinite(v)) return '0'
  const signe = v < 0 ? '-' : ''
  v = Math.abs(v)
  if (v < 1000) return signe + (v < 10 ? v.toFixed(1) : String(Math.floor(v)))
  const suffixes = ['k', 'M', 'G']
  let i = -1
  while (v >= 1000 && i < suffixes.length - 1) {
    v /= 1000
    i++
  }
  return signe + v.toFixed(v < 10 ? 2 : 1) + suffixes[i]
}

/** 4 min 20, 2 h 05 — une durée doit se lire sans compter les zéros. */
export function duree(s) {
  s = Math.max(0, Math.round(s))
  if (s < 60) return `${s} s`
  if (s < 3600) return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')}`
  return `${Math.floor(s / 3600)} h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}`
}
