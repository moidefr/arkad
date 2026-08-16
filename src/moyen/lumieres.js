import { C, ton } from '../palette.js'
import { texte, cadre, bloc, lueur } from '../dessin.js'

const N = 5
const CASE = 58
const ECART = 6
const X0 = 23
const Y0 = 170

// Le nombre de bascules du mélange : assez pour brouiller la grille, jamais
// assez pour qu'un joueur les recompte à l'œil.
const MELANGES = 15

export default {
  id: 'lumieres',
  nom: 'LUMIÈRES',
  pitch: 'Éteins toutes les lumières : chaque appui retourne aussi ses voisines',
  couleur: C.rouge,
  unite: 'pts',

  finTitre: () => ({ texte: 'RÉSOLU', couleur: C.rouge }),

  init(j) {
    melange(j)
    j.e.coups = 0
  },

  dessine(j, ctx) {
    const cote = N * (CASE + ECART) - ECART
    cadre(ctx, X0 - 6, Y0 - 6, cote + 12, cote + 12, C.bord)

    for (let i = 0; i < N * N; i++) {
      const allume = j.e.g[i]
      const x = X0 + (i % N) * (CASE + ECART)
      const y = Y0 + Math.floor(i / N) * (CASE + ECART)
      // Une case allumée bave sur ses voisines : c'est ce halo, pas juste sa
      // couleur, qui la rend « allumée » plutôt que simplement peinte.
      if (allume) lueur(ctx, x, y, CASE, CASE, C.rouge, 2, 0.6)
      bloc(ctx, x, y, CASE, CASE, allume ? C.rouge : ton(C.panneau, 0.2), 4)
    }

    ctx.textAlign = 'left'
    texte(ctx, `coups ${j.e.coups}`, 16, 130, 14, C.faible, 700)
    ctx.textAlign = 'right'
    texte(ctx, `${Math.floor(j.t)} s`, j.W - 16, 130, 14, C.faible, 700)
    ctx.textAlign = 'center'
    texte(ctx, 'un appui retourne la case et ses voisines', j.W / 2, Y0 + cote + 30, 13, C.faible, 700)
  },

  appui(j, p) {
    const c = Math.floor((p.x - X0) / (CASE + ECART))
    const r = Math.floor((p.y - Y0) / (CASE + ECART))
    if (c < 0 || c >= N || r < 0 || r >= N) return
    bascule(j, r * N + c)
    j.e.coups++
    j.son.clic()

    if (j.e.g.every((v) => !v)) {
      // Le score récompense la sobriété, comme au taquin : peu de coups, peu
      // de temps.
      j.score = Math.max(50, 2000 - j.e.coups * 15 - Math.floor(j.t) * 4)
      j.son.niveau()
      j.fx.eclat(j.W / 2, j.H / 2, C.rouge, { n: 32, vitesse: 260 })
      j.perdu()
    }
  },
}

/** Les cases qu'un appui retourne : la case elle-même et ses voisines orthogonales. */
export function voisins(i, n = N) {
  const c = i % n
  const r = Math.floor(i / n)
  const out = [i]
  if (c > 0) out.push(i - 1)
  if (c < n - 1) out.push(i + 1)
  if (r > 0) out.push(i - n)
  if (r < n - 1) out.push(i + n)
  return out
}

function bascule(j, i) {
  for (const k of voisins(i, N)) j.e.g[k] = !j.e.g[k]
}

/**
 * Part de tout éteint et applique des bascules aléatoires : chacune suit
 * exactement la règle du jeu (case + voisines), donc le chemin inverse — la
 * résolution — existe toujours, sans jamais calculer de parité au runtime.
 */
function melange(j) {
  do {
    j.e.g = Array.from({ length: N * N }, () => false)
    for (let k = 0; k < MELANGES; k++) bascule(j, Math.floor(Math.random() * N * N))
  } while (j.e.g.every((v) => !v))
}
