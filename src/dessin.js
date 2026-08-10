/**
 * Petits utilitaires de dessin, pour que les micro-jeux restent courts.
 * Tout est en coordonnées logiques (360 x 640).
 */
import { C } from './palette.js'

export const POLICE = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'

export function texte(ctx, s, x, y, taille, couleur = C.texte, poids = 800) {
  ctx.fillStyle = couleur
  ctx.font = `${poids} ${taille}px ${POLICE}`
  ctx.fillText(s, x, y)
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

/** Rapproche `a` de `b` d'au plus `pas`. Pratique pour tout ce qui glisse. */
export function vers(a, b, pas) {
  const d = b - a
  return Math.abs(d) <= pas ? b : a + Math.sign(d) * pas
}
