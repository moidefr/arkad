/**
 * Toute la règle de REMPART, sans une ligne de dessin ni un seul son.
 *
 * Une défense entière — poser des tours, lancer des vagues, tenir ou tomber —
 * se joue ici, en pas de temps réel (`avance`). C'est ce qui permet de
 * simuler des dizaines de défenses d'affilée dans `node --test` : sans ça, on
 * ne sait jamais si la méta-progression rend vraiment la suivante plus facile,
 * on le suppose.
 *
 * **Ce qui persiste, et ce qui ne persiste pas.** Seule la méta-progression
 * (`meta` : éclats, déblocages, améliorations) traverse une fermeture de
 * l'appli — comme dans RUÉE, une défense en cours n'est pas rejouée au
 * lancement suivant. Ce n'est pas une perte silencieuse : les éclats d'une
 * vague survécue sont crédités à `meta` **au moment où elle se termine**, pas
 * à la fin de la défense, donc rien de gagné ne peut disparaître.
 */
import {
  ENNEMIS,
  TOURS,
  CARTES,
  AMELIORATIONS_META,
  NIVEAU_MAX,
  ESPACEMENT_SPAWN,
  PREP_TEMPS,
  PROJECTILE_VITESSE,
  RALENTI_DUREE,
  RALENTI_PLANCHER,
} from './donnees.js'

export const VERSION = 1

// --- Recherche dans les tables -------------------------------------------------

export const tourParId = (id) => TOURS.find((t) => t.id === id)
export const carteParId = (id) => CARTES.find((c) => c.id === id)
const AM_PAR_ID = Object.fromEntries(AMELIORATIONS_META.map((a) => [a.id, a]))

// --- Méta-progression -----------------------------------------------------------

export function metaNeuve() {
  return {
    v: VERSION,
    eclats: 0,
    toursDeblocs: ['sentinelle'],
    cartesDeblocs: [CARTES[0].id],
    ameliorations: {},
    parties: 0,
    meilleureVague: {},
  }
}

/** `null` si la sauvegarde n'est pas de ce format : on repart à neuf plutôt que de deviner. */
export function migre(brut) {
  if (!brut || typeof brut !== 'object' || brut.v !== VERSION) return null
  const m = brut
  const neuf = metaNeuve()
  const nombreSur = (v, defaut = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : defaut)
  const eclats = Math.max(0, Math.floor(nombreSur(m.eclats)))
  const toursDeblocs = Array.isArray(m.toursDeblocs)
    ? [...new Set(['sentinelle', ...m.toursDeblocs.filter((id) => TOURS.some((t) => t.id === id))])]
    : neuf.toursDeblocs
  const cartesDeblocs = Array.isArray(m.cartesDeblocs)
    ? [...new Set([CARTES[0].id, ...m.cartesDeblocs.filter((id) => CARTES.some((c) => c.id === id))])]
    : neuf.cartesDeblocs
  const ameliorations = {}
  if (m.ameliorations && typeof m.ameliorations === 'object') {
    for (const a of AMELIORATIONS_META) {
      const niveau = Math.max(0, Math.floor(nombreSur(m.ameliorations[a.id])))
      if (niveau > 0) ameliorations[a.id] = Math.min(niveau, a.couts.length)
    }
  }
  const meilleureVague = {}
  if (m.meilleureVague && typeof m.meilleureVague === 'object') {
    for (const c of CARTES) {
      const v = Math.max(0, Math.floor(nombreSur(m.meilleureVague[c.id])))
      if (v > 0) meilleureVague[c.id] = v
    }
  }
  return {
    v: VERSION,
    eclats,
    toursDeblocs,
    cartesDeblocs,
    ameliorations,
    parties: Math.max(0, Math.floor(nombreSur(m.parties))),
    meilleureVague,
  }
}

export const sauvegarde = (meta) => ({ ...meta, v: VERSION })

export const niveauMeta = (meta, id) => meta.ameliorations[id] ?? 0

