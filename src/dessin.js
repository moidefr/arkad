/**
 * La boîte à outils graphique — et c'est elle qui porte le style.
 *
 * Trois règles tenues partout :
 *   1. tout est aligné sur une grille de PX pixels, donc rien n'est flou ;
 *   2. aucun coin arrondi, aucun dégradé ;
 *   3. le texte, lui, est net : le style vient des formes, pas de la typo.
 */
import { C, ton } from './palette.js'

/** Taille du « pixel » logique. Tout s'aligne dessus. */
export const PX = 2

/** Police d'écran : le monospace est la moitié de l'identité. */
export const POLICE = 'ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, monospace'

export function px(v) {
  return Math.round(v / PX) * PX
}

export function rect(ctx, x, y, w, h, couleur) {
  ctx.fillStyle = couleur
  ctx.fillRect(px(x), px(y), px(w), px(h))
}

/** Un cadre creux, façon boîte de terminal. */
export function cadre(ctx, x, y, w, h, couleur, epaisseur = PX) {
  const e = px(epaisseur)
  ctx.fillStyle = couleur
  ctx.fillRect(px(x), px(y), px(w), e)
  ctx.fillRect(px(x), px(y + h) - e, px(w), e)
  ctx.fillRect(px(x), px(y), e, px(h))
  ctx.fillRect(px(x + w) - e, px(y), e, px(h))
}

/** Un disque en gros pixels : des rangées de rectangles, pas un arc lissé. */
export function pastille(ctx, cx, cy, r, couleur) {
  ctx.fillStyle = couleur
  const x0 = px(cx)
  const y0 = px(cy)
  const R = Math.max(PX, px(r))
  for (let y = -R; y <= R; y += PX) {
    const demi = Math.floor(Math.sqrt(Math.max(0, R * R - y * y)) / PX) * PX
    ctx.fillRect(x0 - demi, y0 + y, demi * 2 + PX, PX)
  }
}

/**
 * Un bloc avec du relief : corps, arête claire en haut, arête sombre en bas.
 * C'est la différence entre un carré de couleur et un objet.
 */
export function bloc(ctx, x, y, w, h, couleur, ep = 3) {
  const e = Math.min(px(ep), px(h) / 2)
  rect(ctx, x, y, w, h, couleur)
  ctx.fillStyle = ton(couleur, 0.42)
  ctx.fillRect(px(x), px(y), px(w), e)
  ctx.fillStyle = ton(couleur, 0.16)
  ctx.fillRect(px(x), px(y), e, px(h))
  ctx.fillStyle = ton(couleur, -0.45)
  ctx.fillRect(px(x), px(y + h) - e, px(w), e)
  ctx.fillStyle = ton(couleur, -0.28)
  ctx.fillRect(px(x + w) - e, px(y), e, px(h))
}

/**
 * Un halo derrière un objet lumineux. Sur un écran à phosphore, la lumière
 * bave — c'est ce débordement qui fait qu'une couleur vive paraît allumée
 * plutôt que peinte.
 */
export function lueur(ctx, x, y, w, h, couleur, n = 3, force = 1) {
  const alpha = ctx.globalAlpha
  for (let i = n; i >= 1; i--) {
    ctx.globalAlpha = alpha * force * (0.13 / i)
    rect(ctx, x - i * 4, y - i * 4, w + i * 8, h + i * 8, couleur)
  }
  ctx.globalAlpha = alpha
}

/** Ombre portée : quatre pixels décalés sous un panneau, et l'écran a un dessus. */
export function ombre(ctx, x, y, w, h, decalage = 4) {
  ctx.globalAlpha = 0.5
  rect(ctx, x + decalage, y + decalage, w, h, '#000000')
  ctx.globalAlpha = 1
}

// --- Texte -------------------------------------------------------------------

/**
 * Le texte est dessiné directement, à la taille demandée et à la résolution
 * de l'écran. On a essaye de le rasteriser petit puis de l'agrandir pour lui
 * donner du grain : joli en grand, illisible en petit. Le style vient
 * maintenant des formes — grille, angles droits, aplats — et la typo reste
 * nette.
 *
 * Respecte `ctx.textAlign` et `ctx.textBaseline`, comme fillText.
 */
export function texte(ctx, s, x, y, taille, couleur = C.texte, poids = 700, largeurMax, espace) {
  const chaine = String(s)
  if (!chaine) return
  ctx.fillStyle = couleur
  ctx.font = `${poids} ${taille}px ${POLICE}`
  // L'interlettrage donne aux titres leur allure de terminal. Ignoré par les
  // navigateurs qui ne le connaissent pas : le texte reste juste plus serré.
  if (espace) ctx.letterSpacing = espace + 'px'
  if (largeurMax) ctx.fillText(chaine, x, y, largeurMax)
  else ctx.fillText(chaine, x, y)
  if (espace) ctx.letterSpacing = '0px'
}

/** Largeur qu'occupera un texte, pour aligner autre chose a cote. */
export function largeurTexte(ctx, s, taille, poids = 700) {
  ctx.font = `${poids} ${taille}px ${POLICE}`
  return ctx.measureText(String(s)).width
}

// --- Ambiance ----------------------------------------------------------------

/**
 * Lignes de balayage, comme sur un écran cathodique. Fines et discrètes :
 * plus épaisses, elles coupaient les lettres en deux.
 */
export function scanlines(ctx, w, h) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.11)'
  for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1)
}

/**
 * Assombrissement progressif des bords, par bandes. Ça recentre le regard et
 * ça donne à l'écran sa courbure de tube cathodique, sans dégradé.
 */
export function vignette(ctx, w, h) {
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = `rgba(0, 0, 0, ${(0.085 - i * 0.01).toFixed(3)})`
    const m = i * 5
    ctx.fillRect(0, m, w, 5)
    ctx.fillRect(0, h - m - 5, w, 5)
    ctx.fillRect(m, 0, 5, h)
    ctx.fillRect(w - m - 5, 0, 5, h)
  }
}

/** Trame de points : donne du sol aux jeux sans encombrer l'écran. */
export function trame(ctx, x, y, w, h, pas, couleur) {
  ctx.fillStyle = couleur
  for (let i = px(x); i < x + w; i += pas) {
    for (let k = px(y); k < y + h; k += pas) ctx.fillRect(i, k, PX, PX)
  }
}

// --- Petits calculs ----------------------------------------------------------

export function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by)
}

export function borne(v, min, max) {
  return v < min ? min : v > max ? max : v
}

/** Rapproche `a` de `b` d'au plus `pas`. Pratique pour tout ce qui glisse. */
export function vers(a, b, pas) {
  const d = b - a
  return Math.abs(d) <= pas ? b : a + Math.sign(d) * pas
}
