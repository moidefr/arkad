import { C, ton } from '../palette.js'
import { texte, cadre, bloc, pastille, lueur } from '../dessin.js'

const N = 7
const CASE = 42
const Y0 = 170
const CENTRE = 3 * N + 3 // (3, 3) : la case retirée au départ

const R_TROU = 16
const R_PION = 14

const DIRECTIONS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
]

/** Le plateau anglais : un carré 7×7 dont les quatre coins 2×2 sont retirés. */
function valide(r, c) {
  const bordRow = r < 2 || r > 4
  const bordCol = c < 2 || c > 4
  return !(bordRow && bordCol)
}

function construitPlateau() {
  const plateau = new Array(N * N).fill(null)
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (valide(r, c)) plateau[r * N + c] = true
  plateau[CENTRE] = false // seul trou vide au départ
  return plateau
}

/**
 * La case à mi-chemin entre `de` et `a` si les deux sont alignées à exactement
 * deux cases d'écart (ligne ou colonne), sinon `null` — pas de diagonale.
 */
function milieu(de, a) {
  const rd = Math.floor(de / N)
  const cd = de % N
  const ra = Math.floor(a / N)
  const ca = a % N
  if (rd === ra && Math.abs(cd - ca) === 2) return rd * N + (cd + ca) / 2
  if (cd === ca && Math.abs(rd - ra) === 2) return ((rd + ra) / 2) * N + cd
  return null
}

/** Vrai s'il reste au moins un saut possible pour un pion du plateau. */
function existeCoup(plateau) {
  for (let i = 0; i < plateau.length; i++) {
    if (plateau[i] !== true) continue
    const r = Math.floor(i / N)
    const c = i % N
    for (const [dr, dc] of DIRECTIONS) {
      const rd = r + dr * 2
      const cd = c + dc * 2
      if (rd < 0 || rd >= N || cd < 0 || cd >= N) continue
      const mid = (r + dr) * N + (c + dc)
      const dest = rd * N + cd
      if (plateau[mid] === true && plateau[dest] === false) return true
    }
  }
  return false
}

/** Moins il reste de pions et plus la victoire finit au centre, mieux c'est. */
function calcScore(pionsRestants, centre) {
  let s = (32 - pionsRestants) * 80
  if (pionsRestants === 1) {
    s += 700
    if (centre) s += 300
  }
  return s
}

export default {
  id: 'solitaire',
  nom: 'SOLITAIRE',
  pitch: 'Saute par-dessus un pion pour le capturer, il n’en doit rester qu’un',
  couleur: C.vert,
  unite: 'pts',

  finTitre: (j) => {
    if (j.e.pions === 1) return { texte: j.e.centre ? 'RÉSOLU · CENTRE' : 'RÉSOLU', couleur: C.accent }
    return { texte: `BLOCAGE · ${j.e.pions} PIONS`, couleur: C.rouge }
  },

  init(j) {
    j.e.plateau = construitPlateau()
    j.e.sel = null
    j.e.pions = 32
    j.e.centre = false
    j.e.x0 = Math.floor((j.W - N * CASE) / 2)
    j.e.y0 = Y0
  },

  dessine(j, ctx) {
    const { x0, y0, plateau, sel } = j.e

    // Trois panneaux rectangulaires assemblés en croix : c'est la silhouette
    // du plateau, sans qu'aucune primitive n'ait besoin de dessiner une forme
    // en croix elle-même.
    bloc(ctx, x0, y0 + 2 * CASE, N * CASE, 3 * CASE, ton(C.panneau, 0.05), 4)
    bloc(ctx, x0 + 2 * CASE, y0, 3 * CASE, 2 * CASE, ton(C.panneau, 0.05), 4)
    bloc(ctx, x0 + 2 * CASE, y0 + 5 * CASE, 3 * CASE, 2 * CASE, ton(C.panneau, 0.05), 4)
    cadre(ctx, x0, y0 + 2 * CASE, N * CASE, 3 * CASE, C.bord)
    cadre(ctx, x0 + 2 * CASE, y0, 3 * CASE, 2 * CASE, C.bord)
    cadre(ctx, x0 + 2 * CASE, y0 + 5 * CASE, 3 * CASE, 2 * CASE, C.bord)

    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const i = r * N + c
        if (plateau[i] === null) continue
        const x = x0 + c * CASE + CASE / 2
        const y = y0 + r * CASE + CASE / 2
        pastille(ctx, x, y, R_TROU, C.fond)
        if (plateau[i] !== true) continue
        const choisi = i === sel
        if (choisi) lueur(ctx, x - R_PION, y - R_PION, R_PION * 2, R_PION * 2, C.vert, 3, 0.9)
        pastille(ctx, x, y, R_PION, choisi ? ton(C.vert, 0.3) : C.vert)
        pastille(ctx, x, y, R_PION - 6, ton(C.vert, choisi ? 0.55 : -0.2))
      }
    }

    ctx.textAlign = 'left'
    texte(ctx, `${j.e.pions} pions`, 16, 130, 16, C.accent, 700)
    ctx.textAlign = 'right'
    texte(ctx, `${Math.floor(j.t)} s`, j.W - 16, 130, 14, C.faible, 700)
    ctx.textAlign = 'center'
    texte(ctx, 'saute un pion par-dessus un voisin', j.W / 2, y0 + N * CASE + 26, 13, C.faible, 700)
  },

  appui(j, p) {
    if (j.fini) return
    const i = index(j, p)
    if (i === null) return
    const sel = j.e.sel

    if (sel === null) {
      if (j.e.plateau[i] === true) {
        j.e.sel = i
        j.son.clic()
      }
      return
    }

    if (i === sel) {
      j.e.sel = null // retap sur le même pion : on annule la sélection
      return
    }

    if (j.e.plateau[i] === true) {
      j.e.sel = i // on change simplement de pion sélectionné
      j.son.clic()
      return
    }

    const mid = milieu(sel, i)
    if (mid !== null && j.e.plateau[mid] === true) saute(j, sel, mid, i)
    else {
      j.e.sel = null
      j.son.rate()
    }
  },
}

function index(j, p) {
  const c = Math.floor((p.x - j.e.x0) / CASE)
  const r = Math.floor((p.y - j.e.y0) / CASE)
  if (c < 0 || c >= N || r < 0 || r >= N) return null
  const i = r * N + c
  if (j.e.plateau[i] === null) return null
  return i
}

function saute(j, de, mid, a) {
  j.e.plateau[de] = false
  j.e.plateau[mid] = false
  j.e.plateau[a] = true
  j.e.pions--
  j.e.sel = null
  j.son.rebond()

  const { x0, y0 } = j.e
  const rm = Math.floor(mid / N)
  const cm = mid % N
  j.fx.eclat(x0 + cm * CASE + CASE / 2, y0 + rm * CASE + CASE / 2, C.vert, { n: 12, vitesse: 140 })

  if (j.e.pions === 1) {
    j.e.centre = a === CENTRE
    j.score = calcScore(j.e.pions, j.e.centre)
    j.son.niveau()
    const ra = Math.floor(a / N)
    const ca = a % N
    j.fx.eclat(x0 + ca * CASE + CASE / 2, y0 + ra * CASE + CASE / 2, C.accent, { n: 30, vitesse: 250 })
    return j.perdu()
  }

  if (!existeCoup(j.e.plateau)) {
    j.e.centre = false
    j.score = calcScore(j.e.pions, false)
    j.son.rate()
    j.perdu()
  }
}
