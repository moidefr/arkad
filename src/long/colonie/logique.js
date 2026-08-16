/**
 * Toute la règle de COLONIE, sans une ligne de dessin ni un seul son.
 *
 * Contrairement à l'USINE — une chaîne qui ne fait qu'avancer, au pire au
 * ralenti — COLONIE tourne en réseau : la nourriture nourrit la population,
 * la population fournit la main-d'œuvre, la main-d'œuvre fait tourner les
 * bâtiments, les bâtiments produisent de nouvelles ressources qui reviennent
 * nourrir la colonie. Casser un maillon (plus assez de nourriture) fait
 * reculer tous les autres : c'est le risque que ce fichier modélise, et que
 * `test/colonie-banc.mjs` mesure plutôt que de le deviner.
 */
import {
  RESSOURCES,
  BATIMENTS,
  DEPART,
  LOGEMENT_DEPART,
  PALIERS,
  CONSO_HABITANT,
  RENDEMENT_HABITANT,
  TAUX_CROISSANCE,
  TAUX_FAMINE_PROP,
  TAUX_FAMINE_ABS,
  FAMINE_SEUIL_ABANDON,
  HORS_LIGNE_MAX_S,
  PAS_HORSLIGNE,
} from './donnees.js'

export const VERSION = 1

// --- État ----------------------------------------------------------------------

export function neuve() {
  return {
    v: VERSION,
    t: 0,
    nourriture: DEPART.nourriture,
    bois: DEPART.bois,
    pierre: DEPART.pierre,
    outils: DEPART.outils,
    population: DEPART.population,
    n: BATIMENTS.map(() => 0),
    famineDepuis: 0,
    abandons: 0,
    // Le plus haut jamais atteint — ne retombe jamais, même si la colonie
    // décline ensuite. C'est ce que le bandeau du haut affiche.
    pic: DEPART.population,
    quand: 0,
  }
}

const nombreSur = (v, defaut = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : defaut)

/**
 * `null` si la sauvegarde n'est pas de ce format, plutôt que de deviner ses
 * champs manquants. Une sauvegarde du bon numéro de version est quand même
 * assainie champ par champ : un champ abîmé ne doit jamais propager `NaN`
 * dans l'économie qui suit.
 */
export function migre(brut) {
  if (!brut || typeof brut !== 'object' || brut.v !== VERSION) return null
  const e = neuve()
  for (const cle of ['t', 'nourriture', 'bois', 'pierre', 'outils', 'famineDepuis', 'quand'])
    e[cle] = Math.max(0, nombreSur(brut[cle], e[cle]))
  e.population = Math.max(0, nombreSur(brut.population, e.population))
  e.abandons = Math.max(0, Math.floor(nombreSur(brut.abandons)))
  // « Le plus haut jamais atteint » ne doit jamais reculer d'une migration :
  // à défaut d'un pic connu, la population actuelle en est le minorant sûr.
  e.pic = Math.max(e.population, nombreSur(brut.pic, e.population))
  if (Array.isArray(brut.n)) BATIMENTS.forEach((_, i) => (e.n[i] = Math.max(0, Math.floor(nombreSur(brut.n[i])))))
  return e
}

export const sauvegarde = (e) => ({
  v: VERSION,
  t: e.t,
  nourriture: e.nourriture,
  bois: e.bois,
  pierre: e.pierre,
  outils: e.outils,
  population: e.population,
  n: e.n,
  famineDepuis: e.famineDepuis,
  abandons: e.abandons,
  pic: e.pic,
  quand: Date.now(),
})

// --- Population et main-d'œuvre --------------------------------------------------

export const logements = (e) => LOGEMENT_DEPART + BATIMENTS.reduce((s, b, i) => s + b.logement * e.n[i], 0)
export const postes = (e) => BATIMENTS.reduce((s, b, i) => s + b.postes * e.n[i], 0)

/**
 * La fraction des postes couverte par la population — sans plancher.
 *
 * C'est la différence de fond avec `usine/logique.js` : là-bas, une usine
 * sans personne tourne quand même un peu (`facteurOuvriers` a un plancher).
 * Ici, une colonie sans bras ne produit rien du tout — c'est ce qui rend la
 * famine réellement mortelle plutôt qu'un simple ralentissement.
 */
export function couverture(e) {
  const p = postes(e)
  if (p <= 0) return 1
  return Math.max(0, Math.min(1, (e.population * RENDEMENT_HABITANT) / p))
}

export function ouvert(e, i) {
  const b = BATIMENTS[i]
  return b.palier === 0 || e.population >= (PALIERS[b.palier] ?? Infinity)
}

export function cout(e, i) {
  const b = BATIMENTS[i]
  const c = {}
  for (const [res, base] of Object.entries(b.coutBase)) c[res] = Math.floor(base * Math.pow(b.coutTaux, e.n[i]))
  return c
}

export function peutConstruire(e, i) {
  if (!ouvert(e, i)) return false
  const c = cout(e, i)
  return Object.entries(c).every(([res, prix]) => e[res] >= prix)
}

export function construit(e, i) {
  if (!peutConstruire(e, i)) return false
  const c = cout(e, i)
  for (const [res, prix] of Object.entries(c)) e[res] -= prix
  e.n[i]++
  return true
}

/**
 * Le débit net de chaque ressource, tous bâtiments confondus, à l'instant
 * présent — pour l'affichage. Ignore le bridage par le stock (voir `avance`) :
 * une lecture instantanée n'a pas à anticiper une pénurie qui n'est pas
 * encore là, seulement à dire ce que produit la main-d'œuvre en place.
 */
