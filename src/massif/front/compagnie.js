/**
 * La compagnie — ce qui survit d'une bataille à l'autre.
 *
 * C'est le cœur du jeu : les troupes sont **persistantes**. Le milicien du
 * premier engagement peut finir lieutenant vingt batailles plus tard, avec ses
 * cicatrices et son nom. Une troupe abandonnée sur un champ perdu ne revient
 * pas.
 *
 * Deux recrutements coexistent, et ils ne se ressemblent pas :
 *   — la **CASERNE**, générique, où l'on achète une classe au prix du niveau ;
 *   — l'**ÉTAT-MAJOR**, où passent des gens qui ont un nom, un titre et un
 *     grade, tirés selon un taux d'apparition indexé sur le niveau.
 */
import { melange32, derive, entre, parmi, melange } from './rng.js'
import { CLASSES, CL, GRADES } from './donnees/classes.js'
import { UNIQUES, UQ, RAR } from './donnees/uniques.js'
import { BIOMES } from './terrain.js'
import * as U from './unites.js'
import * as A from './adversaire.js'
import * as B from './bataille.js'
import { genereCarte, zoneDeploiement, pointsCapture, placeLibre, OBJECTIFS, OBJ, biomePour } from './carte.js'
import { cle } from './hex.js'

export const VERSION = 1

/** Les places sur le champ : c'est le vrai plafond, pas la taille du dépôt. */
export const places = (n) => Math.min(12, 3 + Math.floor(n * 0.6))
export const escouadesMax = (n) => Math.min(3, 1 + Math.floor(n / 6))
export const tailleEscouade = (n) => Math.ceil(places(n) / escouadesMax(n))
/** Le dépôt, lui, est plus large que le champ : on garde des remplaçants. */
export const depotMax = (n) => places(n) + 8

/** Le renom qu'il faut pour passer au niveau suivant. */
export const seuilRenom = (n) => 18 + 12 * n

// --- Création et sauvegarde ------------------------------------------------------

export function nouvelle(graine) {
  const rng = melange32(derive(graine, 1))
  // La première escouade est **fixe** : une pique, un arc, un éclaireur. Tirée
  // au hasard, elle pouvait sortir trois infirmiers — et on perdait la
  // première bataille sans avoir rien compris.
  const depart = [CL.piquier, CL.archer, CL.eclaireur]
  const c = {
    v: VERSION,
    graine,
    niveau: 1,
    renom: 0,
    or: 220,
    engagements: 0,
    victoires: 0,
    pertes: 0,
    troupes: depart.map((cl) => U.creeGenerique(cl.id, 1, parmi(rng, U.NOMS), parmi(rng, U.INITIALES))),
    escouades: [],
    uniquesVus: [],
    offre: null,
    plan: null,
    choix: null,
    dernier: null,
  }
  c.escouades = [{ nom: 'PREMIÈRE', chef: c.troupes[0].id, membres: c.troupes.map((t) => t.id) }]
  rafraichit(c)
  planifie(c)
  return c
}

export const sauvegarde = (c, bat) => ({ v: VERSION, c, bat: bat ?? null })

/**
 * Relecture. Une sauvegarde d'une version inconnue est refusée franchement —
 * mieux vaut repartir que jouer sur un état à moitié compris.
 */
export function migre(brut) {
  if (!brut || brut.v !== VERSION || !brut.c?.troupes) return null
  const c = brut.c
  U.cale(c.troupes)
  c.escouades ??= []
  c.uniquesVus ??= []
  if (!c.plan) planifie(c)
  if (!c.offre) rafraichit(c)
  return brut
}

// --- Le dépôt --------------------------------------------------------------------

export const trouve = (c, id) => c.troupes.find((t) => t.id === id) ?? null

export const escouadeDe = (c, id) => c.escouades.find((e) => e.membres.includes(id)) ?? null

/** Les troupes qui montent au front : les membres des escouades, dans la limite des places. */
export function alignees(c) {
  const t = []
  for (const e of c.escouades) {
    for (const id of e.membres) {
      const u = trouve(c, id)
      if (u && !t.includes(u)) t.push(u)
    }
  }
  return t.slice(0, places(c.niveau))
}

export function creeEscouade(c) {
  if (c.escouades.length >= escouadesMax(c.niveau)) return null
  const noms = ['PREMIÈRE', 'SECONDE', 'TROISIÈME', 'QUATRIÈME']
  const e = { nom: noms[c.escouades.length] ?? 'RENFORT', chef: null, membres: [] }
  c.escouades.push(e)
  return e
}

/**
 * Affecte une troupe à une escouade. Une troupe n'est jamais dans deux
 * escouades : on la retire de l'ancienne, sans le demander.
 */
