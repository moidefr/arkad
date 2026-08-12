import { C, ton } from '../palette.js'
import { texte, rect, cadre, trame, bloc, lueur } from '../dessin.js'

const CASE = 24
const COLS = 15
const RANGS = 21
const TOP = 88
const BANDE = 20 // hauteur des repères gauche/droite en bas

// Sens rangés dans l'ordre horaire : tourner revient à ±1 sur l'index.
const SENS = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
]

export default {
  id: 'serpent',
  nom: 'SERPENT',
  pitch: 'Appuie à gauche ou à droite pour tourner',
  couleur: C.vert,
  unite: 'pts',
  vies: 3,

  init(j) {
    j.e.corps = [
      { x: 7, y: 12 },
      { x: 7, y: 13 },
      { x: 7, y: 14 },
    ]
    j.e.sens = 0
    j.e.enAttente = null // virage demandé pendant le pas en cours
    j.e.pas = 0
    j.e.cadence = 6 // cases par seconde
    poseFruit(j)
  },

  maj(j, dt) {
    j.e.pas += dt * j.e.cadence
    while (j.e.pas >= 1) {
      j.e.pas -= 1
      avance(j)
      if (j.fini) return
    }
  },

  dessine(j, ctx) {
    const L = COLS * CASE
    const H = RANGS * CASE
    trame(ctx, 0, TOP, L, H, CASE, C.panneau)
    cadre(ctx, 0, TOP, L, H, C.bord)

    const f = j.e.fruit
    lueur(ctx, f.x * CASE + 6, TOP + f.y * CASE + 6, 12, 12, C.accent, 3)
    bloc(ctx, f.x * CASE + 6, TOP + f.y * CASE + 6, 12, 12, C.accent, 2)

    // Chaque anneau glisse depuis la case du suivant : le serpent avance au
    // lieu de sauter, alors que la logique reste au tour par tour.
    const k = Math.min(1, j.e.pas)
    j.e.corps.forEach((c, i) => {
      const de = j.e.corps[i + 1] ?? c
      const x = (de.x + (c.x - de.x) * k) * CASE + 2
      const y = TOP + (de.y + (c.y - de.y) * k) * CASE + 2
      if (i === 0) lueur(ctx, x, y, CASE - 4, CASE - 4, C.vert, 2)
      bloc(ctx, x, y, CASE - 4, CASE - 4, i === 0 ? C.vert : ton(C.vert, -0.45), 3)
    })

    // La zone d'appui est indiquée en permanence : le jeu n'a pas de tutoriel.
    rect(ctx, 0, j.H - 34, j.W / 2 - 2, BANDE, C.panneau)
    rect(ctx, j.W / 2 + 2, j.H - 34, j.W / 2 - 2, BANDE, C.panneau)
    texte(ctx, '< GAUCHE', j.W / 4, j.H - 24, 13, C.faible, 700)
    texte(ctx, 'DROITE >', (j.W * 3) / 4, j.H - 24, 13, C.faible, 700)
  },

  appui(j, p) {
    // Un seul virage est mémorisé : sans ça, deux appuis rapides font faire
    // demi-tour au serpent, donc mourir sur soi-même.
    if (j.e.enAttente !== null) return
    j.e.enAttente = p.x < j.W / 2 ? -1 : 1
  },
}


function avance(j) {
  if (j.e.enAttente !== null) {
    j.e.sens = (j.e.sens + j.e.enAttente + 4) % 4
    j.e.enAttente = null
  }

  const d = SENS[j.e.sens]
  const t = j.e.corps[0]
  const tete = { x: t.x + d.x, y: t.y + d.y }

  if (tete.x < 0 || tete.x >= COLS || tete.y < 0 || tete.y >= RANGS) return j.perdu()
  if (j.e.corps.some((c) => c.x === tete.x && c.y === tete.y)) return j.perdu()

  j.e.corps.unshift(tete)

  if (tete.x === j.e.fruit.x && tete.y === j.e.fruit.y) {
    j.score += 10
    j.e.cadence = Math.min(14, j.e.cadence + 0.25)
    j.son.ramasse()
    j.fx.eclat(tete.x * CASE + CASE / 2, TOP + tete.y * CASE + CASE / 2, C.accent, {
      n: 12,
      vitesse: 110,
      gravite: 0,
    })
    poseFruit(j)
  } else {
    j.e.corps.pop()
  }
}

function poseFruit(j) {
  let f
  do {
    f = { x: j.entier(0, COLS), y: j.entier(0, RANGS) }
  } while (j.e.corps.some((c) => c.x === f.x && c.y === f.y))
  j.e.fruit = f
}
