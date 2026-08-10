/**
 * Petits utilitaires de dessin, pour que les micro-jeux restent courts.
 * Tout est en coordonnées logiques (360 x 640).
 */
import { C } from './palette.js'

export const POLICE = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'

/**
 * `largeurMax` condense le texte au lieu de le laisser déborder — pratique
 * pour tout ce qui vient des jeux, dont on ne maîtrise pas la longueur.
 */
export function texte(ctx, s, x, y, taille, couleur = C.texte, poids = 800, largeurMax) {
  ctx.fillStyle = couleur
  ctx.font = `${poids} ${taille}px ${POLICE}`
  if (largeurMax) ctx.fillText(s, x, y, largeurMax)
  else ctx.fillText(s, x, y)
}

export function rect(ctx, x, y, w, h, couleur, rayon = 0) {
  ctx.fillStyle = couleur
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, rayon)
  ctx.fill()
}

export function cercle(ctx, x, y, r, couleur) {
  ctx.fillStyle = couleur
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
}

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
