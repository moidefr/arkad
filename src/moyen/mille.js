import { C } from '../palette.js'
import { texte, rect, bloc, lueur } from '../dessin.js'

const N = 4
const CASE = 76
const ECART = 8
const X0 = 12
const Y0 = 180
const SEUIL_GESTE = 22 // en dessous, c'est un appui, pas un glissement

// Une teinte par palier : on reconnaît la valeur avant même de lire le nombre.
const TEINTES = {
  2: C.panneau,
  4: C.bord,
  8: C.cyan,
  16: C.vert,
  32: C.accent,
  64: C.rouge,
  128: C.violet,
  256: C.violet,
  512: C.accent,
  1024: C.accent,
  2048: C.accent,
}

export default {
  id: 'mille',
  nom: '2048',
  pitch: 'Glisse pour tout pousser. Les jumeaux fusionnent',
  couleur: C.vert,
  unite: 'pts',

  finTitre: (j) => (j.e.atteint ? { texte: '2048 !', couleur: C.accent } : { texte: 'BLOQUÉ', couleur: C.rouge }),

  init(j) {
    j.e.g = Array(N * N).fill(0)
    j.e.atteint = false
    j.e.depart = null
    ajoute(j)
    ajoute(j)
  },

  dessine(j, ctx) {
    rect(ctx, X0 - 6, Y0 - 6, N * (CASE + ECART) - ECART + 12, N * (CASE + ECART) - ECART + 12, C.panneau)

    for (let i = 0; i < N * N; i++) {
      const v = j.e.g[i]
      const x = X0 + (i % N) * (CASE + ECART)
      const y = Y0 + Math.floor(i / N) * (CASE + ECART)
      if (!v) {
        rect(ctx, x, y, CASE, CASE, C.fond)
        continue
      }
      const teinte = TEINTES[v] ?? C.accent
      if (v >= 64) lueur(ctx, x, y, CASE, CASE, teinte, 2, 0.7)
      bloc(ctx, x, y, CASE, CASE, teinte, 4)
      const petit = v >= 1024
      texte(ctx, v, x + CASE / 2, y + CASE / 2, petit ? 22 : 28, v >= 8 ? C.fond : C.texte, 700, CASE - 8)
    }

    texte(ctx, 'glisse dans une direction', j.W / 2, Y0 + N * (CASE + ECART) + 24, 13, C.faible, 700)
  },

  appui(j, p) {
    j.e.depart = { x: p.x, y: p.y }
  },

  relache(j, p) {
    const d = j.e.depart
    j.e.depart = null
    if (!d) return
    const dx = p.x - d.x
    const dy = p.y - d.y
    if (Math.abs(dx) < SEUIL_GESTE && Math.abs(dy) < SEUIL_GESTE) return
    const sens = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'd' : 'g') : dy > 0 ? 'b' : 'h'
    joue(j, sens)
  },
}

function ajoute(j) {
  const vides = []
  for (let i = 0; i < N * N; i++) if (!j.e.g[i]) vides.push(i)
  if (!vides.length) return
  j.e.g[vides[Math.floor(Math.random() * vides.length)]] = Math.random() < 0.9 ? 2 : 4
}

/** Les index d'une ligne, dans l'ordre où elle est poussée. */
function ligne(k, sens) {
  const out = []
  for (let i = 0; i < N; i++) {
    if (sens === 'g') out.push(k * N + i)
    else if (sens === 'd') out.push(k * N + (N - 1 - i))
    else if (sens === 'h') out.push(i * N + k)
    else out.push((N - 1 - i) * N + k)
  }
  return out
}

function joue(j, sens) {
  const avant = j.e.g.join(',')
  let gagne = 0

  for (let k = 0; k < N; k++) {
    const idx = ligne(k, sens)
    const vals = idx.map((i) => j.e.g[i]).filter(Boolean)
    const sortie = []
    for (let i = 0; i < vals.length; i++) {
      if (vals[i] === vals[i + 1]) {
        const v = vals[i] * 2
        sortie.push(v)
        gagne += v
        if (v === 2048) j.e.atteint = true
        i++
      } else sortie.push(vals[i])
    }
    while (sortie.length < N) sortie.push(0)
    idx.forEach((i, n) => (j.e.g[i] = sortie[n]))
  }

  if (j.e.g.join(',') === avant) return // aucun mouvement : coup ignoré

  j.score += gagne
  if (gagne) {
    j.son.casse(Math.min(11, Math.log2(gagne)))
    j.fx.bulle(j.W / 2, Y0 - 26, '+' + gagne, C.accent, 17)
    j.fx.secoue(1.5)
  } else j.son.rebond()

  ajoute(j)
  if (bloque(j)) {
    j.son.rate()
    j.perdu()
  }
}

/** Bloqué : plus une case vide, et aucun couple identique côte à côte. */
function bloque(j) {
  if (j.e.g.some((v) => !v)) return false
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const v = j.e.g[r * N + c]
      if (c + 1 < N && j.e.g[r * N + c + 1] === v) return false
      if (r + 1 < N && j.e.g[(r + 1) * N + c] === v) return false
    }
  }
  return true
}