/** Le multiplicateur d'une piste en pourcentage (dégâts/portée/cadence/gain). */
function multMeta(meta, id) {
  const a = AM_PAR_ID[id]
  return 1 + a.effet * niveauMeta(meta, id)
}

/** Le bonus plat d'une piste (vie/ferraille). */
function flatMeta(meta, id) {
  const a = AM_PAR_ID[id]
  return a.effet * niveauMeta(meta, id)
}

export const vieMaxDe = (meta) => 20 + flatMeta(meta, 'vie')
export const ferrailleDepartDe = (meta) => 150 + flatMeta(meta, 'ferraille')
export const multDegatDe = (meta) => multMeta(meta, 'degats')
export const multPorteeDe = (meta) => multMeta(meta, 'portee')
export const multCadenceDe = (meta) => multMeta(meta, 'cadence')
export const multGainDe = (meta) => multMeta(meta, 'gain')

/** Achète un niveau d'amélioration méta. `false` si le prix n'est pas atteint. */
export function ameliore(meta, id) {
  const a = AM_PAR_ID[id]
  if (!a) return false
  const niveau = niveauMeta(meta, id)
  if (niveau >= a.couts.length) return false
  const cout = a.couts[niveau]
  if (meta.eclats < cout) return false
  meta.eclats -= cout
  meta.ameliorations[id] = niveau + 1
  return true
}

export function debloqueTour(meta, tourId) {
  const t = tourParId(tourId)
  if (!t || meta.toursDeblocs.includes(tourId) || meta.eclats < t.coutDeblocage) return false
  meta.eclats -= t.coutDeblocage
  meta.toursDeblocs.push(tourId)
  return true
}

export function debloqueCarte(meta, carteId) {
  const c = carteParId(carteId)
  if (!c || meta.cartesDeblocs.includes(carteId) || meta.eclats < c.coutDeblocage) return false
  meta.eclats -= c.coutDeblocage
  meta.cartesDeblocs.push(carteId)
  return true
}

// --- Géométrie du chemin ---------------------------------------------------------

const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by)

// La longueur d'un chemin ne change jamais pour une carte donnée : autant ne
// la recalculer qu'une fois, plutôt qu'à chaque ennemi de chaque image.
const longueurs = new WeakMap()

export function longueurChemin(carte) {
  let l = longueurs.get(carte)
  if (l !== undefined) return l
  l = 0
  for (let i = 0; i < carte.chemin.length - 1; i++) {
    const a = carte.chemin[i]
    const b = carte.chemin[i + 1]
    l += dist(a.x, a.y, b.x, b.y)
  }
  longueurs.set(carte, l)
  return l
}

/** Le point du chemin à la distance parcourue `d`, en coordonnées locales au plateau. */
export function positionSur(carte, d) {
  const chemin = carte.chemin
  let reste = Math.max(0, d)
  for (let i = 0; i < chemin.length - 1; i++) {
    const a = chemin[i]
    const b = chemin[i + 1]
    const seg = dist(a.x, a.y, b.x, b.y)
    if (reste <= seg || i === chemin.length - 2) {
      const t = seg > 0 ? Math.min(1, reste / seg) : 0
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
    }
    reste -= seg
  }
  return { ...chemin[chemin.length - 1] }
}

// --- Une défense neuve ------------------------------------------------------------

/**
 * Les bonus méta sont figés au lancement de la défense, pas relus à chaque
 * image : « dès le début de la prochaine défense » veut dire que la partie en
 * cours ne bouge plus si on va dépenser des éclats ailleurs pendant qu'elle
 * tourne (ce que l'interface n'autorise de toute façon pas), et surtout que
 * `avance` n'a besoin de connaître que l'état de la défense, jamais la méta.
 */
