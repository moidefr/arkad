import { C, ton } from '../palette.js'
import { texte, rect, cadre, bloc } from '../dessin.js'

const CASE = 32
const CLUE = 16 // largeur/hauteur d'une case d'indice, en marge
const Y_GRILLE = 110 // sous la ligne d'info
const LONG_APPUI = 0.32 // au-delà, on pose une croix
const DENSITE = 0.45

// Une grille seule se résout en une minute. La série grandit la difficulté et
// donne au picross la durée d'un jeu MOYEN — et comme rien ici ne peut faire
// perdre, elle est bornée : la dernière grille résolue est la victoire.
const TAILLES = [5, 6, 7, 8]

export default {
  id: 'picross',
  nom: 'PICROSS',
  pitch: 'Remplis la grille grâce aux indices, marque en croix ce qui est vide',
  couleur: C.cyan,
  unite: 'pts',

  finTitre: () => ({ texte: 'RÉSOLU', couleur: C.cyan }),

  init(j) {
    j.e.niveau = 1
    j.e.fanfare = 0
    poseNiveau(j)
  },

  maj(j, dt) {
    j.e.fanfare = Math.max(0, j.e.fanfare - dt)

    // La croix se pose dès que l'appui dure : attendre le relâchement
    // donnerait l'impression que le jeu n'a pas compris.
    const a = j.e.appui
    if (a && !a.fait && j.maintenu) {
      a.duree += dt
      if (a.duree >= LONG_APPUI) {
        a.fait = true
        marqueCroix(j, a.i)
      }
    }
  },

  dessine(j, ctx) {
    const { n, x0, y0, lignes, colonnes, cases } = j.e
    const remplis = cases.map((c) => c.rempli)
    const lignesVues = indices(remplis, n, 'ligne')
    const colonnesVues = indices(remplis, n, 'colonne')

    ctx.textAlign = 'center'
    cadre(ctx, x0 - 2, y0 - 2, n * CASE + 4, n * CASE + 4, C.bord)

    for (let i = 0; i < cases.length; i++) {
      const c = cases[i]
      const x = x0 + (i % n) * CASE
      const y = y0 + Math.floor(i / n) * CASE

      if (c.rempli) {
        bloc(ctx, x + 1, y + 1, CASE - 2, CASE - 2, C.cyan, 3)
        continue
      }
      bloc(ctx, x + 1, y + 1, CASE - 2, CASE - 2, ton(C.panneau, 0.22), 3)
      if (c.croix) texte(ctx, '×', x + CASE / 2, y + CASE / 2, 18, C.faible, 700)
    }

    // Une ligne ou une colonne dont les cases noircies collent déjà à son
    // indice s'éteint : comme sur une grille papier, on la raye des yeux.
    for (let r = 0; r < n; r++) {
      const L = lignes[r]
      const fait = egal(L, lignesVues[r])
      const yc = y0 + r * CASE + CASE / 2
      for (let k = 0; k < L.length; k++) {
        const x = x0 - (L.length - k) * CLUE + CLUE / 2
        texte(ctx, L[k], x, yc, 14, fait ? C.faible : C.texte, 700)
      }
    }
    for (let cc = 0; cc < n; cc++) {
      const L = colonnes[cc]
      const fait = egal(L, colonnesVues[cc])
      const xc = x0 + cc * CASE + CASE / 2
      for (let k = 0; k < L.length; k++) {
        const y = y0 - (L.length - k) * CLUE + CLUE / 2
        texte(ctx, L[k], xc, y, 14, fait ? C.faible : C.texte, 700)
      }
    }

    ctx.textAlign = 'left'
    texte(ctx, `GRILLE ${j.e.niveau}/${TAILLES.length}`, 14, 76, 16, C.cyan, 700)
    texte(ctx, `${n} × ${n}`, 14, 100, 13, C.faible, 700)
    ctx.textAlign = 'right'
    texte(ctx, `${Math.floor(j.t)} s`, j.W - 14, 76, 14, C.faible, 700)
    texte(ctx, 'appui long = croix', j.W - 14, 100, 13, C.faible, 700)
    ctx.textAlign = 'center'
    texte(ctx, 'noircis les cases indiquées par les indices', j.W / 2, y0 + n * CASE + 26, 13, C.faible, 700)

    if (j.e.fanfare > 0) {
      ctx.fillStyle = `rgba(11, 14, 13, ${Math.min(0.8, j.e.fanfare)})`
      rect(ctx, 0, 0, j.W, j.H, ctx.fillStyle)
      texte(ctx, `GRILLE ${j.e.niveau - 1} RÉSOLUE`, j.W / 2, j.H / 2 - 16, 22, C.cyan, 700)
      texte(ctx, `grille ${j.e.niveau}/${TAILLES.length}`, j.W / 2, j.H / 2 + 18, 15, C.texte, 700)
    }
  },

  appui(j, p) {
    if (j.e.fanfare > 0) return
    const i = index(j, p)
    if (i === null) return
    j.e.appui = { i, duree: 0, fait: false }
  },

  relache(j) {
    const a = j.e.appui
    j.e.appui = null
    if (!a || a.fait || j.e.fanfare > 0) return
    bascule(j, a.i)
  },
}

