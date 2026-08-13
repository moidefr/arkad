/**
 * Le champ de bataille : la caméra, les hexagones, les troupes, les repères.
 *
 * Toute l'ergonomie du jeu tient dans ce fichier. Trois décisions, et elles
 * ont été prises contre la version précédente du jeu massif, abandonnée parce
 * qu'elle n'était « pas pratique » :
 *
 *  1. **On fait glisser la carte avec le doigt**, comme n'importe quelle carte
 *     sur un téléphone. Un appui qui bouge de plus de dix pixels n'est pas un
 *     appui, c'est un déplacement de caméra.
 *  2. **La caméra suit toute seule** — sur la troupe qu'on choisit, sur celle
 *     qui joue en face. On ne cherche jamais où il se passe quelque chose.
 *  3. **Deux niveaux de zoom seulement** : « tout voir » et « voir gros ». Un
 *     zoom continu à deux doigts sur un canvas de 360 points est une promesse
 *     qu'on ne tient pas.
 */
import { C, ton } from '../../../palette.js'
import { rect, texte, px, PX, trame, largeurTexte } from '../../../dessin.js'
import { versEcran, versHex, distance, cle, RACINE3 } from '../hex.js'
import { terrainA, toutes } from '../carte.js'
import * as B from '../bataille.js'
import { CL } from '../donnees/classes.js'
import { GRADES } from '../donnees/classes.js'
import { hexagone, contour, barre, teinteVie } from './pieces.js'

export const CHAMP = { x: 0, y: 88, w: 360, h: 364 }

const R_MIN = 19
const R_CONFORT = 27

/** Le rayon d'un hexagone : « tout voir » cadre la carte, « voir gros » ne bouge pas. */
export function rayonPour(carte, zoom) {
  if (zoom) return R_CONFORT
  const parLargeur = CHAMP.w / (RACINE3 * (carte.cols + 0.5))
  const parHauteur = CHAMP.h / (1.5 * (carte.rows - 1) + 2)
  return Math.max(R_MIN, Math.min(R_CONFORT, Math.floor(Math.min(parLargeur, parHauteur))))
}

const centreEcran = () => ({ x: CHAMP.x + CHAMP.w / 2, y: CHAMP.y + CHAMP.h / 2 })

/** Coordonnées écran d'un hexagone, caméra comprise. */
export function place(vue, q, r) {
  const p = versEcran(q, r, vue.R)
  const c = centreEcran()
  return { x: p.x - vue.cam.x + c.x, y: p.y - vue.cam.y + c.y }
}

/** L'hexagone sous le doigt, ou `null` si le doigt est hors du champ. */
export function hexSous(vue, p) {
  if (p.y < CHAMP.y || p.y > CHAMP.y + CHAMP.h) return null
  const c = centreEcran()
  return versHex(p.x - c.x + vue.cam.x, p.y - c.y + vue.cam.y, vue.R)
}

/** Recadre la caméra pour qu'on ne se perde jamais hors de la carte. */
export function borneCamera(vue, carte) {
  const l = RACINE3 * vue.R
  const largeur = l * (carte.cols + 0.5)
  const hauteur = 1.5 * vue.R * (carte.rows - 1) + 2 * vue.R
  const marge = vue.R
  // Carte plus petite que la fenêtre : on la centre au lieu de la coller au bord.
  vue.cam.x =
    largeur <= CHAMP.w
      ? largeur / 2 - l / 2
      : Math.max(CHAMP.w / 2 - marge, Math.min(largeur - CHAMP.w / 2 - l / 2 + marge, vue.cam.x))
  vue.cam.y =
    hauteur <= CHAMP.h
      ? hauteur / 2 - vue.R
      : Math.max(CHAMP.h / 2 - marge, Math.min(hauteur - CHAMP.h / 2 - vue.R + marge, vue.cam.y))
}

export function centreSur(vue, carte, q, r) {
  const p = versEcran(q, r, vue.R)
  vue.cam.x = p.x
  vue.cam.y = p.y
  borneCamera(vue, carte)
}