export function tauxRessources(e) {
  const c = couverture(e)
  const taux = Object.fromEntries(RESSOURCES.map((r) => [r.cle, 0]))
  taux.nourriture -= e.population * CONSO_HABITANT
  for (let i = 0; i < BATIMENTS.length; i++) {
    const b = BATIMENTS[i]
    if (!e.n[i]) continue
    const debit = e.n[i] * c
    for (const [res, v] of Object.entries(b.consomme)) taux[res] -= v * debit
    for (const [res, v] of Object.entries(b.produit)) taux[res] += v * debit
  }
  return taux
}

// --- Le temps qui passe ----------------------------------------------------------

/**
 * Une image de jeu. `hasard` vient du moteur, jamais de `Math.random` — c'est
 * ce qui rend un abandon de bâtiment rejouable à l'identique en test.
 */
export function avance(e, dt, hasard, ev = {}) {
  if (e.population <= 0) {
    ev.effondree = true
    return ev
  }

  e.t += dt
  const c = couverture(e)

  // Un seul passage, dans l'ordre de la table : chaque bâtiment consomme ce
  // que ses prédécesseurs viennent de produire ce même tour (voir le
  // commentaire d'ordre dans `donnees.js`). Un bâtiment sans intrant
  // (`consomme` vide) n'est jamais bridé : `fraction` y reste à 1.
  for (let i = 0; i < BATIMENTS.length; i++) {
    const b = BATIMENTS[i]
    if (!e.n[i] || b.logement) continue
    const potentiel = e.n[i] * c * dt
    let fraction = 1
    for (const [res, v] of Object.entries(b.consomme)) {
      const besoin = v * potentiel
      if (besoin > 0) fraction = Math.min(fraction, e[res] / besoin)
    }
    fraction = Math.max(0, Math.min(1, fraction))
    for (const [res, v] of Object.entries(b.consomme)) e[res] = Math.max(0, e[res] - v * potentiel * fraction)
    for (const [res, v] of Object.entries(b.produit)) e[res] += v * potentiel * fraction
  }

  // La faim : nourrie, la colonie grandit vers ses logements ; affamée, elle
  // décline, et une famine qui s'éternise coûte un bâtiment.
  const besoin = e.population * CONSO_HABITANT * dt
  if (e.nourriture >= besoin) {
    e.nourriture -= besoin
    e.famineDepuis = Math.max(0, e.famineDepuis - dt * 2)
    const capacite = logements(e)
    if (e.population < capacite) e.population = Math.min(capacite, e.population + TAUX_CROISSANCE * (capacite - e.population) * dt)
  } else {
    const severite = besoin > 0 ? (besoin - e.nourriture) / besoin : 1
    e.nourriture = 0
    e.famineDepuis += dt
    const perte = (TAUX_FAMINE_PROP * e.population + TAUX_FAMINE_ABS) * severite * dt
    e.population = Math.max(0, e.population - perte)
    if (e.famineDepuis >= FAMINE_SEUIL_ABANDON) {
      e.famineDepuis = 0
      abandonne(e, hasard, ev)
    }
  }

  e.pic = Math.max(e.pic, e.population)
  ev.effondree = e.population <= 0
  return ev
}

function abandonne(e, hasard, ev) {
  const candidats = BATIMENTS.map((_, i) => i).filter((i) => e.n[i] > 0)
  if (!candidats.length) return
  const i = candidats[Math.floor(hasard() * candidats.length)]
  e.n[i]--
  e.abandons++
  ev.abandon = i
}

/**
 * Le crédit d'absence : la colonie continue de tourner (et de risquer la
 * famine) pendant qu'on n'y touche pas, comme dans l'USINE — mais on ne peut
 * pas se contenter d'une formule fermée ici. La famine est une rétroaction
 * (moins de bras → moins de nourriture → moins de bras) que seul un vrai
 * pas-à-pas retrouve fidèlement ; on avance donc par tranches de
 * `PAS_HORSLIGNE`, bornées comme toujours par un plafond.
 */
export function credite(e, hasard, maintenant = Date.now()) {
  const depuis = e.quand
  e.quand = maintenant
  if (!depuis || maintenant <= depuis) return 0
  const ecoule = Math.min(HORS_LIGNE_MAX_S, (maintenant - depuis) / 1000)
  let reste = ecoule
  while (reste > 0 && e.population > 0) {
    const pas = Math.min(PAS_HORSLIGNE, reste)
    avance(e, pas, hasard)
    reste -= pas
  }
  return ecoule
}

// --- Affichage ---------------------------------------------------------------

/** 1.2k, 34.5M… comme dans l'USINE, pour que les grands stocks tiennent à l'écran. */
export function nombre(v) {
  if (!Number.isFinite(v)) return '0'
  if (v < 1000) return v < 10 ? v.toFixed(1) : String(Math.floor(v))
  const suffixes = ['k', 'M', 'G', 'T']
  let i = -1
  while (v >= 1000 && i < suffixes.length - 1) {
    v /= 1000
    i++
  }
  return v.toFixed(v < 10 ? 2 : 1) + suffixes[i]
}

/** 4 min 20, 2 h 05 : une durée doit se lire sans compter les zéros. */
export function duree(s) {
  s = Math.max(0, Math.round(s))
  if (s < 60) return `${s} s`
  if (s < 3600) return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')}`
  return `${Math.floor(s / 3600)} h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}`
}
