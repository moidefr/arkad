import { C } from '../palette.js'
import { texte, rect, bloc, lueur } from '../dessin.js'

const N = 4
const CASE = 76
const ECART = 8
const X0 = 12
const Y0 = 180
const SEUIL_GESTE = 22 // en dessous, c'est un appui, pas un glissement
const GLISSE = 0.12 // durée du déplacement des tuiles
const POP = 0.14 // durée de l'apparition d'une nouvelle tuile

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
    j.e.anim = null
    j.e.neuf = null
    ajoute(j)
    ajoute(j)
  },

  maj(j, dt) {
    if (j.e.anim) {
      j.e.anim.t += dt
      if (j.e.anim.t >= GLISSE) j.e.anim = null
    }
    if (j.e.neuf) {
      j.e.neuf.t += dt
      if (j.e.neuf.t >= POP) j.e.neuf = null
    }
  },

  dessine(j, ctx) {
    const cote = N * (CASE + ECART) - ECART
    rect(ctx, X0 - 6, Y0 - 6, cote + 12, cote + 12, C.panneau)
    for (let i = 0; i < N * N; i++) rect(ctx, place(i).x, place(i).y, CASE, CASE, C.fond)

    const anim = j.e.anim
    if (anim) {
      // Pendant le glissement, on dessine les tuiles en mouvement à leur
      // position interpolée, pas la grille : sinon elles apparaîtraient
      // arrivées avant d'être parties.
      const k = lisse(anim.t / GLISSE)
      for (const m of anim.mouvements) {
        const a = place(m.de)
        const b = place(m.vers)
        tuile(ctx, a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, m.v, 1)
      }
    } else {
      for (let i = 0; i < N * N; i++) {
        const v = j.e.g[i]
        if (!v) continue
        const { x, y } = place(i)
        // La tuile qui vient d'apparaître grossit depuis rien.
        const neuve = j.e.neuf && j.e.neuf.i === i
        tuile(ctx, x, y, v, neuve ? lisse(j.e.neuf.t / POP) : 1)
      }
    }

    texte(ctx, 'glisse dans une direction', j.W / 2, Y0 + cote + 30, 13, C.faible, 700)
  },

  appui(j, p) {
    j.e.depart = { x: p.x, y: p.y }
  },

  relache(j, p) {
    const d = j.e.depart
    j.e.depart = null
    if (!d || j.e.anim) return
    const dx = p.x - d.x
    const dy = p.y - d.y
    if (Math.abs(dx) < SEUIL_GESTE && Math.abs(dy) < SEUIL_GESTE) return
    const sens = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'd' : 'g') : dy > 0 ? 'b' : 'h'
    joue(j, sens)
  },
}

const place = (i) => ({ x: X0 + (i % N) * (CASE + ECART), y: Y0 + Math.floor(i / N) * (CASE + ECART) })
/** Départ et arrivée adoucis : un glissement linéaire fait mécanique. */
const lisse = (k) => {
  const t = Math.min(1, Math.max(0, k))
  return t * t * (3 - 2 * t)
}

function tuile(ctx, x, y, v, echelle) {
  const m = ((1 - echelle) * CASE) / 2
  const c = CASE - m * 2
  const teinte = TEINTES[v] ?? C.accent
  if (v >= 64) lueur(ctx, x + m, y + m, c, c, teinte, 2, 0.7 * echelle)
  bloc(ctx, x + m, y + m, c, c, teinte, 4)
  if (echelle > 0.7) {
    texte(ctx, v, x + CASE / 2, y + CASE / 2, v >= 1024 ? 22 : 28, v >= 8 ? C.fond : C.texte, 700, CASE - 8)
  }
}

function ajoute(j) {
  const vides = []
  for (let i = 0; i < N * N; i++) if (!j.e.g[i]) vides.push(i)
  if (!vides.length) return
  const i = vides[Math.floor(Math.random() * vides.length)]
  j.e.g[i] = Math.random() < 0.9 ? 2 : 4
  j.e.neuf = { i, t: 0 }
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
  const mouvements = []
  let gagne = 0

  for (let k = 0; k < N; k++) {
    const idx = ligne(k, sens)
    // On garde l'index d'origine de chaque tuile : c'est lui qui permettra de
    // la faire partir du bon endroit à l'écran.
    const cases = idx.map((i) => ({ i, v: j.e.g[i] })).filter((o) => o.v)
    const sortie = []

    for (let n = 0; n < cases.length; n++) {
      const vers = idx[sortie.length]
      if (cases[n + 1] && cases[n].v === cases[n + 1].v) {
        const v = cases[n].v * 2
        mouvements.push({ de: cases[n].i, vers, v: cases[n].v })
        mouvements.push({ de: cases[n + 1].i, vers, v: cases[n + 1].v })
        sortie.push(v)
        gagne += v
        if (v === 2048) j.e.atteint = true
        n++
      } else {
        mouvements.push({ de: cases[n].i, vers, v: cases[n].v })
        sortie.push(cases[n].v)
      }
    }

    while (sortie.length < N) sortie.push(0)
    idx.forEach((i, n) => (j.e.g[i] = sortie[n]))
  }

  if (j.e.g.join(',') === avant) return // aucun mouvement : coup ignoré

  j.score += gagne
  j.e.anim = { t: 0, mouvements }
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