export function partieNeuve(carteId, meta) {
  return {
    carteId,
    vague: 0,
    phase: 'attente', // 'attente' | 'vague' | 'defaite'
    minuteur: PREP_TEMPS,
    vie: vieMaxDe(meta),
    vieMax: vieMaxDe(meta),
    ferraille: ferrailleDepartDe(meta),
    tours: [],
    ennemis: [],
    aVenir: [],
    projectiles: [],
    tVague: 0,
    prochainIdTour: 1,
    prochainIdEnnemi: 1,
    eclatsGagnes: 0,
    multDegat: multDegatDe(meta),
    multPortee: multPorteeDe(meta),
    multCadence: multCadenceDe(meta),
    multGain: multGainDe(meta),
  }
}

/** Les stats effectives d'une tour posée : sa table de base, son niveau, la méta figée au départ. */
export function statsTour(etat, tour) {
  const def = tourParId(tour.tourId)
  const n = tour.niveau - 1
  return {
    degat: def.degat * Math.pow(1.35, n) * etat.multDegat,
    portee: def.portee * Math.pow(1.08, n) * etat.multPortee,
    cadence: def.cadence * Math.pow(1.15, n) * etat.multCadence,
    rayon: def.rayon,
    ralenti: def.ralenti,
  }
}

export const coutAmeliorationTour = (def, niveau) => Math.round(def.cout * 0.75 * niveau)

/**
 * Ce qu'une tour posée vaut maintenant, et ce qu'elle vaudrait au niveau
 * suivant — `prochain` et `cout` valent `null` une fois `NIVEAU_MAX` atteint.
 * Fonction pure, comme le reste du fichier : c'est elle que l'écran
 * d'inspection lit pour afficher la prochaine étape en grisé, sans dupliquer
 * le calcul des stats.
 */
export function previsionTour(etat, tour) {
  const def = tourParId(tour.tourId)
  const actuel = statsTour(etat, tour)
  const maxee = tour.niveau >= NIVEAU_MAX
  const prochain = maxee ? null : statsTour(etat, { ...tour, niveau: tour.niveau + 1 })
  const cout = maxee ? null : coutAmeliorationTour(def, tour.niveau)
  return { def, actuel, prochain, cout, maxee }
}

export function poseTour(etat, meta, tourId, emplacement) {
  if (etat.phase === 'defaite') return false
  if (!meta.toursDeblocs.includes(tourId)) return false
  const carte = carteParId(etat.carteId)
  if (!carte.emplacements[emplacement]) return false
  if (etat.tours.some((t) => t.emplacement === emplacement)) return false
  const def = tourParId(tourId)
  if (etat.ferraille < def.cout) return false
  etat.ferraille -= def.cout
  etat.tours.push({ instanceId: etat.prochainIdTour++, tourId, emplacement, niveau: 1, recharge: 0 })
  return true
}

export function ameliorerTour(etat, instanceId) {
  const tour = etat.tours.find((t) => t.instanceId === instanceId)
  if (!tour || tour.niveau >= NIVEAU_MAX) return false
  const def = tourParId(tour.tourId)
  const cout = coutAmeliorationTour(def, tour.niveau)
  if (etat.ferraille < cout) return false
  etat.ferraille -= cout
  tour.niveau++
  return true
}

export const lanceVagueMaintenant = (etat) => {
  if (etat.phase !== 'attente') return false
  etat.minuteur = 0
  return true
}

// --- Génération d'une vague ---------------------------------------------------

// L'escalade est volontairement continue : il n'y a pas de « dernière vague »
// qui bascule dans un mode différent, la même formule tourne indéfiniment.
// C'est ce qui donne le défi sans fin sans qu'il faille écrire un second jeu.
const VAGUE_BASE_N = 6
const VAGUE_CROISSANCE_N = 0.9
const VAGUE_CROISSANCE_VIE = 0.11
const SEUIL_COUREUR = 3
const SEUIL_ESSAIM = 6
const SEUIL_BLINDE = 9

