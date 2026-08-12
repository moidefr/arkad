import { COMP } from './donnees/competences.js'
import * as K from './combat.js'

/**
 * Les comportements des processus.
 *
 * Un processus n'a pas de « niveau d'intelligence » : il a une **politique**,
 * lisible et apprenable. C'est la leçon d'ASCENSION, où monter la lucidité de
 * l'adversaire le rendait *plus prévisible*, pas plus dur, parce que toutes
 * ses règles étaient déjà des fonctions déterministes de l'écran.
 *
 * L'intention est décidée quand le processus entre dans la fenêtre visible de
 * la file, et affichée jusqu'à ce qu'il joue : le joueur voit venir, et c'est
 * ce qui fait la différence entre un combat tactique et un lancer de dés.
 */

export const GLYPHES = { frappe: '↯', protege: '⌸', corrompt: '≈', soigne: '↺', prepare: '✦' }

const genre = (comp) => {
  if (comp.soin) return 'soigne'
  if (comp.blinde) return 'protege'
  if (comp.type === 'corruption') return 'corrompt'
  if (comp.base) return 'frappe'
  return 'prepare'
}

/** Le comportement décide *quelle* compétence ; le ciblage suit la forme. */
const POLITIQUES = {
  /** Cogne ce qui est devant, sans réfléchir. */
  devant: (c, p, jouables) => jouables[0],
  /** Vise le plus faible : il achève. */
  faible: (c, p, jouables) => jouables[0],
  /** Se protège dès qu'il le peut, sinon frappe. */
  tenace: (c, p, jouables) => jouables.find((x) => COMP[p.comp[x]].blinde && !p.etats.pare) ?? jouables.at(-1),
  /** Empoisonne d'abord, frappe ensuite. */
  rongeur: (c, p, jouables) => jouables.find((x) => COMP[p.comp[x]].fuite) ?? jouables[0],
  /** Garde son gros coup pour une cible déjà entamée. */
  brutal: (c, p, jouables) => {
    const entame = K.vivants(c.ops).some((o) => o.pv < o.pvMax * 0.5)
    const lourd = jouables.find((x) => COMP[p.comp[x]].base >= 20)
    return entame && lourd !== undefined ? lourd : jouables[0]
  },
  /** Frappe vite et souvent : il use. */
  presse: (c, p, jouables) => jouables.reduce((a, b) => (COMP[p.comp[a]].temps <= COMP[p.comp[b]].temps ? a : b)),
  /**
   * Répare le plus abîmé de son camp, sinon frappe.
   *
   * Écrit `(blesse && trouve) ?? jouables[0]`, ce comportement rendait `false`
   * quand personne n'était blessé — `??` ne rattrape pas `false` — et le noyau
   * soigneur passait son tour puis se soignait lui-même à l'infini. Il tenait
   * trente-neuf tours sans jamais blesser l'équipe.
   */
  soigneur: (c, p, jouables) => {
    const blesse = K.vivants(c.proc).some((x) => x.pv < x.pvMax * 0.6)
    if (!blesse) return jouables.find((x) => COMP[p.comp[x]].base) ?? jouables[0]
    return jouables.find((x) => COMP[p.comp[x]].soin) ?? jouables[0]
  },
  /** Préfère toucher tout le monde. */
  arrose: (c, p, jouables) =>
    jouables.find((x) => COMP[p.comp[x]].forme === 'tous' || COMP[p.comp[x]].forme === 'rang') ?? jouables[0],
}

/** Ce que le processus va faire. Calculé une fois, affiché, puis exécuté. */
export function decide(c, p) {
  const jouables = p.comp.map((_, k) => k).filter((k) => K.jouable(c, p, COMP[p.comp[k]], k))
  if (!jouables.length) return null
  const choisir = POLITIQUES[p.comportement] ?? POLITIQUES.devant
  const k = choisir(c, p, jouables) ?? jouables[0]
  return { k, glyphe: GLYPHES[genre(COMP[p.comp[k]])] }
}

/** Sur qui. Séparé du choix de compétence : deux décisions, deux règles. */
export function vise(c, p, k) {
  const comp = COMP[p.comp[k]]
  const legales = K.cibles(c, p, comp)
  if (!legales.length) return null
  if (comp.soin) return legales.reduce((a, b) => (a.pv / a.pvMax <= b.pv / b.pvMax ? a : b))
  if (comp.forme === 'soi') return p
  if (p.comportement === 'faible') return legales.reduce((a, b) => (a.pv <= b.pv ? a : b))
  if (p.comportement === 'brutal') return legales.reduce((a, b) => (a.pv / a.pvMax <= b.pv / b.pvMax ? a : b))
  // Par défaut : le rang avant, puis le plus proche de la mort. Un adversaire
  // qui tape au hasard n'apprend rien au joueur.
  const front = legales.filter((u) => u.rang === K.frontDe(K.campDe(c, legales[0])))
  const bassin = front.length ? front : legales
  return bassin[0]
}

/** Un tour complet de processus : décide, vise, joue. */
export function tourProcessus(c, p) {
  K.recharge(p)
  const choix = p.intent && p.intentK != null ? { k: p.intentK } : decide(c, p)
  if (!choix || !K.jouable(c, p, COMP[p.comp[choix.k]], choix.k)) {
    const secours = decide(c, p)
    if (!secours) {
      K.passe(c, p)
      return null
    }
    return jouer(c, p, secours.k)
  }
  return jouer(c, p, choix.k)
}

function jouer(c, p, k) {
  const cible = vise(c, p, k)
  if (!cible) {
    K.passe(c, p)
    return null
  }
  p.intent = null
  p.intentK = null
  return K.joue(c, p, k, cible)
}

/** Fixe l'intention des processus qui viennent d'entrer dans la fenêtre visible. */
export function annonce(c) {
  const fenetre = new Set(K.file(c, K.FILE_VUE))
  for (const p of K.vivants(c.proc)) {
    if (!fenetre.has(p)) {
      p.intent = null
      p.intentK = null
      continue
    }
    if (p.intent) continue
    const choix = decide(c, p)
    if (!choix) continue
    p.intent = choix.glyphe
    p.intentK = choix.k
  }
}
