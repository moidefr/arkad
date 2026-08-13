/**
 * Le dessin de BRÈCHE, et **les zones qui vont avec**.
 *
 * Une seule fonction de disposition, `dispo(j, p)`, sert au dessin et à
 * l'appui. C'est la règle qui a manqué une fois à l'usine, où les positions
 * posées au dessin étaient reconstruites à l'appui et ne correspondaient
 * plus : plus rien n'était achetable, et aucun test ne le voyait.
 *
 * Elle rend aussi bien le portrait (grille au-dessus, main en dessous) que le
 * paysage (grille à gauche, main à droite) : le reste du fichier ne sait pas
 * dans quel sens il travaille.
 */
import { C, ton } from '../../palette.js'
import { rect, cadre, bloc, texte, lueur, ombre, trame, largeurTexte, px, PX } from '../../dessin.js'
import * as L from './logique.js'
import { PIECE, TRANSFO, TEINTES, encombrement } from './donnees.js'

const M = 20

/**
 * Tous les rectangles de l'écran, calculés à partir du gabarit courant.
 * Rien d'autre dans ce fichier ne connaît de position.
 */
export function dispo(j, p) {
  const large = j.W > j.H
  const t = p.taille
  if (!large) {
    const c = Math.floor((j.W - M * 2) / t)
    const grille = { x: Math.round((j.W - c * t) / 2), y: 112, c, w: c * t, h: c * t }
    const yMain = grille.y + grille.h + 18
    const lm = Math.floor((j.W - M * 2 - 16) / 3)
    return {
      large,
      entete: { x: M, y: 62, w: j.W - M * 2, h: 42 },
      grille,
      main: [0, 1, 2].map((k) => ({ x: M + k * (lm + 8), y: yMain, w: lm, h: Math.min(104, j.H - 40 - yMain) })),
      outils: [
        { x: M, y: j.H - 44, w: (j.W - M * 2 - 8) / 2, h: 34, quoi: 'marteau' },
        { x: M + (j.W - M * 2 - 8) / 2 + 8, y: j.H - 44, w: (j.W - M * 2 - 8) / 2, h: 34, quoi: 'echange' },
      ],
    }
  }
  const hDispo = j.H - 66 - 14
  const c = Math.max(16, Math.floor(Math.min((j.W * 0.52 - 30) / t, hDispo / t)))
  const grille = { x: 18, y: Math.round(66 + (hDispo - c * t) / 2), c, w: c * t, h: c * t }
  const cx = grille.x + grille.w + 20
  const cw = j.W - cx - 16
  const lm = Math.floor((cw - 16) / 3)
  return {
    large,
    entete: { x: cx, y: 62, w: cw, h: 46 },
    grille,
    main: [0, 1, 2].map((k) => ({ x: cx + k * (lm + 8), y: 116, w: lm, h: 96 })),
    outils: [
      { x: cx, y: 226, w: (cw - 8) / 2, h: 36, quoi: 'marteau' },
      { x: cx + (cw - 8) / 2 + 8, y: 226, w: (cw - 8) / 2, h: 36, quoi: 'echange' },
    ],
  }
}

/** La case de grille sous un point, ou null. */
export function caseSous(d, p, x, y) {
  const c = Math.floor((x - d.grille.x) / d.grille.c)
  const l = Math.floor((y - d.grille.y) / d.grille.c)
  return L.dans(p, c, l) ? { c, l } : null
}

// --- Le plateau ---------------------------------------------------------------------

/** Un bloc posé : un carré en relief, plus sa marque s'il en porte une. */
function blocCase(ctx, x, y, c, teinte, spec, gel) {
  const couleur = TEINTES[teinte - 1] ?? C.faible
  bloc(ctx, x + 1, y + 1, c - 2, c - 2, gel ? ton(couleur, -0.45) : couleur, Math.max(2, c / 10))
  if (gel) {
    // Le givre : une trame claire par-dessus, qui dit « il faudra y revenir ».
    for (let i = 2; i < c - 2; i += 4) rect(ctx, x + i, y + 2, PX, c - 4, ton(C.cyan, 0.3))
  }
  const t = TRANSFO[spec]
  if (t) {
    ctx.textAlign = 'center'
    texte(ctx, t.court, x + c / 2, y + c / 2, Math.round(c * 0.6), t.teinte, 700, c - 2)
    ctx.textAlign = 'left'
  }
}

