import { C } from '../palette.js'
import { texte, rect, bloc, lueur, borne } from '../dessin.js'

const N = 3 // grille 3×3
const MARGE = 14
const HAUT = 110
const BAS = 90

// Le flash dure toujours le même instant : c'est la fenêtre qui se resserre,
// jamais la durée de ce qu'il faut retenir. Sans ça, deux difficultés
// bougeraient en même temps et le joueur ne saurait jamais laquelle l'a eu.
const FLASH = 0.15
const FENETRE_INIT = 0.6
const FENETRE_PLANCHER = 0.25
const fenetreDe = (score) => Math.max(FENETRE_PLANCHER, FENETRE_INIT - score * 0.02)

// Une paire n'apparaît qu'une fois le joueur installé, et reste rare : c'est
// un durcissement du jeu de base, pas une nouvelle règle à part entière.
const CHANCE_PAIRE = 0.25
const SCORE_PAIRE = 4

function cases(j) {
  const dispoW = j.W - MARGE * (N + 1)
  const dispoH = j.H - HAUT - BAS - MARGE * (N + 1)
  const cell = Math.max(20, Math.min(dispoW, dispoH) / N)
  const grille = cell * N + MARGE * (N + 1)
  const startX = (j.W - grille) / 2 + MARGE
  const startY = HAUT + MARGE
  const out = []
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      out.push({ x: startX + c * (cell + MARGE), y: startY + r * (cell + MARGE), w: cell, h: cell })
    }
  }
  return out
}

/** Bas de la grille, pour poser la barre de fenêtre juste dessous. */
function bas(j) {
  const c = cases(j)
  const dernier = c[c.length - 1]
  return dernier.y + dernier.h
}

function manche(j) {
  const paire = j.score >= SCORE_PAIRE && j.hasard() < CHANCE_PAIRE
  const cible = [j.entier(0, N * N)]
  if (paire) {
    let second = j.entier(0, N * N)
    let essais = 0
    while (second === cible[0] && essais < 8) {
      second = j.entier(0, N * N)
      essais++
    }
    if (second !== cible[0]) cible.push(second)
  }
  j.e.cible = cible
  j.e.restant = cible.slice()
  j.e.phase = 'actif'
  j.e.t = 0
  j.e.fenetre = fenetreDe(j.score)
  j.e.total = FLASH + j.e.fenetre
  j.son.touche(Math.min(9, 1 + Math.floor(j.score / 5)))
}

function pause(j) {
  j.e.phase = 'pause'
  j.e.tempsPause = 0.45 + j.hasard() * 0.3
  j.e.cible = []
  j.e.restant = []
}

export default {
  id: 'eclair',
  nom: 'ÉCLAIR',
  pitch: 'Un flash, une fraction de seconde. Refais-le tout de suite',
  couleur: C.accent,
  unite: 'flashs',
  vies: 3,

  init(j) {
    j.e.phase = 'pause'
    j.e.tempsPause = 0.5 // un instant avant le tout premier flash, pour laisser regarder l'écran
    j.e.cible = []
    j.e.restant = []
    j.e.t = 0
    j.e.total = 0
  },

  maj(j, dt) {
    if (j.e.phase === 'pause') {
      j.e.tempsPause -= dt
      if (j.e.tempsPause <= 0) manche(j)
      return
    }

    j.e.t += dt
    // Le chrono seul décide : ni case touchée ni tenue, le temps a filé.
    if (j.e.t >= j.e.total) {
      j.son.rate()
      return j.perdu()
    }
  },

  dessine(j, ctx) {
    const c = cases(j)
    const flashe = j.e.phase === 'actif' && j.e.t < FLASH

    c.forEach((z, i) => {
      const allume = flashe && j.e.cible.includes(i)
      if (allume) lueur(ctx, z.x, z.y, z.w, z.h, C.accent, 3)
      bloc(ctx, z.x, z.y, z.w, z.h, allume ? C.accent : C.panneau, 3)
    })

    // La barre ne dit jamais où taper — seulement combien de temps il reste.
    // Se souvenir de la case, c'est le jeu ; l'annoncer serait tricher pour lui.
    const large = 140
    const bx = j.W / 2 - large / 2
    const by = bas(j) + 26
    rect(ctx, bx, by, large, 5, C.bord)
    if (j.e.phase === 'actif') {
      const reste = borne(1 - j.e.t / j.e.total, 0, 1)
      rect(ctx, bx, by, large * reste, 5, reste < 0.3 ? C.rouge : C.accent)
    }

    if (j.t < 4) texte(ctx, 'mémorise le flash, retouche-le vite', j.W / 2, j.H - 40, 13, C.faible, 700)
  },

  appui(j, p) {
    if (j.e.phase !== 'actif') return
    const i = cases(j).findIndex((z) => p.x >= z.x && p.x <= z.x + z.w && p.y >= z.y && p.y <= z.y + z.h)
    if (i === -1) return

    if (!j.e.cible.includes(i)) {
      j.son.rate()
      j.fx.secoue(4)
      return j.perdu()
    }
    if (!j.e.restant.includes(i)) return // déjà touchée cette manche (paire) : rien à refaire

    const z = cases(j)[i]
    j.fx.eclat(z.x + z.w / 2, z.y + z.h / 2, C.accent, { n: 8, vitesse: 120, gravite: 80, duree: 0.3 })
    j.e.restant = j.e.restant.filter((x) => x !== i)
    if (j.e.restant.length > 0) {
      j.son.clic() // une case d'une paire est faite, il en reste une
      return
    }

    j.score += 1
    j.son.touche(Math.min(9, 1 + Math.floor(j.score / 5)))
    pause(j)
  },
}
