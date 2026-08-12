import { C, ton } from '../palette.js'
import { texte, rect, cadre, bloc, lueur } from '../dessin.js'

const N = 4
const CASE = 78
const ECART = 6
const X0 = 15
const Y0 = 170

export default {
  id: 'taquin',
  nom: 'TAQUIN',
  pitch: 'Remets les nombres dans l’ordre en glissant les tuiles',
  couleur: C.vert,
  unite: 'pts',

  finTitre: () => ({ texte: 'RÉSOLU', couleur: C.accent }),

  init(j) {
    // On part de la solution et on mélange par coups légaux : le taquin
    // obtenu est forcément résoluble, contrairement à un tirage au hasard.
    j.e.g = Array.from({ length: N * N }, (_, i) => (i + 1) % (N * N))
    j.e.vide = N * N - 1
    for (let k = 0; k < 400; k++) {
      const c = coups(j.e.vide)
      glisse(j, c[Math.floor(Math.random() * c.length)], true)
    }
    j.e.coups = 0
  },

  dessine(j, ctx) {
    const cote = N * (CASE + ECART) - ECART
    cadre(ctx, X0 - 6, Y0 - 6, cote + 12, cote + 12, C.bord)

    for (let i = 0; i < N * N; i++) {
      const v = j.e.g[i]
      if (!v) continue
      const x = X0 + (i % N) * (CASE + ECART)
      const y = Y0 + Math.floor(i / N) * (CASE + ECART)
      // Une tuile bien placée s'éteint : on voit sa progression d'un coup d'œil.
      const place = v === i + 1
      if (!place) lueur(ctx, x, y, CASE, CASE, C.vert, 2, 0.5)
      bloc(ctx, x, y, CASE, CASE, place ? ton(C.panneau, 0.2) : C.vert, 4)
      texte(ctx, v, x + CASE / 2, y + CASE / 2, 30, place ? C.faible : C.fond, 700)
    }

    ctx.textAlign = 'left'
    texte(ctx, `coups ${j.e.coups}`, 16, 130, 14, C.faible, 700)
    ctx.textAlign = 'right'
    texte(ctx, `${Math.floor(j.t)} s`, j.W - 16, 130, 14, C.faible, 700)
    ctx.textAlign = 'center'
    texte(ctx, 'appuie sur une tuile voisine du trou', j.W / 2, Y0 + cote + 30, 13, C.faible, 700)
  },

  appui(j, p) {
    const c = Math.floor((p.x - X0) / (CASE + ECART))
    const r = Math.floor((p.y - Y0) / (CASE + ECART))
    if (c < 0 || c >= N || r < 0 || r >= N) return
    const i = r * N + c
    if (!coups(j.e.vide).includes(i)) return
    glisse(j, i)
  },
}

/** Les cases qui peuvent glisser dans le trou : ses quatre voisines. */
function coups(vide) {
  const c = vide % N
  const r = Math.floor(vide / N)
  const out = []
  if (c > 0) out.push(vide - 1)
  if (c < N - 1) out.push(vide + 1)
  if (r > 0) out.push(vide - N)
  if (r < N - 1) out.push(vide + N)
  return out
}

function glisse(j, i, melange = false) {
  j.e.g[j.e.vide] = j.e.g[i]
  j.e.g[i] = 0
  j.e.vide = i
  if (melange) return

  j.e.coups++
  j.son.rebond()

  if (j.e.g.every((v, k) => v === (k + 1) % (N * N))) {
    // Le score récompense la sobriété : peu de coups, peu de temps.
    j.score = Math.max(50, 3000 - j.e.coups * 8 - Math.floor(j.t) * 4)
    j.son.niveau()
    j.fx.eclat(j.W / 2, j.H / 2, C.accent, { n: 32, vitesse: 260 })
    j.perdu()
  }
}
