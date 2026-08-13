/**
 * La boîte à outils graphique — et c'est elle qui porte le style.
 *
 * Trois règles tenues partout :
 *   1. tout est aligné sur une grille de PX pixels, donc rien n'est flou ;
 *   2. aucun coin arrondi, aucun dégradé ;
 *   3. le texte, lui, est net : le style vient des formes, pas de la typo.
 */
import { C, ton } from './palette.js'
import { theme } from './theme.js'

/**
 * Taille du « pixel » logique. Tout s'aligne dessus — **y compris sous un
 * autre thème**. La grille est une mesure, et un thème ne touche à aucune
 * mesure : c'est ce qui garantit qu'un bouton reste où il est quand on change
 * de peinture.
 */
export const PX = 2

/** Police d'écran : le monospace est la moitié de l'identité. */
export const POLICE = 'ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, monospace'

export function px(v) {
  return Math.round(v / PX) * PX
}

/**
 * Le rayon d'arrondi effectif : nul sous le phosphore, et de toute façon
 * jamais plus que la moitié du plus petit côté — sinon un rectangle plat
 * devient une gélule.
 */
function rayon(w, h) {
  const r = theme.traits.arrondi
  return r <= 0 ? 0 : Math.min(r, Math.abs(px(w)) / 2, Math.abs(px(h)) / 2)
}

/** Trace le contour d'un rectangle, arrondi ou non. Sans remplir. */
function chemin(ctx, x, y, w, h, r) {
  ctx.beginPath()
  if (r > 0 && ctx.roundRect) ctx.roundRect(px(x), px(y), px(w), px(h), r)
  else ctx.rect(px(x), px(y), px(w), px(h))
}

export function rect(ctx, x, y, w, h, couleur) {
  ctx.fillStyle = couleur
  const r = rayon(w, h)
  if (!r) return ctx.fillRect(px(x), px(y), px(w), px(h))
  chemin(ctx, x, y, w, h, r)
  ctx.fill()
}

/** Un cadre creux, façon boîte de terminal. */
export function cadre(ctx, x, y, w, h, couleur, epaisseur = PX) {
  const e = px(epaisseur)
  const r = rayon(w, h)
  if (r > 0 && ctx.roundRect) {
    // Un cadre arrondi se trace au trait : quatre bandes droites laisseraient
    // les coins ouverts. Le chemin part de coordonnées **déjà calées** puis
    // rentre d'un demi-trait — le faire caler après, c'est décaler le cadre
    // d'un pixel, parce qu'un demi-trait ne tombe pas sur la grille.
    ctx.strokeStyle = couleur
    ctx.lineWidth = e
    ctx.beginPath()
    ctx.roundRect(px(x) + e / 2, px(y) + e / 2, px(w) - e, px(h) - e, Math.max(0, r - e / 2))
    ctx.stroke()
    return
  }
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
  // Un thème qui adoucit les coins n'a aucune raison de garder un disque en
  // escalier : là où le gros pixel est un parti pris, ailleurs c'est un défaut.
  //
  // Le demi-pixel de décalage n'est pas une coquetterie : la version en
  // rangées balaie de -R à +R **inclus**, donc elle couvre 2R + PX et déborde
  // d'un pixel en bas à droite. C'est le phosphore la référence — les jeux
  // sont réglés sur lui —, donc c'est à l'arc de se caler dessus, pas
  // l'inverse.
  if (theme.traits.arrondi > 0 && ctx.arc) {
    ctx.beginPath()
    ctx.arc(x0 + PX / 2, y0 + PX / 2, R + PX / 2, 0, Math.PI * 2)
    ctx.fill()
    return
  }
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
  if (theme.traits.relief === 'degrade') return blocDegrade(ctx, x, y, w, h, couleur, e)
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
 * Le même corps, mais donné par un dégradé vertical plutôt que par des arêtes.
 * C'est la seule vraie interpolation de couleur du fichier, et elle n'existe
 * que hors du phosphore — où elle serait un contresens.
 */
function blocDegrade(ctx, x, y, w, h, couleur, e) {
  const X = px(x)
  const Y = px(y)
  const W = px(w)
  const H = px(h)
  const r = rayon(w, h)
  const g = ctx.createLinearGradient?.(X, Y, X, Y + H)
  if (g) {
    g.addColorStop(0, ton(couleur, 0.3))
    g.addColorStop(0.5, couleur)
    g.addColorStop(1, ton(couleur, -0.3))
    ctx.fillStyle = g
  } else ctx.fillStyle = couleur
  chemin(ctx, x, y, w, h, r)
  ctx.fill()
  // Un liseré clair en haut : sans lui le dégradé seul fait mou, et l'objet
  // cesse d'avoir un dessus.
  ctx.globalAlpha = (ctx.globalAlpha ?? 1) * 0.5
  ctx.fillStyle = ton(couleur, 0.55)
  chemin(ctx, x + e, y + e / 2, w - e * 2, Math.max(PX, e / 2), 0)
  ctx.fill()
  ctx.globalAlpha = 1
}

/**
 * Un halo derrière un objet lumineux. Sur un écran à phosphore, la lumière
 * bave — c'est ce débordement qui fait qu'une couleur vive paraît allumée
 * plutôt que peinte. Le thème moderne le pousse : là-bas le halo ne simule
 * plus un tube, il sert de néon.
 */
export function lueur(ctx, x, y, w, h, couleur, n = 3, force = 1) {
  const alpha = ctx.globalAlpha
  const f = force * theme.traits.halo
  for (let i = n; i >= 1; i--) {
    ctx.globalAlpha = alpha * f * (0.13 / i)
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
  if (!theme.traits.balayage) return
  ctx.fillStyle = 'rgba(0, 0, 0, 0.11)'
  for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1)
}

/**
 * Assombrissement progressif des bords, par bandes. Ça recentre le regard et
 * ça donne à l'écran sa courbure de tube cathodique, sans dégradé.
 */
export function vignette(ctx, w, h) {
  if (!theme.traits.vignette) return
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = `rgba(0, 0, 0, ${(0.085 - i * 0.01).toFixed(3)})`
    const m = i * 5
    ctx.fillRect(0, m, w, 5)
    ctx.fillRect(0, h - m - 5, w, 5)
    ctx.fillRect(m, 0, 5, h)
    ctx.fillRect(w - m - 5, 0, 5, h)
  }
}

