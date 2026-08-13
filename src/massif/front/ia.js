/**
 * L'adversaire.
 *
 * Il joue **sans aléa** : à situation identique, il fait le même coup. C'est
 * ce qui permet au banc d'équilibrage de comparer deux réglages, et au joueur
 * d'apprendre ses habitudes au lieu de subir des dés.
 *
 * La méthode tient en trois lignes : pour chaque destination atteignable, on
 * évalue la meilleure attaque possible depuis là **avec la vraie formule de
 * dégâts**, on retranche ce qu'on s'expose à prendre en retour, et on garde le
 * meilleur total. Une IA qui utilise le moteur du jeu ne peut pas se tromper
 * sur ses propres règles.
 */
import { distance, cle } from './hex.js'
import { terrainA } from './carte.js'
import { couvert as couvertDe } from './terrain.js'
import * as B from './bataille.js'
import { passif, ordres } from './unites.js'

const POIDS = {
  degat: 1,
  tue: 26,
  gradeTue: 11,
  riposte: 0.8,
  menace: 2.4,
  couvert: 20,
  approche: 4.5,
  objectif: 3.6,
  soutien: 9,
}

/**
 * L'urgence. Deux armées qui pèsent également le risque campent chacune dans
 * son bois et le compteur de tours décide à leur place — c'est ce qui arrivait
 * ici. Au fil des tours la prudence pèse moins et l'approche pèse plus : la
 * bataille se résout parce que quelqu'un finit par attaquer.
 */
const urgence = (bat) => 1 + Math.min(1.6, (bat.tour / Math.max(1, bat.toursMax)) * 2)

/** Une cible molle vaut mieux qu'une cible dure : soigneurs et gradés d'abord. */
function valeurCible(bat, c) {
  let v = 0
  if (passif(c, 'soigneur') > 0) v += POIDS.soutien
  if (c.grade >= 2) v += POIDS.soutien
  return v
}

/** Combien d'ennemis pourraient frapper cet hexagone au tour suivant. */
function menace(bat, u, q, r) {
  let n = 0
  for (const e of B.vivantes(bat, u.camp === 0 ? 1 : 0)) {
    const f = B.fiche(bat, e)
    if (distance(e.q, e.r, q, r) <= f.portee[1] + f.mvt * 0.8) n++
  }
  return n
}

/** Là où l'IA veut être, indépendamment de ce qu'elle peut frapper d'ici. */
function scorePosition(bat, u, q, r) {
  const t = terrainA(bat.carte, q, r)
  const p = urgence(bat)
  let s = couvertDe(t ?? {}) * POIDS.couvert - (menace(bat, u, q, r) * POIDS.menace) / p
  const adverses = B.vivantes(bat, u.camp === 0 ? 1 : 0)
  if (adverses.length) {
    const f = B.fiche(bat, u)
    const d = Math.min(...adverses.map((e) => distance(e.q, e.r, q, r)))
    // Un tireur veut sa portée maximale, un fantassin veut le contact.
    const ideal = Math.max(1, f.portee[1] - (f.portee[1] > 1 ? 1 : 0))
    s -= Math.abs(d - ideal) * POIDS.approche * p
  }
  const o = bat.objectif
  if (o.id === 'capture' && o.points?.length) {
    const d = Math.min(...o.points.map((p) => distance(p.q, p.r, q, r)))
    s -= d * POIDS.objectif
  }
  return s
}

/** Le meilleur coup depuis un hexagone donné — l'unité y est posée pour de vrai, puis remise. */
function meilleureAttaque(bat, u, q, r, parcouru) {
  const oq = u.q
  const or = u.r
  const op = u.parcouru
  u.q = q
  u.r = r
  u.parcouru = parcouru
  let meilleur = null
  const vus = B.visibles(bat, u.camp)
  for (const c of bat.unites) {
    if (c.camp === u.camp || c.pv <= 0) continue
    if (!B.peutAttaquer(bat, u, c)) continue
    if (!B.voitUnite(bat, u.camp, c, vus)) continue
    const p = B.prevision(bat, u, c)
    const s =
      Math.min(p.final, c.pv) * POIDS.degat +
      (p.mortelle ? POIDS.tue + c.grade * POIDS.gradeTue : 0) +
      valeurCible(bat, c) -
      p.riposte * POIDS.riposte
    if (!meilleur || s > meilleur.score) meilleur = { cible: c, score: s, prevision: p }
  }
  u.q = oq
  u.r = or
  u.parcouru = op
  return meilleur
}

