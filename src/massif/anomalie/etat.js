import { melange32, sousGraine, pioche, entier } from './rng.js'
import { CLASSES, CLASSE, NOMS } from './donnees/classes.js'
import { COMP } from './donnees/competences.js'
import { MODULE, MODULES, oppose, EMPLACEMENTS_MODULE } from './donnees/modules.js'
import * as Carte from './carte.js'
import { SOLO } from './combat.js'

/**
 * L'état d'une partie, sa sérialisation et sa migration.
 *
 * **Tout est un indice dans une table**, jamais un nom, jamais un objet
 * complet : une sauvegarde de six kilo-octets décrit une campagne entière, et
 * on peut fermer l'application au milieu d'un échange pour reprendre au même
 * tour trois jours plus tard.
 *
 * **Les tables de données sont en ajout seul** — on ne réordonne jamais, on ne
 * supprime jamais une ligne, puisqu'une sauvegarde pointe dessus. Ici les
 * indices sont des identifiants texte, ce qui rend la règle plus facile à
 * tenir : renommer un `id` casse le test des données.
 */

export const VERSION = 3

/** Six emplacements par opérateur : deux verrouillés, quatre libres. */
export const EMPLACEMENTS = 6
export const VERROUS = 2

/**
 * Un opérateur seul porte tout le rôle d'une équipe de trois : il lui faut de
 * quoi le ranger. Huit compétences et quatre modules au lieu de six et trois —
 * sans ça, le butin cesse d'offrir quoi que ce soit à mi-partie et les nœuds
 * ARCHIVE deviennent des couloirs vides.
 */
export const EMPLACEMENTS_SOLO = 8
export const MODULES_SOLO = 4

export const emplacementsDe = (e) => (e.equipe.length === 1 ? EMPLACEMENTS_SOLO : EMPLACEMENTS)
export const modulesDe = (e) => (e.equipe.length === 1 ? MODULES_SOLO : EMPLACEMENTS_MODULE)
export const estSeul = (e) => e.equipe.length === 1

// --- Une partie neuve -------------------------------------------------------------

export function nouvelle(graine, classes, mode = 'campagne') {
  const rng = melange32(graine)
  const noms = pioche(rng, NOMS, 3)
  return {
    v: VERSION,
    graine,
    mode,
    acte: 1,
    position: null, // null = on n'est pas encore entré dans la première couche
    visites: [],
    fardeaux: [],
    verrous: [], // les modules verrouillés par leur antagoniste, pour la partie
    equipe: classes.map((cl, i) => nouvelOperateur(cl, noms[i], classes.length === 1)),
    combat: null,
    offre: null,
    fini: false,
  }
}

export function nouvelOperateur(cl, nom, seul = false) {
  const c = CLASSE[cl]
  const comp = c.depart.slice()
  while (comp.length < (seul ? EMPLACEMENTS_SOLO : EMPLACEMENTS)) comp.push(null)
  // L'intégrité renforcée du mode solo appartient à la **fiche**, pas au
  // combat : calculée à l'engagement, elle laissait l'opérateur commencer sa
  // partie à moitié blessé, son `pv` de départ ayant été fixé sur la valeur
  // non renforcée de la classe.
  const pvMax = Math.round(c.pv * (seul ? SOLO.pv : 1))
  return {
    cl,
    nom,
    pv: pvMax,
    pvMax,
    rang: c.rang,
    comp,
    mod: Array(seul ? MODULES_SOLO : EMPLACEMENTS_MODULE).fill(null),
    affute: [],
  }
}

/** Quatre classes proposées, trois à prendre : le recrutement est déjà un choix. */
export const classesOffertes = (graine) =>
  pioche(
    melange32(sousGraine(graine, 7)),
    CLASSES.map((c) => c.id),
    Math.min(4, CLASSES.length),
  )

// --- L'acte ------------------------------------------------------------------------

/** La carte de l'acte courant, reconstruite à la demande depuis la graine. */
export const carteDe = (e) => Carte.engendre(e.graine, e.acte, e.mode)

export const noeudCourant = (e) => {
  if (!e.position) return null
  const c = carteDe(e)
  return Carte.noeudA(c, e.position.couche, e.position.k)
}

export const rencontre = (e) => {
  const n = noeudCourant(e)
  return n ? Carte.rencontre(e.graine, e.acte, e.position.couche, e.position.k, n.type, e.mode, e.equipe.length) : []
}

/** Avance sur la carte. Rend `'acte'` quand l'acte est fini, `'carte'` sinon. */
export function descend(e, couche, k) {
  e.position = { couche, k }
  e.visites.push([couche, k])
  return 'noeud'
}

