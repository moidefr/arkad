import { C, ton } from '../../../palette.js'
import { rect, cadre, bloc, lueur, texte, largeurTexte, borne } from '../../../dessin.js'
import { ETAT } from '../donnees/etats.js'
import { COMP } from '../donnees/competences.js'

/**
 * Les briques partagées entre les écrans d'ANOMALIE.
 *
 * Chaque brique qui se touche **rend son rectangle**, et l'écran range ces
 * rectangles dans une table que l'appui relit telle quelle. C'est ce qui
 * garantit qu'une case dessinée est une case touchable, et l'inverse : ASCENSION
 * calculait ses zones de clic sur un pas de 62 px pour des boutons de 54, et
 * les huit pixels d'écart déclenchaient le bouton du dessus. C'est de là que
 * venait son air buggé.
 */

export const TACTILE_MIN = { w: 44, h: 30 }

export function barre(ctx, x, y, w, h, k, couleur, fond = ton(C.panneau, -0.45)) {
  rect(ctx, x, y, w, h, fond)
  const rempli = Math.round(w * borne(k, 0, 1))
  if (rempli > 0) rect(ctx, x, y, rempli, h, couleur)
}

/** Une pastille d'état : un glyphe et un nombre, quatre pixels de large chacun. */
export function pastilleEtat(ctx, x, y, id, n) {
  const e = ETAT[id]
  if (!e) return
  rect(ctx, x, y, 16, 16, ton(e.couleur, -0.6))
  cadre(ctx, x, y, 16, 16, ton(e.couleur, -0.15))
  texte(ctx, e.glyphe, x + 8, y + 7, 11, e.couleur, 700, 14)
  if (n > 1) texte(ctx, n, x + 8, y + 13, 8, ton(e.couleur, 0.4), 700, 14)
}

export function etatsDe(ctx, u, x, y, max = 5) {
  const ids = Object.keys(u.etats).slice(0, max)
  ids.forEach((id, k) => pastilleEtat(ctx, x + k * 18, y, id, u.etats[id]))
}

// --- La file d'initiative ---------------------------------------------------------

export const FILE = { y: 62, h: 18, x0: 28, pas: 44, w: 40 }

/**
 * Les sept prochains à jouer. C'est cette fenêtre qui transforme un combat
 * déterministe en problème d'ordonnancement : sans elle, un système sans
 * hasard n'est qu'un échange de coups prévisible et sans intérêt.
 */
export function file(ctx, liste, estAmi) {
  liste.forEach((u, k) => {
    const x = FILE.x0 + k * FILE.pas
    const ami = estAmi(u)
    const teinte = ami ? C.accent : C.rouge
    if (k === 0) lueur(ctx, x, FILE.y, FILE.w, FILE.h, teinte, 2, 0.8)
    rect(ctx, x, FILE.y, FILE.w, FILE.h, ton(teinte, -0.72))
    cadre(ctx, x, FILE.y, FILE.w, FILE.h, k === 0 ? teinte : ton(teinte, -0.3))
    texte(ctx, u.nom.slice(0, 4), x + FILE.w / 2, FILE.y + 9, 10, k === 0 ? teinte : ton(teinte, 0.15), 700, FILE.w - 4)
  })
}

// --- La carte d'une compétence -----------------------------------------------------

export const CARTE = { w: 156, h: 66 }

const TEINTE_TYPE = { brut: C.rouge, logique: C.cyan, corruption: C.violet, aucun: C.faible }

/**
 * Une carte ne montre que des nombres : coût, dégâts, recharge. La prose vit
 * sur l'écran ÉQUIPE, hors combat. En combat, on n'enseigne pas — on montre.
 */
