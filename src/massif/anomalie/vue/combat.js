import { C, ton } from '../../../palette.js'
import { rect, cadre, texte, lueur, borne } from '../../../dessin.js'
import { COMP } from '../donnees/competences.js'
import { CLASSE } from '../donnees/classes.js'
import { PROC } from '../donnees/ennemis.js'
import * as K from '../combat.js'
import * as P from './pieces.js'

/**
 * L'écran de combat.
 *
 * Il tient sur 360 px parce que **le tour appartient à un seul opérateur à la
 * fois** : la moitié basse n'affiche jamais que ses six compétences. C'est la
 * décision qui rend un jeu à trois personnages lisible sur un téléphone.
 *
 * `zones()` produit la table des rectangles touchables, et `dessine()` peint
 * exactement les mêmes. Les deux lisent `K.cibles()` : une case qui s'allume
 * est une case qu'on peut toucher, toujours.
 */

const TRACAGE = { x: 16, y: 86, w: 328, h: 8 }
/**
 * Le rang avant est dessiné **en bas**, au contact des opérateurs, et
 * l'arrière derrière lui. Écrit dans l'autre sens, le camp adverse se lisait à
 * l'envers : ce qui protégeait était devant ce qui était protégé.
 */
const PROCS = { y: { 0: 170, 1: 102 }, h: 62, x: [20, 184], w: 156 }
const OPS = { y: 246, h: 112, w: 104, pas: 108, x0: 20 }
/**
 * Seul, l'opérateur prend toute la largeur mais moins de hauteur : la place
 * gagnée va à sa main, qui compte huit cartes au lieu de six. Un écran conçu
 * pour trois et rempli par un est un écran à moitié vide.
 */
const OPS_SEUL = { y: 246, h: 76, w: 320, x0: 20 }
const CYCLES = { x: 20, y: 366, w: 256, h: 18 }
const CYCLES_SEUL = { x: 20, y: 330, w: 256, h: 18 }
const CHAINE = { x: 288, y: 366, pas: 20, taille: 14 }
const MAIN = { x: [20, 184], y: [392, 466, 540] }
const MAIN_SEUL = { x: [20, 184], y: [356, 422, 488, 554] }
const AIDE = { y: 628, seul: 636 }

/** Où se dessine un processus : deux rangs de deux, ou une carte centrée s'il est seul. */
export function placeProc(c, p) {
  const rang = p.rang
  const memeRang = c.proc.filter((x) => x.rang === rang)
  const k = memeRang.indexOf(p)
  const y = PROCS.y[rang]
  // Seul sur son rang, un processus prend toute la largeur : deux cartes de
  // moitié dont une vide, ce serait un écran à moitié perdu.
  if (memeRang.length === 1) return { x: 20, y, w: 320, h: PROCS.h }
  return { x: PROCS.x[Math.min(1, k)], y, w: PROCS.w, h: PROCS.h }
}

export const placeOp = (i, seul = false) =>
  seul
    ? { x: OPS_SEUL.x0, y: OPS_SEUL.y, w: OPS_SEUL.w, h: OPS_SEUL.h }
    : { x: OPS.x0 + i * OPS.pas, y: OPS.y, w: OPS.w, h: OPS.h }

export const placeCarte = (k, seul = false) => {
  const m = seul ? MAIN_SEUL : MAIN
  const rangee = Math.floor(k / 2)
  if (rangee >= m.y.length) return { x: -999, y: -999, w: 0, h: 0 }
  return { x: m.x[k % 2], y: m.y[rangee], w: P.CARTE.w, h: seul ? 60 : P.CARTE.h }
}

/**
 * Les zones touchables de l'écran, dans l'ordre où elles sont testées.
 * `choisie` est l'indice de la compétence sélectionnée, ou null.
 */
export function zones(c, choisie) {
  const out = []
  const u = K.actif(c)
  const joueur = u && K.estOperateur(c, u)

  if (joueur) {
    for (let k = 0; k < u.comp.length; k++) {
      if (!u.comp[k]) continue
      out.push({ quoi: 'comp', k, ...placeCarte(k, c.seul) })
    }
    if (choisie != null) {
      const comp = COMP[u.comp[choisie]]
      for (const cible of K.cibles(c, u, comp)) {
        const camp = K.estOperateur(c, cible) ? 'op' : 'proc'
        const boite = camp === 'op' ? placeOp(c.ops.indexOf(cible), c.seul) : placeProc(c, cible)
        out.push({ quoi: 'cible', cible, ...boite })
      }
    }
  }
  return out
}

export function dessine(j, ctx, c, choisie) {
  const u = K.actif(c)
  const joueur = u && K.estOperateur(c, u)
  const comp = joueur && choisie != null ? COMP[u.comp[choisie]] : null
  const legales = comp ? new Set(K.cibles(c, u, comp)) : null

  P.file(ctx, K.file(c, K.FILE_VUE), (x) => K.estOperateur(c, x))
  tracage(ctx, c)

  for (const p of c.proc) {
    const b = placeProc(c, p)
    P.fiche(ctx, b.x, b.y, b.w, b.h, p, {
      teinte: PROC[p.e].couleur,
      actif: p === u,
      visable: legales ? legales.has(p) : undefined,
      glyphe: p.intent,
    })
  }

  rect(ctx, 16, 238, 328, 2, ton(C.bord, -0.2))

  c.ops.forEach((o, i) => {
    const b = placeOp(i, c.seul)
    P.fiche(ctx, b.x, b.y, b.w, b.h, o, {
      teinte: CLASSE[o.cl].couleur,
      actif: o === u,
      visable: legales ? legales.has(o) : undefined,
    })
    // Le rang, en un caractère : c'est une information tactique, pas un décor.
    // Seul, il n'y a qu'un rang occupé, donc rien à dire.
    if (!c.seul) {
      texte(ctx, o.rang === 0 ? '▲' : '▼', b.x + b.w - 12, b.y + 52, 11, ton(CLASSE[o.cl].couleur, 0.2), 700, 12)
    }
  })

  cycles(ctx, c)
  chaine(ctx, c)

  if (joueur) main(ctx, c, u, choisie)
  else texte(ctx, `${u ? u.nom : '—'} joue…`, 180, c.seul ? 450 : 470, 18, C.rouge, 700, 320)

  aide(ctx, c, u, comp, joueur)
}