/**
 * Un motif tiré au hasard, et les indices qu'on en déduit par ligne et par
 * colonne. Fonction pure — c'est ce qui permet de l'éprouver sans canvas ni
 * moteur, en pur calcul.
 */
export function genere(n, hasard = Math.random) {
  let motif
  let essais = 0
  do {
    motif = Array.from({ length: n * n }, () => hasard() < DENSITE)
    essais++
  } while (essais < 60 && degenere(motif, n))
  return { motif, lignes: indices(motif, n, 'ligne'), colonnes: indices(motif, n, 'colonne') }
}

/** Rejette les grilles triviales : une ligne ou une colonne pleine ou vide se résout sans réfléchir. */
function degenere(motif, n) {
  for (let i = 0; i < n; i++) {
    const l = Array.from({ length: n }, (_, k) => motif[i * n + k])
    const c = Array.from({ length: n }, (_, k) => motif[k * n + i])
    if (l.every((v) => !v) || l.every((v) => v)) return true
    if (c.every((v) => !v) || c.every((v) => v)) return true
  }
  return false
}

/** Les indices d'un motif plat, ligne par ligne ou colonne par colonne. */
export function indices(motif, n, sens) {
  const out = []
  for (let i = 0; i < n; i++) {
    const bits = []
    for (let k = 0; k < n; k++) bits.push(sens === 'ligne' ? motif[i * n + k] : motif[k * n + i])
    out.push(blocs(bits))
  }
  return out
}

/** Les longueurs des blocs consécutifs d'une ligne de cases. [0] si aucune. */
function blocs(bits) {
  const out = []
  let courant = 0
  for (const b of bits) {
    if (b) courant++
    else if (courant) {
      out.push(courant)
      courant = 0
    }
  }
  if (courant) out.push(courant)
  return out.length ? out : [0]
}

function egal(a, b) {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

function index(j, p) {
  const c = Math.floor((p.x - j.e.x0) / CASE)
  const r = Math.floor((p.y - j.e.y0) / CASE)
  if (c < 0 || c >= j.e.n || r < 0 || r >= j.e.n) return null
  return r * j.e.n + c
}

function marqueCroix(j, i) {
  const c = j.e.cases[i]
  if (c.rempli) return // rien à croiser sur une case déjà noircie
  c.croix = !c.croix
  j.son.rebond()
}

function bascule(j, i) {
  const c = j.e.cases[i]
  if (c.croix) return // il faut d'abord lever la croix, par un appui long
  c.rempli = !c.rempli
  c.croix = false
  j.e.coups++
  j.son.clic()
  if (resolu(j)) complete(j)
}

/** Résolu quand les cases noircies collent au motif — les croix ne comptent jamais. */
function resolu(j) {
  return j.e.cases.every((c, i) => c.rempli === j.e.motif[i])
}

function complete(j) {
  const n = j.e.n
  const duree = j.t - j.e.debut
  // La prime grandit avec la taille de la grille et fond avec le temps et les
  // essais : une grille plus large mérite plus, mais pas si elle traîne.
  const prime = Math.max(80, 260 * n - Math.round(duree * 6) - j.e.coups * 2)
  j.score += prime
  j.fx.eclat(j.W / 2, j.e.y0 + (n * CASE) / 2, C.cyan, { n: 26, vitesse: 240 })

  if (j.e.niveau >= TAILLES.length) {
    j.son.niveau()
    return j.perdu()
  }
  j.son.record()
  j.e.niveau++
  poseNiveau(j)
  j.e.fanfare = 1.4
}

function poseNiveau(j) {
  const n = TAILLES[j.e.niveau - 1]
  const { motif, lignes, colonnes } = genere(n)
  const margeGauche = Math.max(...lignes.map((l) => l.length)) * CLUE
  const margeHaut = Math.max(...colonnes.map((c) => c.length)) * CLUE
  const largeur = margeGauche + n * CASE
  const x0 = Math.round((j.W - largeur) / 2) + margeGauche
  const y0 = Y_GRILLE + margeHaut

  Object.assign(j.e, { n, motif, lignes, colonnes, x0, y0 })
  j.e.cases = motif.map(() => ({ rempli: false, croix: false }))
  j.e.coups = 0
  j.e.appui = null
  j.e.debut = j.t
}