/** Une caméra neuve, cadrée sur le gros de la compagnie. */
export function nouvelleVue(bat, zoom = 0) {
  const vue = { R: rayonPour(bat.carte, zoom), cam: { x: 0, y: 0 }, zoom, connu: [] }
  const miennes = B.vivantes(bat, 0)
  if (miennes.length) {
    const q = miennes.reduce((s, u) => s + u.q, 0) / miennes.length
    const r = miennes.reduce((s, u) => s + u.r, 0) / miennes.length
    centreSur(vue, bat.carte, Math.round(q), Math.round(r))
  } else borneCamera(vue, bat.carte)
  return vue
}

// --- Dessin ------------------------------------------------------------------------

const dansEcran = (p, R) =>
  p.x > CHAMP.x - R * 2 && p.x < CHAMP.x + CHAMP.w + R * 2 && p.y > CHAMP.y - R * 2 && p.y < CHAMP.y + CHAMP.h + R * 2

/**
 * Le champ complet. `sel` décrit l'état du doigt : la troupe choisie, les
 * cases où elle peut aller, les cibles qu'elle peut frapper.
 */
export function dessine(ctx, vue, bat, sel = {}) {
  rect(ctx, CHAMP.x, CHAMP.y, CHAMP.w, CHAMP.h, ton(C.fond, -0.25))
  trame(ctx, CHAMP.x, CHAMP.y, CHAMP.w, CHAMP.h, 24, ton(C.bord, -0.4))

  const vus = B.visibles(bat, 0)
  const connu = vue.connu instanceof Set ? vue.connu : (vue.connu = new Set(vue.connu ?? []))
  for (const k of vus) connu.add(k)

  const deplacables = sel.deplacements ?? new Set()
  const cibles = sel.cibles ?? new Set()
  const points = new Set((bat.objectif.points ?? []).map((p) => cle(p.q, p.r)))

  // 1. le terrain
  for (const h of toutes(bat.carte)) {
    const p = place(vue, h.q, h.r)
    if (!dansEcran(p, vue.R)) continue
    const k = cle(h.q, h.r)
    const t = terrainA(bat.carte, h.q, h.r)
    if (!connu.has(k)) {
      hexagone(ctx, p.x, p.y, vue.R, ton(C.fond, 0.12), false)
      continue
    }
    hexagone(ctx, p.x, p.y, vue.R, t.couleur)
    // Le brouillard : la case est connue, mais plus personne ne la regarde.
    if (!vus.has(k)) {
      ctx.globalAlpha = 0.5
      hexagone(ctx, p.x, p.y, vue.R, C.fond, false)
      ctx.globalAlpha = 1
    }
    if (t.haut) reliefHaut(ctx, p.x, p.y, vue.R, t)
    if (points.has(k)) marqueObjectif(ctx, p.x, p.y, vue.R)
  }

  // 2. les repères de manœuvre, sous les troupes pour ne jamais les masquer
  for (const k of deplacables) {
    const [q, r] = k.split(':').map(Number)
    const p = place(vue, q, r)
    if (!dansEcran(p, vue.R)) continue
    ctx.globalAlpha = 0.3
    hexagone(ctx, p.x, p.y, vue.R - 2, C.cyan, false)
    ctx.globalAlpha = 1
    rect(ctx, p.x - 3, p.y - 3, 6, 6, C.cyan)
  }

  // 3. la fumée
  for (const f of bat.fumees) {
    const p = place(vue, f.q, f.r)
    if (!dansEcran(p, vue.R)) continue
    ctx.globalAlpha = 0.55
    hexagone(ctx, p.x, p.y, vue.R - 1, ton(C.faible, 0.25), false)
    ctx.globalAlpha = 1
  }

  // 4. les troupes
  for (const u of bat.unites) {
    if (u.pv <= 0) continue
    if (u.camp !== 0 && !B.voitUnite(bat, 0, u, vus)) continue
    const p = place(vue, u.q, u.r)
    if (!dansEcran(p, vue.R)) continue
    dessineUnite(ctx, vue, bat, u, p, {
      choisie: sel.unite === u,
      cible: cibles.has(cle(u.q, u.r)),
      visee: sel.visee === u,
    })
  }

  // 5. le chemin prévu, par-dessus tout : c'est lui qu'on regarde en jouant
  if (sel.chemin?.length > 1) {
    for (let i = 1; i < sel.chemin.length; i++) {
      const p = place(vue, sel.chemin[i].q, sel.chemin[i].r)
      rect(ctx, p.x - 3, p.y - 3, 6, 6, i === sel.chemin.length - 1 ? C.accent : C.cyan)
    }
  }
}