export function affecte(c, e, id) {
  const u = trouve(c, id)
  if (!u) return false
  const avant = escouadeDe(c, id)
  if (avant === e) return retireDe(c, id)
  if (e.membres.length >= tailleEscouade(c.niveau)) return false
  if (avant) retireDe(c, id)
  e.membres.push(id)
  if (!e.chef || !e.membres.includes(e.chef)) e.chef = meilleurChef(c, e)
  return true
}

export function retireDe(c, id) {
  const e = escouadeDe(c, id)
  if (!e) return false
  e.membres = e.membres.filter((m) => m !== id)
  if (e.chef === id) e.chef = meilleurChef(c, e)
  return true
}

/** Le chef par défaut : le plus haut gradé de l'escouade, le plus expérimenté à égalité. */
export function meilleurChef(c, e) {
  const membres = e.membres.map((id) => trouve(c, id)).filter(Boolean)
  if (!membres.length) return null
  return membres.reduce((a, b) => (b.grade > a.grade || (b.grade === a.grade && b.niv > a.niv) ? b : a)).id
}

/**
 * Fait monter une troupe en ligne s'il reste de la place — quitte à ouvrir une
 * escouade que le niveau autorise. Sans ça, on paie très cher un unique qui
 * reste au dépôt parce que la première escouade était pleine.
 */
export function enrole(c, id) {
  if (escouadeDe(c, id)) return true
  if (alignees(c).length >= places(c.niveau)) return false
  for (const e of c.escouades) if (affecte(c, e, id)) return true
  const neuve = creeEscouade(c)
  return neuve ? affecte(c, neuve, id) : false
}

export function nommeChef(c, e, id) {
  if (!e.membres.includes(id)) return false
  const u = trouve(c, id)
  // Un chef d'escouade est au moins caporal : c'est le sens du grade.
  if (!u || u.grade < 1) return false
  e.chef = id
  return true
}

// --- Recrutement -----------------------------------------------------------------

/** L'étal de la caserne et le carnet de l'état-major, retirés à chaque engagement. */
export function rafraichit(c) {
  const rng = melange32(derive(c.graine, 55, c.engagements, c.niveau))
  const dispo = CLASSES.filter((x) => x.rang <= c.niveau)
  const stock = melange(rng, dispo).slice(0, Math.min(6, dispo.length))
  const bassin = UNIQUES.map((u) => u.id)
  const offerts = U.tireUniques(rng, bassin, c.niveau, 3, c.uniquesVus)
  c.offre = {
    caserne: stock.map((x) => ({ cl: x.id, prix: U.prixGenerique(x.id, c.niveau), niv: c.niveau })),
    uniques: offerts.map((id) => ({
      uq: id,
      prix: U.prixUnique(id, c.niveau),
      niv: Math.max(UQ[id].rang, c.niveau),
      taux: U.tauxDrop(id, c.niveau, bassin, c.uniquesVus),
    })),
  }
}

export function recruteGenerique(c, clId) {
  const ligne = c.offre.caserne.find((x) => x.cl === clId)
  if (!ligne || c.or < ligne.prix || c.troupes.length >= depotMax(c.niveau)) return null
  const rng = melange32(derive(c.graine, 91, c.troupes.length, c.engagements))
  c.or -= ligne.prix
  const u = U.creeGenerique(clId, ligne.niv, parmi(rng, U.NOMS), parmi(rng, U.INITIALES))
  c.troupes.push(u)
  c.offre.caserne = c.offre.caserne.filter((x) => x !== ligne)
  return u
}

export function recruteUnique(c, uqId) {
  const ligne = c.offre.uniques.find((x) => x.uq === uqId)
  if (!ligne || c.or < ligne.prix || c.troupes.length >= depotMax(c.niveau)) return null
  c.or -= ligne.prix
  const u = U.creeUnique(uqId, ligne.niv)
  c.troupes.push(u)
  c.uniquesVus.push(uqId)
  c.offre.uniques = c.offre.uniques.filter((x) => x !== ligne)
  return u
}

export function reforme(c, id) {
  const u = trouve(c, id)
  if (!u) return 0
  const rendu = U.prixRevente(u, c.niveau)
  retireDe(c, id)
  c.troupes = c.troupes.filter((t) => t.id !== id)
  c.or += rendu
  return rendu
}

/** L'infirmerie : soigner coûte, et c'est ce qui donne un prix à une victoire chère. */
export const coutSoin = (c, u) => {
  const f = U.fiche(u)
  return Math.round(((f.pvMax - u.pv) * 0.9 * U.echelle(c.niveau)) / 5) * 5
}