export function finActe(e) {
  const c = carteDe(e)
  return Carte.termine(c, e.position)
}

/**
 * Rend `'suite'` si un acte de plus attend, `'fin'` si la campagne est purgée.
 * En mode infini, il n'y a jamais de `'fin'` : c'est tout le principe.
 */
export function acteSuivant(e) {
  if (e.mode === 'campagne' && e.acte >= Carte.DERNIER_ACTE) return 'fin'
  e.acte++
  e.position = null
  e.visites = []
  return 'suite'
}

/** Tous les trois actes de descente, un fardeau à choisir parmi trois. */
export const doitChoisirFardeau = (e) => e.mode === 'infini' && e.acte > 1 && (e.acte - 1) % 3 === 0

// --- Le butin -----------------------------------------------------------------------

/**
 * Une offre : trois compétences pour un opérateur donné. S'il n'a plus
 * d'emplacement libre, il faut en jeter une — sur place, tout de suite. C'est
 * la réponse directe au défaut d'ASCENSION, où l'on finissait avec les huit
 * reliques du jeu : ici **on ne finit jamais avec tout, on finit avec un choix**.
 */
export function offre(e, quoi = 'comp') {
  const rng = melange32(sousGraine(e.graine, e.acte, e.position?.couche ?? 0, e.position?.k ?? 0, 23))
  const i = entier(rng, e.equipe.length)
  const op = e.equipe[i]
  if (quoi === 'module') {
    // Un module verrouillé par son antagoniste n'est même pas proposé : le
    // choix exclusif doit être annoncé au moment où on le fait, pas subi après.
    const dispo = MODULES.filter((m) => !e.verrous.includes(m.id) && !porte(e, m.id))
    if (!dispo.length) return null
    return { op: i, quoi: 'module', choix: pioche(rng, dispo, Math.min(3, dispo.length)).map((m) => m.id) }
  }
  const dispo = CLASSE[op.cl].reserve.filter((id) => !op.comp.includes(id))
  if (!dispo.length) return null
  return { op: i, quoi: 'comp', choix: pioche(rng, dispo, Math.min(3, dispo.length)) }
}

const porte = (e, id) => e.equipe.some((o) => (o.mod ?? []).includes(id))

/** Prend un module. Son antagoniste devient inaccessible pour toute la partie. */
export function prendModule(e, offreCourante, id, jette = -1) {
  const op = e.equipe[offreCourante.op]
  if (!offreCourante.choix.includes(id) || !MODULE[id]) return false
  const libre = op.mod.indexOf(null)
  const place = libre >= 0 ? libre : jette
  if (place < 0 || place >= modulesDe(e)) return false
  op.mod[place] = id
  const adverse = oppose(id)
  if (adverse && !e.verrous.includes(adverse)) e.verrous.push(adverse)
  return true
}

export const librePour = (op) => op.comp.indexOf(null)

/** Accepte une compétence. `jette` est l'emplacement sacrifié, ou -1 s'il y a de la place. */
export function prend(e, offreCourante, idComp, jette = -1) {
  const op = e.equipe[offreCourante.op]
  if (!offreCourante.choix.includes(idComp)) return false
  const libre = librePour(op)
  if (libre >= 0) {
    op.comp[libre] = idComp
    return true
  }
  if (jette < VERROUS || jette >= emplacementsDe(e)) return false
  op.comp[jette] = idComp
  return true
}

/**
 * L'atelier propose trois choses et on n'en prend qu'une. Souffler, affûter,
 * ou désinstaller : soigner tout de suite, gagner en économie pour la suite,
 * ou libérer un emplacement pour ce qui viendra. Un nœud qui ne fait qu'une
 * chose n'est pas un choix, c'est un couloir.
 */
export const ATELIER = [
  { id: 'souffle', nom: 'SOUFFLER', dit: 'chaque opérateur récupère 35 % de son intégrité' },
  { id: 'affute', nom: 'AFFÛTER', dit: 'une compétence coûte un cycle de moins et recharge plus vite' },
  { id: 'retire', nom: 'DÉSINSTALLER', dit: 'oublier une compétence pour libérer sa place' },
]

export function souffle(e) {
  for (const o of e.equipe) o.pv = Math.min(o.pvMax, o.pv + Math.round(o.pvMax * 0.35))
}

/** Les compétences qu'un atelier peut encore affûter, tous opérateurs confondus. */
export const affutables = (e) =>
  e.equipe.flatMap((o, i) => o.comp.map((id, k) => ({ op: i, k, id })).filter((x) => x.id && !o.affute.includes(x.id)))