function typesDisponibles(n) {
  const pool = [{ id: 'rampant', poids: 1 }]
  if (n >= SEUIL_COUREUR) pool.push({ id: 'coureur', poids: 0.7 })
  if (n >= SEUIL_ESSAIM) pool.push({ id: 'essaim', poids: 1.1 })
  if (n >= SEUIL_BLINDE) pool.push({ id: 'blinde', poids: 0.45 })
  return pool
}

function tireType(pool, hasard) {
  const total = pool.reduce((s, p) => s + p.poids, 0)
  let x = hasard() * total
  for (const p of pool) {
    x -= p.poids
    if (x <= 0) return p.id
  }
  return pool[pool.length - 1].id
}

/** La liste des apparitions de la vague `n`, chacune avec son délai depuis le début de la vague. */
export function genereVague(carte, n, hasard) {
  const total = Math.max(1, Math.round((VAGUE_BASE_N + n * VAGUE_CROISSANCE_N) * Math.sqrt(carte.difficulte)))
  const echelleVie = (1 + n * VAGUE_CROISSANCE_VIE) * carte.difficulte
  const pool = typesDisponibles(n)
  const spawns = []
  let quand = 0
  for (let i = 0; i < total; i++) {
    spawns.push({ type: tireType(pool, hasard), quand, echelleVie })
    quand += ESPACEMENT_SPAWN * (0.85 + hasard() * 0.3)
  }
  return spawns
}

/** La difficulté de la carte gonfle un peu la récompense : elle est dure dès la vague 1. */
export const eclatsParVague = (carte, n) => Math.max(1, Math.round((1 + Math.floor(n / 3)) * Math.sqrt(carte.difficulte)))

function demarreVague(etat, hasard) {
  const carte = carteParId(etat.carteId)
  etat.vague += 1
  etat.aVenir = genereVague(carte, etat.vague, hasard)
  etat.tVague = 0
  etat.phase = 'vague'
}

// --- Le pas de temps ---------------------------------------------------------------

const SEUIL_IMPACT = 6

function creeEnnemi(etat, type, echelleVie) {
  const def = ENNEMIS[type]
  return {
    id: etat.prochainIdEnnemi++,
    type,
    d: 0,
    vie: def.vie * echelleVie,
    vieMax: def.vie * echelleVie,
    ralentiReste: 0,
    ralentiFacteur: 1,
    morte: false,
  }
}

function appliqueDegat(etat, ennemi, brut, ignoreArmure, ev) {
  const def = ENNEMIS[ennemi.type]
  const degat = ignoreArmure ? brut : Math.max(1, brut - def.armure)
  ennemi.vie -= degat
  if (ennemi.vie <= 0 && !ennemi.morte) {
    ennemi.morte = true
    const gain = Math.round(def.recompense * etat.multGain)
    etat.ferraille += gain
    ev.ennemiTue?.(ennemi.type, gain)
  }
}

/**
 * Un pas de la défense. `hasard` sert au tirage des vagues, jamais à autre
 * chose : le combat lui-même (ciblage, dégâts) est entièrement déterministe,
 * ce qui rend un automate de banc reproductible d'une exécution à l'autre.
 */