export function soigne(c, id) {
  const u = trouve(c, id)
  if (!u) return false
  const prix = coutSoin(c, u)
  if (prix <= 0 || c.or < prix) return false
  c.or -= prix
  u.pv = U.fiche(u).pvMax
  u.blesse = 0
  return true
}

export const coutSoinTous = (c) => c.troupes.reduce((s, u) => s + coutSoin(c, u), 0)

// --- La campagne -----------------------------------------------------------------

const LIEUX = [
  'DE SAHUC',
  'DE VABRE',
  'DU GUÉ',
  'DE PEYRE',
  'DE MALRIC',
  'DES BORDES',
  'DE CAUSSE',
  'DE LAUTREC',
  'DU ROC',
  'DE PONS',
  'DE CLARAC',
  'DE MAZEL',
]

export const dimensions = (niveau) => ({
  cols: Math.min(19, 9 + Math.floor(niveau * 0.55)),
  rows: Math.min(15, 7 + Math.floor(niveau * 0.45)),
})

export const toursMaxDe = (niveau) => 16 + Math.floor(niveau * 0.8)

/**
 * Les engagements proposés — deux au début, trois ensuite. C'est là que le
 * terrain devient une décision : le même adversaire dans un marais et sur une
 * route n'est pas le même adversaire.
 */
export function planifie(c) {
  const rng = melange32(derive(c.graine, 202, c.engagements))
  const combien = c.niveau >= 3 ? 3 : 2
  const objs = OBJECTIFS.filter((o) => o.rang <= c.niveau)
  const { cols, rows } = dimensions(c.niveau)
  const biomes = melange(
    rng,
    BIOMES.map((b) => b.id),
  )
  // Des lieux distincts : deux offres « DE SAHUC » se confondent à la lecture.
  const lieux = melange(rng, LIEUX)
  const plan = []
  for (let i = 0; i < combien; i++) {
    const difficulte = 0.8 + i * 0.18 + (rng() - 0.5) * 0.1
    const obj = parmi(rng, objs)
    const biome = biomes[i % biomes.length]
    plan.push({
      k: i,
      nom: `${BIOMES.find((b) => b.id === biome).nom} ${lieux[i % lieux.length]}`,
      biome,
      objectif: obj.id,
      cols,
      rows,
      difficulte: Math.round(difficulte * 100) / 100,
      penchant: rng() < 0.5 ? null : parmi(rng, ['INF', 'LEG', 'MON', 'TIR', 'ENG']),
      or: Math.round((110 + 58 * c.niveau) * difficulte),
      renom: Math.round((10 + 2 * c.niveau) * difficulte),
      toursMax: toursMaxDe(c.niveau),
      graine: derive(c.graine, 303, c.engagements, i),
    })
  }
  c.plan = plan
  c.choix = null
  return plan
}

/** Monte la bataille : terrain, objectif, armée adverse, déploiement des deux camps. */
export function prepare(c, k) {
  const e = c.plan[k]
  if (!e) return null
  const carte = genereCarte(e.graine, e.cols, e.rows, e.biome)
  const troupes = alignees(c)
  if (!troupes.length) return null

  const budget = A.budgetDe(A.forceDe(troupes), e.difficulte)
  // Un champion adverse se paie sur le même budget : sinon il arrive en plus
  // de l'armée, et l'engagement annoncé « équilibré » ne l'est pas.
  const champion = e.difficulte >= 1 ? A.championAdverse(e.graine, c.niveau, c.uniquesVus) : null
  const adverses = A.armee(e.graine, c.niveau, budget * (champion ? 0.68 : 1), e.penchant, Math.min(14, troupes.length))
  if (champion) adverses.push(champion)

  const occupe = new Set()
  const mien = pose(carte, troupes, 0, occupe, c)
  const sien = pose(carte, adverses, 1, occupe, null)

  const objectif = { id: e.objectif, besoin: 3 }
  if (OBJ[e.objectif]?.points) {
    objectif.points = pointsCapture(e.graine, carte, c.niveau >= 8 ? 3 : 2)
    objectif.besoin = 3
  }
  if (e.objectif === 'decapitation') {
    const chef = sien.reduce((a, b) => (b.grade > a.grade || (b.grade === a.grade && b.niv > a.niv) ? b : a))
    objectif.chef = chef.ref
  }
  if (e.objectif === 'survie') {
    // Tenir le choc, ça veut dire être en dessous en nombre. Sinon ce n'est
    // qu'une bataille rangée avec un compteur.
    for (const extra of A.armee(e.graine + 7, c.niveau, budget * 0.5, e.penchant, 4)) {
      const u = B.engage(extra, 1, 0, 0)
      const place = placeLibre(carte, zoneDeploiement(carte, 1, 3)[0], occupe)
      if (!place) break
      u.q = place.q
      u.r = place.r
      u.depart = { q: u.q, r: u.r, pm: u.pm }
      occupe.add(cle(u.q, u.r))
      sien.push(u)
    }
  }

  const bat = B.commence(carte, objectif, mien, sien, { toursMax: e.toursMax })
  bat.titre = e.nom
  bat.banniere = parmi(melange32(e.graine), A.BANNIERES)
  bat.niveau = c.niveau
  bat.recompense = { or: e.or, renom: e.renom }
  return bat
}

