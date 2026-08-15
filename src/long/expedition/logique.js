/**
 * La résolution d'une journée d'EXPÉDITION : calcul pur, testable sans canvas.
 *
 * Le hasard vient toujours du moteur (`hasard()` passé en paramètre), jamais
 * de `Math.random` — c'est ce qui rend une partie rejouable à l'identique en
 * test, et c'est la convention déjà en place dans usine/breche/ruee.
 */
import { ARRIVEE, ETAPES, URGENCES, EMBRANCHEMENT, JAUGES, BRANCHE_KM, FATIGUE_MAX, FATIGUE_SEUIL, FATIGUE_PENALITE } from './donnees.js'

export const VERSION = 2

/** Une expédition neuve, sac vide, jauges pleines. */
export function neuf() {
  return {
    v: VERSION,
    jour: 1,
    km: 0,
    vivres: 55,
    eau: 55,
    sante: 100,
    sac: [],
    obtenus: [],
    fatigue: 0,
    jourEtape: 0,
    embranchements: {},
    enAttente: undefined,
  }
}

/**
 * `null` si la sauvegarde n'est pas de ce format — l'ancienne version
 * n'avait ni version, ni fatigue, ni embranchements ; plutôt que de deviner
 * ses champs manquants, on repart à neuf.
 */
export function migre(brut) {
  if (!brut || brut.v !== VERSION) return null
  return {
    v: VERSION,
    jour: brut.jour ?? 1,
    km: brut.km ?? 0,
    vivres: brut.vivres ?? 55,
    eau: brut.eau ?? 55,
    sante: brut.sante ?? 100,
    sac: [...(brut.sac ?? [])],
    obtenus: [...(brut.obtenus ?? [])],
    fatigue: brut.fatigue ?? 0,
    jourEtape: brut.jourEtape ?? 0,
    embranchements: { ...(brut.embranchements ?? {}) },
    enAttente: brut.enAttente,
  }
}

// --- Étapes et frontières ---------------------------------------------------------

/**
 * La frontière lointaine de l'étape `i`, décalée par la route choisie en y
 * entrant : plus loin sur la route sûre, plus court sur le raccourci. Sans
 * choix encore fait, c'est la frontière de base.
 */
export function limiteDe(h, i) {
  const base = ETAPES[i].jusqu
  const choix = h.embranchements[i]
  return choix === 'sur' ? base + BRANCHE_KM : choix === 'risque' ? base - BRANCHE_KM : base
}

export function etapeIndexDe(h, km = h.km) {
  for (let i = 0; i < ETAPES.length; i++) if (km < limiteDe(h, i)) return i
  return ETAPES.length - 1
}

export const etapeDe = (h) => ETAPES[etapeIndexDe(h)]

/** L'arrivée elle-même est la frontière lointaine de la dernière étape. */
export const arriveeDe = (h) => limiteDe(h, ETAPES.length - 1)

// --- Tirage de la journée ----------------------------------------------------------

export const optionsDe = (journee) => [journee.a, journee.b, journee.c].filter(Boolean)
export const ouverte = (h, o) => !o.exige || h.sac.includes(o.exige)

/**
 * La journée du jour : un embranchement en attente passe avant tout (on ne
 * tire rien tant que la route n'est pas choisie), puis une urgence si l'état
 * l'impose, puis un objet-clé forcé s'il traîne trop, puis un tirage pondéré
 * par l'état dans le pool de l'étape courante.
 */
export function tire(h, hasard) {
  if (h.enAttente !== undefined) return { ...EMBRANCHEMENT, embranchement: true }

  const urgences = URGENCES.filter((u) => u.quand(h))
  if (urgences.length && hasard() < 0.8) {
    return { ...urgences[Math.floor(hasard() * urgences.length)], urgence: true }
  }

  const i = etapeIndexDe(h)
  const etape = ETAPES[i]
  const route = h.embranchements[i]
  const eligibles = etape.journees.filter((j) => !j.route || j.route === route)

  const beats = eligibles.filter((j) => j.beat && !h.obtenus.includes(j.beat) && h.jourEtape >= j.auJour)
  if (beats.length) return beats[Math.floor(hasard() * beats.length)]

  const pool = eligibles.filter((j) => !(j.beat && h.obtenus.includes(j.beat)))
  const plusBasse = JAUGES.reduce((m, g) => (h[g.cle] < h[m] ? g.cle : m), JAUGES[0].cle)

  const poids = pool.map((j) => (j.favorise === plusBasse && h[plusBasse] < 35 ? 3 : 1))
  const total = poids.reduce((s, p) => s + p, 0)
  let tirage = hasard() * total
  for (let k = 0; k < pool.length; k++) {
    tirage -= poids[k]
    if (tirage <= 0) return pool[k]
  }
  return pool[pool.length - 1]
}

// --- Résolution d'un choix ----------------------------------------------------------

/**
 * Applique l'option choisie à l'état `h` (mutation en place, comme
 * `usine/logique.js`) et remplit `ev` de ce qui s'est passé, pour que
 * l'appelant décide seul des sons et des effets à jouer.
 */
export function avancer(h, o, hasard, ev = {}) {
  if (h.enAttente !== undefined && o.route) {
    h.embranchements[h.enAttente] = o.route
    h.enAttente = undefined
    ev.route = o.route
  }

  const avant = etapeIndexDe(h)
  const attenue = h.fatigue >= FATIGUE_SEUIL
  const gain = (v) => (attenue && v > 0 ? v * FATIGUE_PENALITE : v)

  // Une seule tentative pour l'option entière : la chance porte sur le jour,
  // pas séparément sur chaque jauge qu'elle touche.
  const succes = o.chance ? hasard() < o.chance.p : undefined
  if (succes !== undefined) ev.succes = succes

  h.km += o.km
  for (const g of JAUGES) {
    let delta = o[g.cle] ?? 0
    if (o.chance) delta += (succes ? o.chance[g.cle] : o.sinon?.[g.cle]) ?? 0
    h[g.cle] = Math.max(0, Math.min(100, h[g.cle] + gain(delta)))
  }

  if (o.exige) h.sac.splice(h.sac.indexOf(o.exige), 1)
  if (o.objet) {
    if (!h.sac.includes(o.objet)) h.sac.push(o.objet)
    if (!h.obtenus.includes(o.objet)) h.obtenus.push(o.objet)
  }
  ev.objet = o.objet

  if (o.dur) h.fatigue = Math.min(FATIGUE_MAX, h.fatigue + 1)
  else if (o.repos) h.fatigue = Math.max(0, h.fatigue - 2)
  else h.fatigue = Math.max(0, h.fatigue - 1)

  let mal = ''
  if (h.vivres <= 0) {
    h.sante -= 10
    h.vivres = 0
    mal = 'la faim te ronge'
  }
  if (h.eau <= 0) {
    h.sante -= 13
    h.eau = 0
    mal = 'la soif te brûle'
  }
  ev.mal = mal

  h.jour++
  h.jourEtape++

  const apres = etapeIndexDe(h)
  ev.etapeChangee = apres !== avant && h.km < arriveeDe(h)
  if (ev.etapeChangee) {
    h.jourEtape = 0
    if (apres > 0 && h.embranchements[apres] === undefined) h.enAttente = apres
  }

  ev.arrive = h.km >= arriveeDe(h)
  ev.mort = !ev.arrive && h.sante <= 0
  if (ev.mort) h.sante = 0

  return ev
}

export { ARRIVEE }