export function avance(etat, dt, hasard, ev = {}) {
  if (etat.phase === 'defaite') return etat
  const carte = carteParId(etat.carteId)
  const longueur = longueurChemin(carte)

  if (etat.phase === 'attente') {
    etat.minuteur -= dt
    if (etat.minuteur <= 0) demarreVague(etat, hasard)
    else return etat
  }

  // --- Apparitions ---
  etat.tVague += dt
  while (etat.aVenir.length && etat.aVenir[0].quand <= etat.tVague) {
    const s = etat.aVenir.shift()
    etat.ennemis.push(creeEnnemi(etat, s.type, s.echelleVie))
  }

  // --- Déplacement et percées ---
  for (const en of etat.ennemis) {
    if (en.ralentiReste > 0) en.ralentiReste = Math.max(0, en.ralentiReste - dt)
    const vitesse = ENNEMIS[en.type].vitesse * (en.ralentiReste > 0 ? en.ralentiFacteur : 1)
    en.d += vitesse * dt
  }
  const percees = etat.ennemis.filter((en) => en.d >= longueur)
  if (percees.length) {
    etat.ennemis = etat.ennemis.filter((en) => en.d < longueur)
    for (const en of percees) {
      etat.vie = Math.max(0, etat.vie - ENNEMIS[en.type].degat)
      ev.percee?.(en.type)
    }
  }
  if (etat.vie <= 0) {
    etat.phase = 'defaite'
    ev.defaite?.()
    return etat
  }

  // --- Tir des tours ---
  for (const tour of etat.tours) {
    tour.recharge -= dt
    if (tour.recharge > 0) continue
    const stats = statsTour(etat, tour)
    const pos = carte.emplacements[tour.emplacement]
    let cible = null
    let meilleurD = -1
    for (const en of etat.ennemis) {
      const p = positionSur(carte, en.d)
      if (dist(pos.x, pos.y, p.x, p.y) <= stats.portee && en.d > meilleurD) {
        meilleurD = en.d
        cible = en
      }
    }
    if (!cible) continue
    tour.recharge = 1 / Math.max(0.05, stats.cadence)
    const p = positionSur(carte, cible.d)
    etat.projectiles.push({
      x: pos.x,
      y: pos.y,
      cibleId: cible.id,
      degat: stats.degat,
      rayon: stats.rayon,
      ralenti: stats.ralenti,
    })
    ev.tir?.(tour.tourId, pos, p)
  }

  // --- Déplacement et résolution des projectiles ---
  const projRestants = []
  for (const proj of etat.projectiles) {
    const cible = etat.ennemis.find((en) => en.id === proj.cibleId)
    if (!cible) continue // la cible est déjà morte : le projectile s'éteint sans dégât
    const p = positionSur(carte, cible.d)
    const d = dist(proj.x, proj.y, p.x, p.y)
    const pas = PROJECTILE_VITESSE * dt
    if (d <= Math.max(SEUIL_IMPACT, pas)) {
      if (proj.rayon > 0) {
        for (const en of etat.ennemis) {
          const q = positionSur(carte, en.d)
          if (dist(p.x, p.y, q.x, q.y) <= proj.rayon) {
            appliqueDegat(etat, en, proj.degat, true, ev)
            if (proj.ralenti) {
              en.ralentiReste = RALENTI_DUREE
              en.ralentiFacteur = Math.max(RALENTI_PLANCHER, 1 - proj.ralenti)
            }
          }
        }
      } else {
        appliqueDegat(etat, cible, proj.degat, false, ev)
      }
    } else {
      proj.x += ((p.x - proj.x) / d) * pas
      proj.y += ((p.y - proj.y) / d) * pas
      projRestants.push(proj)
    }
  }
  etat.projectiles = projRestants
  etat.ennemis = etat.ennemis.filter((en) => !en.morte)

  // --- Fin de vague ---
  if (etat.phase === 'vague' && !etat.aVenir.length && !etat.ennemis.length) {
    etat.phase = 'attente'
    etat.minuteur = PREP_TEMPS
    const gain = eclatsParVague(carte, etat.vague)
    etat.eclatsGagnes += gain
    ev.vagueTerminee?.(etat.vague, gain)
  }

  return etat
}

/** Crédite des éclats à la méta — appelé par l'appelant au moment de `ev.vagueTerminee`. */
export function crediteEclats(meta, gain) {
  meta.eclats += gain
}

/** La meilleure vague atteinte sur une carte, pour l'écran de méta-progression. */
export function noteMeilleureVague(meta, carteId, vague) {
  meta.meilleureVague[carteId] = Math.max(meta.meilleureVague[carteId] ?? 0, vague)
}

export const noteDefaite = (meta) => {
  meta.parties = (meta.parties ?? 0) + 1
}