/** Dépose une troupe par ligne, du centre vers les bords : une ligne de bataille. */
function pose(carte, troupes, camp, occupe, c) {
  const zone = zoneDeploiement(carte, camp, 2)
  const milieu = Math.floor(zone.length / 2)
  const ordre = zone
    .map((h, i) => ({ h, i }))
    .sort((a, b) => Math.abs(a.i - milieu) - Math.abs(b.i - milieu))
    .map((x) => x.h)
  const sortie = []
  for (const t of troupes) {
    const cible = ordre.find((h) => !occupe.has(cle(h.q, h.r))) ?? zone[0]
    const place = placeLibre(carte, cible, occupe)
    if (!place) continue
    const u = B.engage(t, camp, place.q, place.r)
    if (c) {
      const e = escouadeDe(c, t.id)
      u.esc = e ? c.escouades.indexOf(e) : -1
      // Un chef d'escouade tient les siens avant même le premier coup.
      if (e && e.chef && e.chef !== t.id) u.moral = Math.min(B.MORAL_PLEIN, u.moral + 8)
    }
    occupe.add(cle(place.q, place.r))
    sortie.push(u)
  }
  return sortie
}

// --- Après la bataille -------------------------------------------------------------

/**
 * Le report. C'est ici que la persistance se paie : l'expérience monte, les
 * blessures restent, et **une défaite coûte les tombés**. Une victoire les
 * ramène — mal en point, mais vivants.
 */
export function bilan(c, bat) {
  const gagne = bat.fini === 'gagne'
  const rompu = bat.fini === 'retraite'
  const rapport = { gagne, rompu, or: 0, renom: 0, lignes: [], perdus: [], montees: [] }

  for (const cu of B.unitesDe(bat, 0)) {
    const u = trouve(c, cu.ref)
    if (!u) continue
    u.batailles++
    u.tues += cu.tues
    if (cu.pv > 0) {
      u.pv = cu.pv
    } else if (gagne || u.uq) {
      // Ramassé sur le terrain : il repart, à un quart de ses forces.
      u.pv = Math.max(1, Math.round(U.fiche(u).pvMax * 0.25))
      u.blesse = 1
      rapport.lignes.push({ u, texte: 'RAMASSÉ', teinte: 'rouge' })
    } else {
      rapport.perdus.push(u)
      continue
    }
    const xp = Math.round(cu.degats * 0.55 + cu.tues * 15 + (gagne ? 16 + c.niveau * 2 : 5))
    const g = U.gagneXp(u, xp, c.niveau + 3)
    if (g.niveaux > 0 || g.grade != null) rapport.montees.push({ u, ...g })
  }

  for (const u of rapport.perdus) {
    retireDe(c, u.id)
    c.troupes = c.troupes.filter((t) => t.id !== u.id)
    c.pertes++
  }

  rapport.or = Math.round((bat.recompense?.or ?? 60) * (gagne ? 1 : rompu ? 0.3 : 0.45))
  rapport.renom = gagne ? (bat.recompense?.renom ?? 10) : 0
  c.or += rapport.or
  c.renom += rapport.renom
  c.engagements++
  if (gagne) c.victoires++

  rapport.niveaux = 0
  while (c.renom >= seuilRenom(c.niveau)) {
    c.renom -= seuilRenom(c.niveau)
    c.niveau++
    rapport.niveaux++
  }
  // Les escouades suivent le niveau : une nouvelle place ouverte est une
  // nouvelle escouade possible, mais on ne la crée pas dans le dos du joueur.
  if (!c.escouades.length) creeEscouade(c)

  rafraichit(c)
  planifie(c)
  c.dernier = { gagne, or: rapport.or, renom: rapport.renom, titre: bat.titre }
  return rapport
}

/**
 * La fin de la campagne : plus une troupe debout **et** pas de quoi en lever
 * une. Tant qu'il reste de l'or on repart d'une levée de miliciens ; c'est
 * quand la caisse est vide en même temps que le dépôt que c'est terminé.
 */
export const aneantie = (c) => c.troupes.length === 0 && !c.offre?.caserne.some((l) => l.prix <= c.or)

export { OBJECTIFS, OBJ, GRADES, CL, UQ, RAR, U }
