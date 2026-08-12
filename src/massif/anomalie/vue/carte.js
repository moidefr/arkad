import { C, ton } from '../../../palette.js'
import { rect, cadre, texte, lueur } from '../../../dessin.js'
import * as Carte from '../carte.js'
import * as P from './pieces.js'

/**
 * La carte d'un acte, qu'on descend.
 *
 * Les arêtes sont tracées **en L** — vertical puis horizontal — jamais en
 * diagonale : c'est la grammaire du projet, et elle vaut aussi pour un graphe.
 */

const HAUT = 118
const BAS = 512
const NOEUD = { w: 56, h: 34 }

const yCouche = (i, total) => HAUT + (i * (BAS - HAUT)) / Math.max(1, total - 1)

export function place(carte, couche, k) {
  const n = carte.couches[couche].length
  const largeur = 76 * n - 20
  const x0 = (360 - largeur) / 2
  return { x: x0 + k * 76, y: yCouche(couche, carte.couches.length) - NOEUD.h / 2, w: NOEUD.w, h: NOEUD.h }
}

export function dessine(ctx, carte, position, visites, choisi) {
  const acte = Carte.acteDe(carte.acte)
  rect(ctx, 0, 58, 360, 40, C.fond)
  ctx.textAlign = 'left'
  texte(ctx, acte.nom, 20, 80, 22, C.accent, 700, 220, 2)
  ctx.textAlign = 'right'
  texte(ctx, `${(position?.couche ?? -1) + 1} / ${carte.couches.length}`, 340, 80, 14, C.faible, 700, 90)
  ctx.textAlign = 'center'
  rect(ctx, 20, 92, 320, 2, ton(C.bord, -0.2))

  const ouverts = Carte.accessibles(carte, position)
  const estOuvert = (couche, k) => ouverts.some((o) => o.couche === couche && o.k === k)
  const estVisite = (couche, k) => visites.some(([a, b]) => a === couche && b === k)

  // Les arêtes d'abord, pour qu'elles passent sous les nœuds.
  carte.couches.forEach((ligne, i) => {
    if (i === carte.couches.length - 1) return
    ligne.forEach((n, k) => {
      const a = place(carte, i, k)
      for (const vers of n.liens) {
        const b = place(carte, i + 1, vers)
        const vif = estVisite(i, k) && estVisite(i + 1, vers)
        const teinte = vif ? ton(C.accent, -0.2) : ton(C.bord, -0.35)
        const ax = a.x + a.w / 2
        const bx = b.x + b.w / 2
        const mi = (a.y + a.h + b.y) / 2
        rect(ctx, ax - 1, a.y + a.h, 2, mi - (a.y + a.h), teinte)
        rect(ctx, Math.min(ax, bx) - 1, mi - 1, Math.abs(bx - ax) + 2, 2, teinte)
        rect(ctx, bx - 1, mi, 2, b.y - mi, teinte)
      }
    })
  })

  const zones = []
  carte.couches.forEach((ligne, i) => {
    ligne.forEach((n, k) => {
      const b = place(carte, i, k)
      const t = Carte.TYPES[n.type]
      const ouvert = estOuvert(i, k)
      const visite = estVisite(i, k)
      const teinte =
        n.type === 'noyau'
          ? C.rouge
          : n.type === 'elite'
            ? C.violet
            : n.type === 'atelier'
              ? C.vert
              : n.type === 'archive'
                ? C.cyan
                : n.type === 'marche'
                  ? C.accent
                  : C.texte // un combat ordinaire, mais pas pour autant illisible

      const vise = choisi && choisi.couche === i && choisi.k === k
      if (ouvert) lueur(ctx, b.x, b.y, b.w, b.h, vise ? C.accent : teinte, vise ? 3 : 2, vise ? 0.9 : 0.6)
      rect(ctx, b.x, b.y, b.w, b.h, visite ? ton(C.panneau, 0.1) : C.panneau)
      cadre(ctx, b.x, b.y, b.w, b.h, ouvert ? (vise ? C.accent : teinte) : visite ? C.bord : ton(C.panneau, 0.2))
      texte(
        ctx,
        t.glyphe,
        b.x + b.w / 2,
        b.y + b.h / 2,
        18,
        ouvert ? teinte : visite ? C.bord : ton(C.panneau, 0.35),
        700,
        b.w - 8,
      )
      if (ouvert) zones.push({ quoi: 'noeud', couche: i, k, ...b })
    })
  })
  return zones
}

/** Le panneau du nœud visé, et les deux boutons du bas. */
export function panneau(ctx, carte, choisi, apercu) {
  const y = 526
  rect(ctx, 16, y, 328, 68, C.panneau)
  cadre(ctx, 16, y, 328, 68, ton(C.bord, -0.1))
  if (!choisi) {
    texte(ctx, 'choisis où descendre', 180, y + 34, 13, C.faible, 700, 300)
    return []
  }
  const n = carte.couches[choisi.couche][choisi.k]
  const t = Carte.TYPES[n.type]
  ctx.textAlign = 'left'
  texte(ctx, t.nom, 32, y + 18, 15, C.texte, 700, 180)
  ctx.textAlign = 'center'
  if (apercu?.length) {
    texte(ctx, apercu.join('  ·  '), 180, y + 42, 11, C.faible, 700, 300)
  } else {
    texte(
      ctx,
      n.type === 'atelier'
        ? 'l’équipe récupère 30 %'
        : n.type === 'archive'
          ? 'un exploit à prendre'
          : 'un module à charger',
      180,
      y + 42,
      11,
      C.faible,
      700,
      300,
    )
  }
  return []
}

export function boutons(ctx, peutDescendre) {
  return [
    { quoi: 'equipe', ...P.bouton(ctx, 20, 602, 156, 34, 'ÉQUIPE', { taille: 14 }) },
    {
      quoi: 'descendre',
      ...P.bouton(ctx, 184, 602, 156, 34, 'DESCENDRE', { vif: peutDescendre, actif: peutDescendre, taille: 14 }),
    },
  ]
}