export function plateau(ctx, j, p, d, apercu) {
  const { x, y, c, w, h } = d.grille
  ombre(ctx, x, y, w, h, 4)
  rect(ctx, x, y, w, h, ton(C.fond, 0.18))
  trame(ctx, x, y, w, h, Math.max(8, c / 2), ton(C.bord, -0.2))
  for (let i = 0; i <= p.taille; i++) {
    rect(ctx, x + i * c - PX / 2, y, PX, h, C.bord)
    rect(ctx, x, y + i * c - PX / 2, w, PX, C.bord)
  }

  for (let l = 0; l < p.taille; l++) {
    for (let cc = 0; cc < p.taille; cc++) {
      const i = L.indice(p, cc, l)
      if (!p.cases[i]) continue
      blocCase(ctx, x + cc * c, y + l * c, c, p.cases[i], p.spec[i], p.gel[i])
    }
  }

  // L'aperçu du coup en cours : les cases visées, et les lignes qu'il ferait
  // éclater. C'est cette seconde information qui rend le jeu jouable au doigt.
  if (apercu) {
    for (const k of apercu.lignes) {
      const [dir, n] = k
      if (dir === 'l') rect(ctx, x, y + n * c, w, c, ton(C.accent, -0.55))
      else rect(ctx, x + n * c, y, c, h, ton(C.accent, -0.55))
    }
    for (const e of apercu.cases) {
      const px0 = x + e.c * c
      const py0 = y + e.l * c
      if (apercu.legal) {
        lueur(ctx, px0 + 2, py0 + 2, c - 4, c - 4, C.accent, 2, 0.6)
        bloc(ctx, px0 + 1, py0 + 1, c - 2, c - 2, ton(C.accent, 0.1), Math.max(2, c / 10))
      } else cadre(ctx, px0 + 2, py0 + 2, c - 4, c - 4, C.rouge, PX)
    }
  }
}

// --- Les pièces en main ---------------------------------------------------------------

/** La taille de case qui fait tenir une pièce dans un emplacement donné. */
const caseTenant = (piece, z, marge = 14) => {
  const { w, h } = encombrement(piece)
  return Math.max(6, Math.floor(Math.min((z.w - marge * 2) / w, (z.h - marge * 2 - 12) / h)))
}

export function dessinePiece(ctx, piece, x, y, c, couleur, alpha = 1) {
  const a = ctx.globalAlpha
  ctx.globalAlpha = a * alpha
  for (const [dc, dl] of piece.cases)
    bloc(ctx, x + dc * c + 1, y + dl * c + 1, c - 2, c - 2, couleur, Math.max(2, c / 10))
  ctx.globalAlpha = a
}

export function main(ctx, j, p, d, prise) {
  const zones = []
  // **Une seule taille de case pour les trois emplacements.** Mise à l'échelle
  // de son propre cadre, une pièce d'une case devenait aussi grosse qu'un
  // carré de neuf : la taille cessait d'être une information et on découvrait
  // l'encombrement réel au moment de poser.
  const commun = Math.min(
    ...p.main.filter(Boolean).map((id) => caseTenant(PIECE[id], d.main[0])),
    Math.floor(d.grille.c * 0.8),
  )
  p.main.forEach((id, k) => {
    const z = d.main[k]
    zones.push({ ...z, quoi: 'piece', k })
    if (!id) {
      rect(ctx, z.x, z.y, z.w, z.h, ton(C.panneau, -0.4))
      cadre(ctx, z.x, z.y, z.w, z.h, C.bord)
      return
    }
    const piece = PIECE[id]
    const places = L.placesPossibles(p, id)
    const pris = prise?.k === k
    rect(ctx, z.x, z.y, z.w, z.h, C.panneau)
    cadre(ctx, z.x, z.y, z.w, z.h, places ? (pris ? C.accent : C.bord) : C.rouge)
    if (pris) lueur(ctx, z.x, z.y, z.w, z.h, C.accent, 2, 0.5)

    const c = Number.isFinite(commun) ? commun : caseTenant(piece, z)
    const { w, h } = encombrement(piece)
    const ox = z.x + (z.w - w * c) / 2
    const oy = z.y + (z.h - 12 - h * c) / 2
    dessinePiece(ctx, piece, ox, oy, c, places ? TEINTES[k % TEINTES.length] : ton(C.rouge, -0.4), pris ? 0.3 : 1)

    ctx.textAlign = 'center'
    texte(
      ctx,
      places ? `${places}` : 'BLOQUÉE',
      z.x + z.w / 2,
      z.y + z.h - 9,
      10,
      places ? C.faible : C.rouge,
      700,
      z.w - 6,
    )
    ctx.textAlign = 'left'
  })
  return zones
}

/** La pièce qu'on traîne, dessinée au-dessus du doigt pour ne pas la cacher. */
export function fantome(ctx, p, d, prise, pointer) {
  if (!prise) return
  const piece = PIECE[p.main[prise.k]]
  if (!piece) return
  const { w, h } = encombrement(piece)
  const c = d.grille.c
  const x = pointer.x - (w * c) / 2
  const y = pointer.y - h * c - c * 0.9
  dessinePiece(ctx, piece, x, y, c, C.accent, 0.75)
}

/**
 * L'ancre : la case de grille visée par la pièce qu'on traîne. Le doigt tient
 * la pièce **par en dessous**, décalée d'une case, sinon la main cache
 * exactement ce qu'on essaie de viser.
 */
export function ancre(d, p, prise, pointer) {
  if (!prise) return null
  const piece = PIECE[p.main[prise.k]]
  if (!piece) return null
  const { w, h } = encombrement(piece)
  const c = d.grille.c
  const x = pointer.x - (w * c) / 2
  const y = pointer.y - h * c - c * 0.9
  return {
    c: Math.round((x - d.grille.x) / c),
    l: Math.round((y - d.grille.y) / c),
  }
}