function reliefHaut(ctx, x, y, R, t) {
  const c = ton(t.couleur, 0.5)
  const n = t.haut
  for (let i = 0; i < n; i++) rect(ctx, x - 8 + i * 8, y - R * 0.42 - i * 2, 6, 3 + i * 2, c)
}

/** Un point à tenir : un fanion, dessiné en creux pour ne pas cacher la troupe dessus. */
function marqueObjectif(ctx, x, y, R) {
  rect(ctx, x - 1, y - R * 0.6, 3, R * 0.5, C.accent)
  rect(ctx, x + 2, y - R * 0.6, 8, 6, C.accent)
}

/** Une troupe : un bloc de couleur de camp, trois lettres, une barre de vie. */
export function dessineUnite(ctx, vue, bat, u, p, etat = {}) {
  const R = vue.R
  const mien = u.camp === 0
  const teinte = mien ? C.cyan : C.rouge
  const fini = mien && B.aFini(u)

  if (etat.cible || etat.visee) contour(ctx, p.x, p.y, R - 1, C.rouge, 3, etat.visee ? 1 : 0.55)
  if (etat.choisie) contour(ctx, p.x, p.y, R - 1, C.accent, 3, 1)

  const a = ctx.globalAlpha
  if (fini) ctx.globalAlpha = a * 0.55
  hexagone(ctx, p.x, p.y, R - 4, ton(teinte, -0.72), false)

  const w = Math.round(R * 1.28)
  const h = Math.round(R * 0.5)
  rect(ctx, p.x - w / 2, p.y - h - 1, w, h, ton(teinte, -0.55))
  rect(ctx, p.x - w / 2, p.y - h - 1, w, PX, teinte)

  ctx.textAlign = 'center'
  texte(
    ctx,
    CL[u.cl].court,
    p.x,
    p.y - h / 2 - 1,
    Math.max(9, Math.round(R * 0.42)),
    mien ? C.texte : ton(C.rouge, 0.55),
    700,
    w - 2,
  )

  const bw = Math.round(R * 1.28)
  barre(ctx, p.x - bw / 2, p.y + 2, bw, 4, u.pv / u.pvMax, teinteVie(u.pv / u.pvMax), ton(C.fond, 0.1))
  if (u.moral < B.EBRANLE) barre(ctx, p.x - bw / 2, p.y + 7, bw, 3, u.moral / B.MORAL_PLEIN, C.violet, ton(C.fond, 0.1))

  // Les chevrons de grade : c'est à ça qu'on repère un chef d'escouade d'un
  // coup d'œil, et donc qui abattre en premier.
  if (u.grade > 0) {
    const g = GRADES[u.grade]
    texte(ctx, g.court, p.x + bw / 2 - 5, p.y - h - 5, 9, C.accent, 700, 16)
  }
  if (B.enDeroute(u)) texte(ctx, 'ROMPU', p.x, p.y + 14, 8, C.rouge, 700, bw)
  ctx.globalAlpha = a
  ctx.textAlign = 'left'
}

/** Les cases atteignables, en clés — la vue ne recalcule jamais les règles. */
export const casesDeplacement = (bat, u) => new Set(B.destinations(bat, u).map((d) => cle(d.q, d.r)))
export const casesCibles = (bat, u) => new Set(B.cibles(bat, u).map((c) => cle(c.q, c.r)))
