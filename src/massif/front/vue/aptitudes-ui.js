/**
 * Comment une aptitude s'affiche, partagé entre la fiche (lot 4) et le
 * panneau de combat (lot 5).
 *
 * Une ligne — pastille de couleur, nom — et un tap bascule sa description
 * en dessous. Un seul rendu, un seul état d'expansion : sans ce partage, les
 * deux écrans auraient fini par raconter la même aptitude de deux façons
 * différentes, exactement le défaut relevé en combat (« codes à trois
 * lettres sans rappel du nom ») que ce module règle une fois pour toutes.
 */
import { C } from '../../../palette.js'
import { texte, pastille } from '../../../dessin.js'
import { paragraphe } from './pieces.js'
import { APT } from '../donnees/aptitudes.js'

export const descriptionApt = (id) => APT[id]?.texte ?? ''

/** Bascule l'ouverture d'une aptitude — une nouvelle instance, jamais de mutation cachée. */
export function bascule(ouvertes, id) {
  const s = new Set(ouvertes)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  return s
}

/**
 * Dessine une ligne d'aptitude à `x, y` sur une largeur `w`, et rend la
 * hauteur réellement prise — pastille et nom toujours, description
 * seulement si `ouverte`. Violet pour un ordre (le même code que ses
 * boutons en bataille), accent sinon.
 */
/** La ligne pastille + nom tient toujours au moins ce plancher — un doigt, pas un pixel. */
const LIGNE_MIN = 30

export function ligneApt(ctx, x, y, w, apt, ouverte) {
  const couleur = apt.ordre ? C.violet : C.accent
  pastille(ctx, x + 6, y + LIGNE_MIN / 2, 5, couleur)
  texte(ctx, apt.nom, x + 18, y + LIGNE_MIN / 2 + 4, 11, C.texte, 700, w - 40)
  ctx.textAlign = 'right'
  texte(ctx, ouverte ? '▲' : '▼', x + w, y + LIGNE_MIN / 2 + 4, 9, C.faible, 700, 20)
  ctx.textAlign = 'left'
  let h = LIGNE_MIN
  if (ouverte) h += paragraphe(ctx, apt.texte, x + 18, y + h, 9, w - 18, C.faible, 11) + 6
  return h
}