/** Celles qu'on peut désinstaller : jamais les deux verrouillées. */
export const retirables = (e) =>
  e.equipe.flatMap((o, i) => o.comp.map((id, k) => ({ op: i, k, id })).filter((x) => x.id && x.k >= VERROUS))

export function affute(e, op, k) {
  const o = e.equipe[op]
  const id = o.comp[k]
  if (!id || o.affute.includes(id)) return false
  o.affute.push(id)
  return true
}

export function retire(e, op, k) {
  const o = e.equipe[op]
  if (k < VERROUS || !o.comp[k]) return false
  o.comp[k] = null
  return true
}

// --- Sérialisation --------------------------------------------------------------------

export const sauvegarde = (e) => ({
  v: VERSION,
  graine: e.graine,
  mode: e.mode,
  acte: e.acte,
  position: e.position,
  visites: e.visites,
  verrous: e.verrous,
  fardeaux: e.fardeaux ?? [],
  equipe: e.equipe.map((o) => ({
    cl: o.cl,
    nom: o.nom,
    pv: o.pv,
    pvMax: o.pvMax,
    rang: o.rang,
    comp: o.comp,
    mod: o.mod,
    affute: o.affute ?? [],
  })),
  combat: e.combat ? compacte(e.combat) : null,
  offre: e.offre,
  fini: e.fini,
})

/** Le combat en cours, réduit à ce qui ne se recalcule pas. */
const compacte = (c) => ({
  ops: c.ops.map((o) => ({ pv: o.pv, rang: o.rang, att: o.att, etats: o.etats, rech: o.rech })),
  proc: c.proc.map((p) => ({ e: p.e, pv: p.pv, rang: p.rang, att: p.att, etats: p.etats, rech: p.rech })),
  cycles: c.cycles,
  tracage: c.tracage,
  chaine: c.chaine,
  tour: c.tour,
})

export function migre(s) {
  if (!s || typeof s !== 'object') return null
  if (s.v !== VERSION) return null // aucune version antérieure n'existe encore
  if (!Array.isArray(s.equipe) || (s.equipe.length !== 3 && s.equipe.length !== 1)) return null
  for (const o of s.equipe) {
    if (!CLASSE[o.cl]) return null
    if (!Array.isArray(o.comp) || o.comp.some((id) => id !== null && !COMP[id])) return null
  }
  return {
    v: VERSION,
    graine: s.graine >>> 0,
    mode: s.mode === 'infini' ? 'infini' : 'campagne',
    acte: Math.max(1, s.mode === 'infini' ? s.acte | 0 : Math.min(Carte.DERNIER_ACTE, s.acte | 0)),
    position: s.position?.couche >= 0 ? { couche: s.position.couche | 0, k: s.position.k | 0 } : null,
    visites: Array.isArray(s.visites) ? s.visites : [],
    fardeaux: Array.isArray(s.fardeaux) ? s.fardeaux : [],
    verrous: Array.isArray(s.verrous) ? s.verrous.filter((id) => MODULE[id]) : [],
    equipe: s.equipe.map((o) => ({
      cl: o.cl,
      nom: String(o.nom ?? '?'),
      pv: Math.max(0, o.pv | 0),
      pvMax: Math.max(1, o.pvMax | 0),
      rang: o.rang === 1 ? 1 : 0,
      comp: o.comp.slice(0, s.equipe.length === 1 ? EMPLACEMENTS_SOLO : EMPLACEMENTS),
      mod: (Array.isArray(o.mod) ? o.mod : [])
        .slice(0, s.equipe.length === 1 ? MODULES_SOLO : EMPLACEMENTS_MODULE)
        .map((id) => (MODULE[id] ? id : null)),
      affute: (Array.isArray(o.affute) ? o.affute : []).filter((id) => COMP[id]),
    })),
    combat: s.combat ?? null,
    offre: s.offre ?? null,
    fini: !!s.fini,
  }
}

/** Remet un combat sauvegardé sur pied à partir des tables. */
export function reprend(e, brut, commence) {
  const c = commence(
    e.equipe,
    brut.proc.map((p) => p.e),
  )
  brut.ops.forEach((o, i) =>
    Object.assign(c.ops[i], { pv: o.pv, rang: o.rang, att: o.att, etats: o.etats, rech: o.rech }),
  )
  brut.proc.forEach((p, i) =>
    Object.assign(c.proc[i], { pv: p.pv, rang: p.rang, att: p.att, etats: p.etats, rech: p.rech }),
  )
  c.cycles = brut.cycles
  c.tracage = brut.tracage
  c.chaine = brut.chaine ?? []
  c.tour = brut.tour ?? 0
  return c
}
