/**
 * Les briques de dessin communes à tous les écrans de FRONT.
 *
 * L'hexagone est le seul morceau un peu technique : il est rendu **une fois**
 * dans une toile de côté, en rangées de gros pixels, puis recopié. Un
 * hexagone dessiné pixel par pixel coûte vingt-trois rectangles ; à quatre
 * vingts hexagones visibles, ça ferait deux mille rectangles par image. Rendu
 * puis recopié, c'est un `drawImage` par case — et c'est le même procédé que
 * `bandeTramee` utilise déjà pour ses dégradés.
 */
import { C, ton } from '../../../palette.js'
import { rect, cadre, texte, largeurTexte, lueur, ombre, px, PX } from '../../../dessin.js'
import { RACINE3 } from '../hex.js'

// --- L'hexagone ------------------------------------------------------------------

const toiles = new Map()

/**
 * Un hexagone pointe en haut, de rayon circonscrit `R`, en gros pixels.
 * L'encoche d'un pixel sur le pourtour laisse voir le fond entre les cases :
 * c'est ce jour qui dessine le nid d'abeille, sans tracer une seule ligne.
 */
export function toileHex(R, couleur, relief = true) {
  const cle = `${R}|${couleur}|${relief}`
  const connue = toiles.get(cle)
  if (connue) return connue

  const l = RACINE3 * R
  const w = Math.ceil(l) + 2
  const h = 2 * R + 2
  const toile = document.createElement('canvas')
  toile.width = w
  toile.height = h
  const g = toile.getContext('2d')
  const cx = w / 2
  const clair = ton(couleur, 0.3)
  const sombre = ton(couleur, -0.4)

  for (let y = -R; y <= R; y += PX) {
    const ay = Math.abs(y)
    const demi = (ay <= R / 2 ? l / 2 : (l / 2) * ((R - ay) / (R / 2))) - 1
    if (demi <= 0) continue
    const x0 = Math.round((cx - demi) / PX) * PX
    const larg = Math.max(PX, Math.round((demi * 2) / PX) * PX)
    g.fillStyle = !relief ? couleur : y < -R + 4 ? clair : y > R - 6 ? sombre : couleur
    g.fillRect(x0, Math.round((y + R + 1) / PX) * PX, larg, PX)
  }
  toiles.set(cle, toile)
  return toile
}

/** Pose un hexagone centré sur `cx, cy`. */
export function hexagone(ctx, cx, cy, R, couleur, relief = true) {
  const toile = toileHex(R, couleur, relief)
  const w = Math.ceil(RACINE3 * R) + 2
  const h = 2 * R + 2
  ctx.drawImage(toile, px(cx - w / 2), px(cy - h / 2), w, h)
}

/** Un liseré hexagonal : le même hexagone, un peu plus gros, derrière. */
export function contour(ctx, cx, cy, R, couleur, epaisseur = 3, alpha = 1) {
  const a = ctx.globalAlpha
  ctx.globalAlpha = a * alpha
  hexagone(ctx, cx, cy, R + epaisseur, couleur, false)
  ctx.globalAlpha = a
}

// --- Panneaux et boutons ----------------------------------------------------------

export function panneau(ctx, x, y, w, h, teinte = C.bord, fond = C.panneau) {
  rect(ctx, x, y, w, h, fond)
  rect(ctx, x, y, w, PX, ton(fond, 0.4))
  cadre(ctx, x, y, w, h, teinte)
}

/**
 * Un bouton. `z` est la zone tactile elle-même — le dessin et l'appui lisent
 * exactement le même rectangle, ce qui rend impossible le décalage de huit
 * pixels qui rendait le jeu précédent « glitché ».
 */