// --- Les jauges ------------------------------------------------------------------------

function tracage(ctx, c) {
  const k = c.tracage / K.TRACAGE_MAX
  const teinte = c.tracage >= 60 ? C.rouge : C.accent
  if (c.tracage >= 80) lueur(ctx, TRACAGE.x, TRACAGE.y, TRACAGE.w, TRACAGE.h, C.rouge, 2, 0.7)
  P.barre(ctx, TRACAGE.x, TRACAGE.y, TRACAGE.w, TRACAGE.h, k, teinte)
  // Le plancher, marqué d'un trait : il monte avec la durée du combat et dit
  // sans un mot qu'on ne gagnera pas en durant.
  const plancher = K.plancherTracage(c) / K.TRACAGE_MAX
  if (plancher > 0.02) {
    rect(ctx, TRACAGE.x + TRACAGE.w * plancher - 1, TRACAGE.y - 3, 2, TRACAGE.h + 6, ton(C.rouge, 0.3))
  }
}

function cycles(ctx, c) {
  const boite = c.seul ? CYCLES_SEUL : CYCLES
  const n = c.cyclesMax
  const large = (boite.w - (n - 1) * 2) / n
  for (let k = 0; k < n; k++) {
    const x = boite.x + k * (large + 2)
    const plein = k < c.cycles
    if (plein) lueur(ctx, x, boite.y, large, boite.h, C.accent, 2, 0.5)
    rect(ctx, x, boite.y, large, boite.h, plein ? C.accent : ton(C.panneau, -0.3))
  }
}

function chaine(ctx, c) {
  const y0 = c.seul ? CYCLES_SEUL.y : CHAINE.y
  K.CHAINE_TAGS.forEach((tag, k) => {
    const allume = c.chaine.includes(tag)
    const x = CHAINE.x + k * CHAINE.pas
    if (allume) lueur(ctx, x, y0 + 2, CHAINE.taille, CHAINE.taille, C.vert, 2, 0.8)
    rect(ctx, x, y0 + 2, CHAINE.taille, CHAINE.taille, allume ? C.vert : ton(C.panneau, -0.2))
    cadre(ctx, x, y0 + 2, CHAINE.taille, CHAINE.taille, allume ? C.vert : ton(C.bord, -0.2))
  })
}

// --- La main ----------------------------------------------------------------------------

function main(ctx, c, u, choisie) {
  for (let k = 0; k < u.comp.length; k++) {
    const b = placeCarte(k, c.seul)
    if (b.w <= 0) continue
    const id = u.comp[k]
    const comp = COMP[id]
    const prix = comp ? K.cout(u, comp) : 0
    P.carteComp(ctx, b.x, b.y, id, {
      cout: prix,
      dispo: comp ? K.jouable(c, u, comp, k) : false,
      choisie: k === choisie,
      recharge: u.rech[k] ?? 0,
      compacte: c.seul,
    })
  }
}

function aide(ctx, c, u, comp, joueur) {
  let ligne = ''
  if (!joueur) ligne = 'le système répond'
  else if (comp) ligne = 'choisis une cible — appuie encore sur la carte pour annuler'
  else {
    const rien = u.comp.every((id, k) => !id || !K.jouable(c, u, COMP[id], k))
    ligne = rien ? 'plus rien de jouable — appuie deux fois pour passer' : `${u.nom} · ${c.cycles} cycles`
  }
  texte(ctx, ligne, 180, c.seul ? AIDE.seul : AIDE.y, 11, C.faible, 700, 336)
}

// --- Le journal, en surimpression -----------------------------------------------------------

/**
 * La dernière chose qui s'est passée, en une ligne sous les cartes. L'écran
 * n'a pas la place d'un vrai journal, et il n'en a pas besoin : les dégâts
 * montent déjà en bulle sur la cible. Ce qu'on veut ici, c'est le mot qui dit
 * *pourquoi* — une chaîne, un repérage.
 */
export function journal(ctx, c) {
  const l = c.journal.at(-1)
  if (!l) return
  const somme = l.coups.reduce((s, x) => s + (x.degats ?? 0), 0)
  const bout = l.coups.some((x) => x.esquive) ? 'esquivé' : somme ? `−${somme}` : '·'
  const teinte = l.repere ? C.rouge : l.prime ? C.vert : ton(C.faible, -0.15)
  const suffixe = l.repere ? '  ·  REPÉRÉ' : l.prime ? '  ·  CHAÎNE' : ''
  texte(ctx, `${l.acteur} ${l.comp} ${bout}${suffixe}`, 180, c.seul ? 623 : 614, 11, teinte, 700, 336)
}

export { borne }