export function carteComp(ctx, x, y, id, { cout, dispo, choisie, recharge = 0 }) {
  const comp = COMP[id]
  if (!comp) {
    rect(ctx, x, y, CARTE.w, CARTE.h, ton(C.panneau, -0.55))
    cadre(ctx, x, y, CARTE.w, CARTE.h, ton(C.bord, -0.3))
    texte(ctx, '—', x + CARTE.w / 2, y + CARTE.h / 2, 16, ton(C.bord, 0.1), 700)
    return
  }
  const teinte = TEINTE_TYPE[comp.type] ?? C.faible
  const alpha = ctx.globalAlpha
  if (!dispo) ctx.globalAlpha = alpha * 0.35

  if (choisie) lueur(ctx, x, y, CARTE.w, CARTE.h, C.accent, 3, 0.8)
  rect(ctx, x, y, CARTE.w, CARTE.h, C.panneau)
  rect(ctx, x, y, 4, CARTE.h, teinte)
  cadre(ctx, x, y, CARTE.w, CARTE.h, choisie ? C.accent : ton(C.bord, -0.1))

  ctx.textAlign = 'left'
  texte(ctx, comp.nom, x + 12, y + 16, 13, dispo ? C.texte : C.faible, 700, 106)
  if (comp.base) texte(ctx, `${comp.base}`, x + 12, y + 52, 15, teinte, 700, 40)
  else if (comp.soin) texte(ctx, `+${comp.soin}`, x + 12, y + 52, 15, C.vert, 700, 40)
  else texte(ctx, comp.forme === 'soi' ? 'SOI' : '···', x + 12, y + 52, 12, C.faible, 700, 40)
  texte(ctx, etiquette(comp), x + 12, y + 34, 10, ton(C.faible, 0.1), 700, 120)
  ctx.textAlign = 'right'
  texte(ctx, `${cout}`, x + CARTE.w - 12, y + 16, 14, cout > 0 ? C.accent : C.faible, 700, 24)
  ctx.textAlign = 'center'

  if (recharge > 0) {
    ctx.globalAlpha = alpha * 0.75
    rect(ctx, x, y, CARTE.w, CARTE.h, ton(C.fond, 0.05))
    texte(ctx, `${recharge}`, x + CARTE.w / 2, y + CARTE.h / 2, 24, C.bord, 700)
    ctx.globalAlpha = alpha
  }
  ctx.globalAlpha = alpha
}

/** Une ligne de trois mots qui dit la portée, sans phrase. */
function etiquette(comp) {
  const forme = { cible: 'UNE', rang: 'UN RANG', tous: 'TOUS', soi: 'SOI', allie: 'ALLIÉ', equipe: 'ÉQUIPE' }[
    comp.forme
  ]
  const portee = comp.perce ? 'PERCE' : comp.contact ? 'CONTACT' : ''
  return [forme, portee].filter(Boolean).join(' · ')
}

// --- Boutons et texte long -----------------------------------------------------------

export function bouton(ctx, x, y, w, h, libelle, { vif = false, actif = true, taille = 15 } = {}) {
  const teinte = vif ? C.accent : actif ? C.texte : C.bord
  if (vif) lueur(ctx, x, y, w, h, C.accent, 3, 0.7)
  rect(ctx, x, y, w, h, C.panneau)
  rect(ctx, x, y, w, 3, ton(C.panneau, 0.5))
  rect(ctx, x, y + h - 3, w, 3, ton(C.panneau, -0.5))
  cadre(ctx, x, y, w, h, vif ? C.accent : ton(C.bord, 0.05))
  texte(ctx, libelle, x + w / 2, y + h / 2, taille, teinte, 700, w - 16)
  return { x, y, w, h }
}

/** Coupe une phrase à la largeur donnée. La prose n'existe que hors combat. */
export function texteLong(ctx, s, x, y, largeur, taille, couleur = C.faible, interligne = 15) {
  const mots = String(s).split(' ')
  let ligne = ''
  let n = 0
  for (const mot of mots) {
    const essai = ligne ? ligne + ' ' + mot : mot
    if (largeurTexte(ctx, essai, taille) > largeur && ligne) {
      texte(ctx, ligne, x, y + n * interligne, taille, couleur, 700, largeur)
      ligne = mot
      n++
    } else ligne = essai
  }
  if (ligne) texte(ctx, ligne, x, y + n * interligne, taille, couleur, 700, largeur)
  return n + 1
}

/** Un combattant, en carte. Sert au camp adverse comme au camp joueur. */
export function fiche(ctx, x, y, w, h, u, { teinte, actif, visable, glyphe }) {
  const mort = u.pv <= 0
  const alpha = ctx.globalAlpha
  if (mort) ctx.globalAlpha = alpha * 0.25
  else if (visable === false) ctx.globalAlpha = alpha * 0.35

  if (actif) lueur(ctx, x, y, w, h, C.accent, 3, 0.8)
  else if (visable) lueur(ctx, x, y, w, h, C.accent, 2, 0.5)
  rect(ctx, x, y, w, h, C.panneau)
  cadre(ctx, x, y, w, h, actif || visable ? C.accent : ton(teinte, -0.3))
  rect(ctx, x, y, w, 3, ton(teinte, -0.1))

  texte(ctx, u.nom, x + w / 2, y + 14, 11, mort ? C.bord : C.texte, 700, w - 10)
  if (glyphe) {
    texte(ctx, glyphe, x + w - 12, y + 14, 13, C.rouge, 700, 14)
  }
  barre(ctx, x + 8, y + 22, w - 16, 8, u.pv / u.pvMax, mort ? C.bord : teinte)
  texte(ctx, `${u.pv}`, x + w / 2, y + 38, 10, mort ? C.bord : ton(teinte, 0.3), 700, w - 10)
  etatsDe(ctx, u, x + 8, y + h - 22, Math.floor((w - 12) / 18))
  ctx.globalAlpha = alpha
}