export function bouton(ctx, z, libelle, options = {}) {
  const { primaire, teinte, actif = true, petit } = options
  const vif = actif ? (teinte ?? (primaire ? C.accent : null)) : null
  const a = ctx.globalAlpha
  if (!actif) ctx.globalAlpha = a * 0.4
  if (vif) lueur(ctx, z.x, z.y, z.w, z.h, vif, 2, 0.55)
  rect(ctx, z.x, z.y, z.w, z.h, C.panneau)
  rect(ctx, z.x, z.y, z.w, PX, ton(C.panneau, 0.5))
  rect(ctx, z.x, z.y + z.h - PX, z.w, PX, ton(C.panneau, -0.5))
  cadre(ctx, z.x, z.y, z.w, z.h, vif ?? C.faible)
  ctx.textAlign = 'center'
  texte(ctx, libelle, z.x + z.w / 2, z.y + z.h / 2, petit ? 12 : 15, vif ?? C.texte, 700, z.w - 10)
  // On rend l'alignement : sans ça, la ligne de texte suivante partait centrée
  // sur son abscisse de gauche et sortait de l'écran.
  ctx.textAlign = 'left'
  ctx.globalAlpha = a
  return z
}

/** Une barre pleine, en gros pixels, avec son fond. */
export function barre(ctx, x, y, w, h, k, couleur, fond = C.bord) {
  rect(ctx, x, y, w, h, fond)
  const rempli = Math.max(0, Math.min(1, k))
  if (rempli > 0) rect(ctx, x, y, Math.max(PX, w * rempli), h, couleur)
}

/** La couleur d'une jauge de vie : verte, ambre, rouge. Rien à lire, tout à voir. */
export const teinteVie = (k) => (k > 0.6 ? C.vert : k > 0.28 ? C.accent : C.rouge)

/** Coupe un texte à la largeur disponible, avec une ellipse. */
export function tronque(ctx, s, taille, largeur, poids = 700) {
  let t = String(s)
  if (largeurTexte(ctx, t, taille, poids) <= largeur) return t
  while (t.length > 1 && largeurTexte(ctx, t + '…', taille, poids) > largeur) t = t.slice(0, -1)
  return t + '…'
}

/** Découpe un texte en lignes qui tiennent dans `largeur`. */
export function lignes(ctx, s, taille, largeur, poids = 700) {
  const mots = String(s).split(' ')
  const sortie = []
  let ligne = ''
  for (const m of mots) {
    const essai = ligne ? ligne + ' ' + m : m
    if (largeurTexte(ctx, essai, taille, poids) > largeur && ligne) {
      sortie.push(ligne)
      ligne = m
    } else ligne = essai
  }
  if (ligne) sortie.push(ligne)
  return sortie
}

export function paragraphe(ctx, s, x, y, taille, largeur, couleur = C.faible, interligne = 14) {
  const t = lignes(ctx, s, taille, largeur)
  t.forEach((l, i) => texte(ctx, l, x, y + i * interligne, taille, couleur, 700))
  return t.length * interligne
}

/** L'entête d'un écran de menu : un titre, un sous-titre, et le trait. */
export function entete(ctx, e, titre, sous, teinte = C.accent) {
  ctx.textAlign = 'left'
  texte(ctx, titre, e.titre.x, e.titre.y, 20, teinte, 700, e.titre.max, 1)
  if (sous) {
    ctx.textAlign = 'right'
    texte(ctx, sous, e.sous.x, e.sous.y, 13, C.faible, 700, e.sous.max)
  }
  rect(ctx, e.trait.x, e.trait.y, e.trait.w, PX, C.bord)
  ctx.textAlign = 'left'
}

/** Une ligne de la bourse : elle sait de quel bord elle se cale. */
function ligneBourse(ctx, s, l, couleur) {
  ctx.textAlign = l.droite ? 'right' : 'left'
  texte(ctx, s, l.x, l.y, l.taille, couleur, 700, l.max)
  ctx.textAlign = 'left'
}

/**
 * L'or et le niveau, présents sur tous les écrans de camp. Debout c'est un
 * bandeau en pied de page ; couché il n'y a pas de pied de page à dépenser, et
 * les deux lignes remontent au bout de la ligne de titre.
 */
export function bourse(ctx, c, b) {
  if (b.trait) rect(ctx, b.trait.x, b.trait.y, b.trait.w, PX, C.bord)
  ligneBourse(ctx, `${c.or} OR`, b.or, C.accent)
  ligneBourse(ctx, `NIVEAU ${c.niveau} · ${c.troupes.length} TROUPES`, b.etat, C.faible)
}

export { rect, cadre, texte, largeurTexte, lueur, ombre, px, PX, C, ton }
