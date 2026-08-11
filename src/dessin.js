/**
 * La boîte à outils graphique — et c'est elle qui porte le style.
 *
 * Trois règles tenues partout :
 *   1. tout est aligné sur une grille de PX pixels, donc rien n'est flou ;
 *   2. aucun coin arrondi, aucun dégradé ;
 *   3. le texte est rastérisé petit puis agrandi sans lissage, ce qui lui
 *      donne son grain de pixels sans avoir à embarquer une police bitmap
 *      (et les accents français continuent de marcher).
 */
import { C } from './palette.js'

/** Taille du « pixel » logique. Tout s'aligne dessus. */
export const PX = 2

/** Police d'écran : le monospace est la moitié de l'identité. */
export const POLICE = 'ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, monospace'

/**
 * Facteur d'agrandissement du texte, choisi selon la taille demandée.
 * En dessous de 5 px, une lettre rastérisée n'a plus de forme lisible : les
 * petits textes s'agrandissent donc moins que les titres. Le facteur reste
 * entier, sinon les pixels sortent de largeurs inégales.
 */
function echelle(taille) {
  if (taille < 14) return 2
  if (taille < 30) return 3
  return 4
}

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

// --- Texte -------------------------------------------------------------------

const cache = new Map()

function rasterise(s, taille, couleur, poids) {
  const cle = `${s}|${taille}|${couleur}|${poids}`
  const connu = cache.get(cle)
  if (connu) return connu

  // Les scores changent à chaque image : sans plafond, le cache gonflerait
  // indéfiniment. On le vide d'un coup, c'est suffisant et simple.
  if (cache.size > 400) cache.clear()

  const petite = Math.max(5, Math.round(taille / echelle(taille)))
  const mesure = document.createElement('canvas').getContext('2d')
  mesure.font = `${poids} ${petite}px ${POLICE}`
  const l = Math.max(1, Math.ceil(mesure.measureText(s).width))
  const h = Math.ceil(petite * 1.4)

  const toile = document.createElement('canvas')
  toile.width = l
  toile.height = h
  const c = toile.getContext('2d')
  c.font = `${poids} ${petite}px ${POLICE}`
  c.textBaseline = 'middle'
  c.textAlign = 'left'
  c.fillStyle = couleur
  c.fillText(s, 0, h / 2)

  cache.set(cle, toile)
  return toile
}

/**
 * Respecte `ctx.textAlign` ('left' | 'center' | 'right') et considère `y`
 * comme le milieu du texte, exactement comme fillText en baseline 'middle'.
 */
export function texte(ctx, s, x, y, taille, couleur = C.texte, poids = 700, largeurMax) {
  const chaine = String(s)
  if (!chaine) return
  const k = echelle(taille)
  const img = rasterise(chaine, taille, couleur, poids)
  let w = img.width * k
  let h = img.height * k
  if (largeurMax && w > largeurMax) {
    h = Math.round(h * (largeurMax / w))
    w = Math.round(largeurMax)
  }
  const a = ctx.textAlign
  const dx = a === 'center' ? -w / 2 : a === 'right' ? -w : 0
  const lisse = ctx.imageSmoothingEnabled
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(img, Math.round(x + dx), Math.round(y - h / 2), w, h)
  ctx.imageSmoothingEnabled = lisse
}

/** Largeur qu'occupera un texte, pour aligner autre chose à côté. */
export function largeurTexte(s, taille, poids = 700) {
  return rasterise(String(s), taille, '#000', poids).width * echelle(taille)
}

// --- Ambiance ----------------------------------------------------------------

/** Lignes de balayage, comme sur un écran cathodique. Discret mais décisif. */
export function scanlines(ctx, w, h) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.18)'
  for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 2)
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