/**
 * Un dégradé sans dégradé : la densité de pixels décroît du haut vers le bas
 * selon une matrice de Bayer, exactement comme on faisait quand une machine
 * ne savait afficher que seize couleurs. Le résultat est rendu une fois dans
 * une toile de côté puis recopié — sinon ce serait des dizaines de milliers de
 * rectangles à chaque image.
 */
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
]
const bandes = new Map()

/** Une couleur de la palette à une opacité donnée, pour les vrais dégradés. */
function teinte(hex, densite) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.max(0, Math.min(1, densite))})`
}

export function bandeTramee(ctx, x, y, w, h, couleur, densiteHaut = 0.9, densiteBas = 0) {
  // Hors du phosphore, le tramage n'a plus de raison d'être : on interpole,
  // et on ne met rien en cache — un dégradé natif ne coûte rien.
  if (!theme.traits.trame) {
    const g = ctx.createLinearGradient?.(px(x), px(y), px(x), px(y + h))
    if (!g) return
    g.addColorStop(0, teinte(couleur, densiteHaut))
    g.addColorStop(1, teinte(couleur, densiteBas))
    ctx.fillStyle = g
    ctx.fillRect(px(x), px(y), px(w), px(h))
    return
  }
  // La clé porte le thème : la même bande n'a pas la même couleur d'un thème
  // à l'autre, et un cache qui l'ignorerait servirait l'ancienne.
  const cle = `${theme.id}|${Math.round(w)}x${Math.round(h)}|${couleur}|${densiteHaut}|${densiteBas}`
  let toile = bandes.get(cle)
  if (!toile) {
    toile = document.createElement('canvas')
    toile.width = Math.max(1, Math.ceil(w))
    toile.height = Math.max(1, Math.ceil(h))
    const c = toile.getContext('2d')
    c.fillStyle = couleur
    for (let r = 0; r < toile.height; r += PX) {
      const d = densiteHaut + (densiteBas - densiteHaut) * (r / toile.height)
      if (d <= 0) continue
      const ligne = BAYER[(r / PX) % 4]
      for (let cc = 0; cc < toile.width; cc += PX) {
        if (d > (ligne[(cc / PX) % 4] + 0.5) / 16) c.fillRect(cc, r, PX, PX)
      }
    }
    bandes.set(cle, toile)
  }
  ctx.drawImage(toile, px(x), px(y))
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