// --- Les bandeaux ---------------------------------------------------------------------

export function entete(ctx, j, p, d) {
  const z = d.entete
  const monde = L.monde(p)
  const but = L.objectif(p)
  const k = Math.min(1, p.score / but)
  ctx.textAlign = 'left'
  texte(ctx, monde.nom, z.x, z.y + 12, 15, monde.teinte, 700, z.w - 90, 1)
  ctx.textAlign = 'right'
  texte(ctx, `${p.score} / ${but}`, z.x + z.w, z.y + 12, 13, k >= 1 ? C.vert : C.faible, 700, 130)
  ctx.textAlign = 'left'
  rect(ctx, z.x, z.y + 22, z.w, 8, C.bord)
  if (k > 0) rect(ctx, z.x, z.y + 22, Math.max(PX, z.w * k), 8, k >= 1 ? C.vert : monde.teinte)

  const gauche = []
  if (p.combo > 1) gauche.push(`CHAÎNE ×${p.combo}`)
  if (p.montees > 0) gauche.push(`CRUE ${p.montees}`)
  texte(ctx, gauche.join(' · '), z.x, z.y + 40, 11, p.combo > 1 ? C.accent : C.faible, 700, z.w)
}

export function outils(ctx, j, p, d, arme) {
  for (const z of d.outils) {
    const n = p.outils[z.quoi] ?? 0
    const actif = n > 0
    const teinte = z.quoi === 'marteau' ? C.rouge : C.cyan
    const a = ctx.globalAlpha
    if (!actif) ctx.globalAlpha = a * 0.4
    if (arme === z.quoi) lueur(ctx, z.x, z.y, z.w, z.h, teinte, 2, 0.7)
    rect(ctx, z.x, z.y, z.w, z.h, C.panneau)
    cadre(ctx, z.x, z.y, z.w, z.h, arme === z.quoi ? teinte : C.faible)
    ctx.textAlign = 'center'
    const nom = z.quoi === 'marteau' ? 'MARTEAU' : 'ÉCHANGE'
    texte(
      ctx,
      `${nom} ${n}`,
      z.x + z.w / 2,
      z.y + z.h / 2,
      12,
      actif ? (arme === z.quoi ? teinte : C.texte) : C.faible,
      700,
      z.w - 8,
    )
    ctx.textAlign = 'left'
    ctx.globalAlpha = a
  }
  return d.outils
}

/** Le bandeau du haut : ce que le moteur affiche à la place du score. */
export const titreHud = (p) => `${p.total}`

// --- L'écran de passage de monde --------------------------------------------------------

export function passage(ctx, j, p) {
  const monde = L.mondeDe(p.n + 1)
  ctx.fillStyle = 'rgba(11, 14, 13, 0.93)'
  ctx.fillRect(0, 0, j.W, j.H)
  ctx.textAlign = 'center'
  const cy = j.H * 0.3
  lueur(ctx, j.W / 2 - 120, cy - 20, 240, 40, C.vert, 3, 0.8)
  texte(ctx, 'MONDE FRANCHI', j.W / 2, cy, 26, C.vert, 700, j.W - 40, 2)
  texte(ctx, monde.nom, j.W / 2, cy + 40, 22, monde.teinte, 700, j.W - 40, 1)

  const lignes = decoupe(ctx, monde.texte, 12, j.W - 80)
  lignes.forEach((l, i) => texte(ctx, l, j.W / 2, cy + 74 + i * 16, 12, C.faible, 700))

  texte(ctx, `OBJECTIF ${monde.objectif}`, j.W / 2, j.H * 0.62, 15, C.accent, 700, j.W - 40)
  ctx.textAlign = 'left'

  const z = { x: j.W / 2 - 110, y: Math.round(j.H * 0.72), w: 220, h: 46, quoi: 'suite' }
  ombre(ctx, z.x, z.y, z.w, z.h, 4)
  lueur(ctx, z.x, z.y, z.w, z.h, C.accent, 2, 0.6)
  rect(ctx, z.x, z.y, z.w, z.h, C.panneau)
  cadre(ctx, z.x, z.y, z.w, z.h, C.accent)
  ctx.textAlign = 'center'
  texte(ctx, 'ENTRER', z.x + z.w / 2, z.y + z.h / 2, 18, C.accent, 700, z.w - 20, 1)
  ctx.textAlign = 'left'
  return [z]
}

function decoupe(ctx, s, taille, largeur) {
  const mots = String(s).split(' ')
  const sortie = []
  let ligne = ''
  for (const m of mots) {
    const essai = ligne ? ligne + ' ' + m : m
    if (largeurTexte(ctx, essai, taille) > largeur && ligne) {
      sortie.push(ligne)
      ligne = m
    } else ligne = essai
  }
  if (ligne) sortie.push(ligne)
  return sortie
}