/** Un ordre vaut-il mieux qu'un coup d'épée ? Réponse par la même monnaie : des points. */
function meilleurOrdre(bat, u) {
  let meilleur = null
  for (const a of B.ordresJouables(bat, u)) {
    const e = a.ordre.effets
    for (const h of B.ciblesOrdre(bat, u, a)) {
      let s = 0
      if (e.degats != null) {
        const zone = e.rayon != null ? B.vivantes(bat, u.camp === 0 ? 1 : 0) : []
        const touches = zone.filter((c) => distance(c.q, c.r, h.q, h.r) <= (e.rayon ?? 0))
        const direct = B.uniteA(bat, h.q, h.r)
        const liste = e.rayon != null ? touches : direct && direct.camp !== u.camp ? [direct] : []
        for (const c of liste) {
          const p = B.calcule(bat, u, c, { mult: e.degats, perce: !!e.perce })
          s += Math.min(p.final, c.pv) * POIDS.degat + (p.final >= c.pv ? POIDS.tue : 0)
        }
      }
      if (e.soin) {
        const c = B.uniteA(bat, h.q, h.r)
        if (c && c.camp === u.camp) s += Math.min(e.soin, c.pvMax - c.pv) * 1.1
      }
      if (e.moral != null) {
        const amis = e.moral > 0
        for (const c of B.vivantes(bat, amis ? u.camp : u.camp === 0 ? 1 : 0)) {
          if (distance(u.q, u.r, c.q, c.r) > (e.rayon ?? 0)) continue
          s += amis ? Math.min(Math.abs(e.moral), 100 - c.moral) * 0.22 : Math.min(Math.abs(e.moral), c.moral) * 0.28
        }
      }
      if (e.etat) {
        const n =
          e.cible === 'allies'
            ? B.vivantes(bat, u.camp).filter((c) => distance(u.q, u.r, c.q, c.r) <= (e.rayon ?? 0)).length
            : 1
        s += n * ((e.etat.att ?? 0) + (e.etat.def ?? 0) + (e.etat.couvert ?? 0)) * 34
      }
      if (e.fumee != null) s += 5
      if (e.piege) s += 7
      if (e.terrain) s += 4
      if (e.mvt) s += e.mvt * 1.5
      if (!meilleur || s > meilleur.score) meilleur = { apt: a, cible: h, score: s }
    }
  }
  return meilleur
}

/** Une troupe en déroute ne se bat pas : elle s'éloigne autant qu'elle peut. */
function fuit(bat, u) {
  const adverses = B.vivantes(bat, u.camp === 0 ? 1 : 0)
  if (!adverses.length) return null
  let meilleur = null
  for (const d of B.destinations(bat, u)) {
    const s = Math.min(...adverses.map((e) => distance(e.q, e.r, d.q, d.r)))
    if (!meilleur || s > meilleur.score) meilleur = { q: d.q, r: d.r, score: s }
  }
  return meilleur
}

/**
 * Le tour complet d'une troupe. Renvoie ce qui s'est passé pour que l'écran
 * puisse l'animer et le raconter — l'IA ne dessine rien elle-même.
 */
export function joueUne(bat, u) {
  if (u.pv <= 0 || B.aFini(u)) return null
  const acte = { unite: u, deplacement: null, attaque: null, ordre: null }

  if (B.enDeroute(u)) {
    const f = fuit(bat, u)
    if (f) acte.deplacement = B.deplace(bat, u, f.q, f.r)
    u.aAgi = true
    u.pm = 0
    return acte
  }

  // 1. Un ordre franchement meilleur qu'un coup se joue sur place.
  const surPlace = meilleureAttaque(bat, u, u.q, u.r, 0)
  const ord = meilleurOrdre(bat, u)
  if (ord && ord.score > (surPlace?.score ?? 0) + 6) {
    acte.ordre = B.lanceOrdre(bat, u, ord.apt, ord.cible)
    acte.aptitude = ord.apt
    if (B.aFini(u)) return acte
  }

  // 2. Sinon : la meilleure case, attaque comprise.
  let meilleur = {
    q: u.q,
    r: u.r,
    cout: 0,
    score: (surPlace?.score ?? 0) + scorePosition(bat, u, u.q, u.r),
    attaque: surPlace,
  }
  const table = B.accessibles(bat, u)
  for (const d of B.destinations(bat, u, table)) {
    const pas = B.chemin(bat, u, d.q, d.r, table).length - 1
    const att = meilleureAttaque(bat, u, d.q, d.r, pas)
    const s = (att?.score ?? 0) + scorePosition(bat, u, d.q, d.r)
    if (s > meilleur.score + 1e-6) meilleur = { q: d.q, r: d.r, cout: d.cout, score: s, attaque: att }
  }

  if (meilleur.q !== u.q || meilleur.r !== u.r) acte.deplacement = B.deplace(bat, u, meilleur.q, meilleur.r)
  const att = meilleureAttaque(bat, u, u.q, u.r, u.parcouru)
  if (att && !u.aAgi) acte.attaque = B.attaque(bat, u, att.cible)
  if (!u.aAgi) B.tient(bat, u)
  return acte
}

/** L'ordre de jeu : ce qui frappe le plus fort d'abord, pour que les appuis suivent. */
export function ordreDeJeu(bat, camp) {
  return B.vivantes(bat, camp)
    .filter((u) => !B.aFini(u))
    .sort((a, b) => B.fiche(bat, b).att - B.fiche(bat, a).att)
}

/** La prochaine troupe du camp adverse qui n'a pas encore joué. */
export const prochaine = (bat, camp) => ordreDeJeu(bat, camp)[0] ?? null

/** Le tour entier, d'un coup — c'est ce qu'utilise le banc. */
export function joueCamp(bat, camp) {
  const actes = []
  for (let garde = 0; garde < 64; garde++) {
    const u = prochaine(bat, camp)
    if (!u || bat.fini) break
    actes.push(joueUne(bat, u))
  }
  return actes
}

export { ordres }
