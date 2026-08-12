import { melange32, sousGraine, pioche, parmi, entier } from './rng.js'
import { CLASSES, CLASSE, NOMS } from './donnees/classes.js'
import { COMP } from './donnees/competences.js'
import { PROCESSUS, NOYAUX } from './donnees/ennemis.js'

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

export const VERSION = 1

/** Six emplacements par opérateur : deux verrouillés, quatre libres. */
export const EMPLACEMENTS = 6
export const VERROUS = 2

// --- Une partie neuve -------------------------------------------------------------

export function nouvelle(graine, classes) {
  const rng = melange32(graine)
  const noms = pioche(rng, NOMS, 3)
  return {
    v: VERSION,
    graine,
    mode: 'campagne',
    acte: 1,
    noeud: 0,
    equipe: classes.map((cl, i) => nouvelOperateur(cl, noms[i])),
    combat: null,
    offre: null,
    fini: false,
  }
}

export function nouvelOperateur(cl, nom) {
  const c = CLASSE[cl]
  const comp = c.depart.slice()
  while (comp.length < EMPLACEMENTS) comp.push(null)
  return { cl, nom, pv: c.pv, pvMax: c.pv, rang: c.rang, comp }
}

/** Trois classes tirées, différentes. Le recrutement en propose plus qu'il n'en faut. */
export const classesOffertes = (graine) =>
  pioche(
    melange32(sousGraine(graine, 7)),
    CLASSES.map((c) => c.id),
    CLASSES.length,
  )

// --- L'acte ------------------------------------------------------------------------

/**
 * L'acte I est une ligne droite de sept nœuds : le graphe à embranchements
 * vient au lot suivant. Ce qui compte d'abord, c'est que le combat soit juste ;
 * une carte magnifique par-dessus un combat faux ne vaut rien.
 */
export const NOEUDS_ACTE = [
  { type: 'processus', force: 0 },
  { type: 'processus', force: 1 },
  { type: 'archive' },
  { type: 'processus', force: 2 },
  { type: 'atelier' },
  { type: 'processus', force: 3 },
  { type: 'noyau' },
]

export const noeudCourant = (e) => NOEUDS_ACTE[e.noeud] ?? null

/** La rencontre d'un nœud, tirée de la graine : la même partie donne la même carte. */
export function rencontre(e) {
  const n = noeudCourant(e)
  if (!n) return []
  const rng = melange32(sousGraine(e.graine, e.acte, e.noeud, 11))
  if (n.type === 'noyau') {
    const noyau = parmi(rng, NOYAUX)
    // Un noyau à règle d'escorte n'arrive jamais seul, sinon la règle ne dit rien.
    return noyau.escorte ? [noyau.id, ...noyau.escorte] : [noyau.id]
  }
  const combien = Math.min(4, 1 + Math.floor(n.force / 1.5) + entier(rng, 2))
  return pioche(rng, PROCESSUS, Math.min(combien, PROCESSUS.length)).map((p) => p.id)
}

// --- Le butin -----------------------------------------------------------------------

/**
 * Une offre : trois compétences pour un opérateur donné. S'il n'a plus
 * d'emplacement libre, il faut en jeter une — sur place, tout de suite. C'est
 * la réponse directe au défaut d'ASCENSION, où l'on finissait avec les huit
 * reliques du jeu : ici **on ne finit jamais avec tout, on finit avec un choix**.
 */
export function offre(e) {
  const rng = melange32(sousGraine(e.graine, e.acte, e.noeud, 23))
  const i = entier(rng, e.equipe.length)
  const op = e.equipe[i]
  const dispo = CLASSE[op.cl].reserve.filter((id) => !op.comp.includes(id))
  if (!dispo.length) return null
  return { op: i, choix: pioche(rng, dispo, Math.min(3, dispo.length)) }
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
  if (jette < VERROUS || jette >= EMPLACEMENTS) return false
  op.comp[jette] = idComp
  return true
}

// --- Sérialisation --------------------------------------------------------------------

export const sauvegarde = (e) => ({
  v: VERSION,
  graine: e.graine,
  mode: e.mode,
  acte: e.acte,
  noeud: e.noeud,
  equipe: e.equipe.map((o) => ({ cl: o.cl, nom: o.nom, pv: o.pv, pvMax: o.pvMax, rang: o.rang, comp: o.comp })),
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
  if (!Array.isArray(s.equipe) || s.equipe.length !== 3) return null
  for (const o of s.equipe) {
    if (!CLASSE[o.cl]) return null
    if (!Array.isArray(o.comp) || o.comp.some((id) => id !== null && !COMP[id])) return null
  }
  return {
    v: VERSION,
    graine: s.graine >>> 0,
    mode: s.mode === 'infini' ? 'infini' : 'campagne',
    acte: Math.max(1, s.acte | 0),
    noeud: Math.max(0, Math.min(NOEUDS_ACTE.length, s.noeud | 0)),
    equipe: s.equipe.map((o) => ({
      cl: o.cl,
      nom: String(o.nom ?? '?'),
      pv: Math.max(0, o.pv | 0),
      pvMax: Math.max(1, o.pvMax | 0),
      rang: o.rang === 1 ? 1 : 0,
      comp: o.comp.slice(0, EMPLACEMENTS),
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
