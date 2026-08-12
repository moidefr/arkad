import { C } from '../palette.js'
import { rect, borne, vers } from '../dessin.js'

const TAILLE = 24
const SOL = 96 // hauteur du joueur au-dessus du bas de l'écran

export default {
  id: 'esquive',
  nom: 'ESQUIVE',
  pitch: 'Survis sous les blocs, ramasse les étoiles',
  couleur: C.cyan,
  unite: 'm',
  vies: 3,

  init(j) {
    j.e.x = j.W / 2
    j.e.passage = j.W / 2
    j.e.blocs = []
    j.e.etoiles = []
    j.e.filantes = Array.from({ length: 18 }, () => ({
      x: j.hasard() * j.W,
      y: j.hasard() * j.H,
      v: 200 + j.hasard() * 300,
    }))
    j.e.prochaineEtoile = 2
  },

  maj(j, dt) {
    // La vitesse monte avec le temps, mais l'écart entre deux vagues se
    // mesure en pixels, pas en secondes : c'est la seule façon de garantir
    // qu'un passage reste atteignable quand tout accélère.
    const vitesse = 170 + j.t * 6.5
    const ecart = Math.max(190, 260 - j.t * 0.7)

    j.e.x = vers(j.e.x, borne(j.pointer.x, TAILLE / 2, j.W - TAILLE / 2), 640 * dt)
    j.score += dt * 10

    for (const f of j.e.filantes) {
      f.y += (f.v + vitesse) * dt
      if (f.y > j.H) (f.y = j.HUD - 20), (f.x = j.hasard() * j.W)
    }

    const derniere = j.e.blocs.length ? Math.min(...j.e.blocs.map((b) => b.y)) : Infinity
    if (derniere > ecart) vague(j)

    j.e.prochaineEtoile -= dt
    if (j.e.prochaineEtoile <= 0) {
      j.e.prochaineEtoile = 2.4 + j.hasard() * 2.5
      j.e.etoiles.push({ x: 24 + j.hasard() * (j.W - 48), y: -20 })
    }

    for (const b of j.e.blocs) b.y += vitesse * dt
    for (const s of j.e.etoiles) s.y += vitesse * 0.85 * dt
    j.e.blocs = j.e.blocs.filter((b) => b.y < j.H + 40)

    const px = j.e.x - TAILLE / 2
    const py = j.H - SOL
    for (const b of j.e.blocs) {
      if (b.x < px + TAILLE && b.x + b.w > px && b.y < py + TAILLE && b.y + b.h > py) return j.perdu()
    }
    j.e.etoiles = j.e.etoiles.filter((s) => {
      if (s.x + 12 > px && s.x < px + TAILLE && s.y + 12 > py && s.y < py + TAILLE) {
        j.score += 25
        j.son.ramasse()
        j.fx.eclat(s.x + 6, s.y + 6, C.accent, { n: 12, vitesse: 130, taille: 4 })
        j.fx.bulle(s.x + 6, s.y, '+25', C.accent)
        return false
      }
      return s.y < j.H + 30
    })
  },

  dessine(j, ctx) {
    // Traits de vitesse : c'est ce qui donne l'impression de descendre.
    for (const f of j.e.filantes) rect(ctx, f.x, f.y, 2, 10, C.panneau)

    for (const s of j.e.etoiles) {
      rect(ctx, s.x, s.y, 12, 12, C.accent)
      rect(ctx, s.x + 4, s.y + 4, 4, 4, C.fond)
    }

    for (const b of j.e.blocs) {
      rect(ctx, b.x, b.y, b.w, b.h, C.rouge)
      rect(ctx, b.x, b.y, b.w, 4, C.accent)
    }

    const px = j.e.x - TAILLE / 2
    const py = j.H - SOL
    rect(ctx, px, py, TAILLE, TAILLE, C.cyan)
    rect(ctx, px + 6, py + 6, 12, 6, C.fond)
  },
}


/**
 * Chaque vague laisse un passage, et ce passage ne s'éloigne jamais de plus
 * de 140 px du précédent. Avant, les blocs tombaient à des abscisses tirées
 * au sort : on mourait de malchance autant que de maladresse, et une partie
 * durait trente secondes.
 */
function vague(j) {
  const largeur = Math.max(78, 120 - j.t * 0.25)
  const demi = largeur / 2
  const min = Math.max(demi + 6, j.e.passage - 140)
  const max = Math.min(j.W - demi - 6, j.e.passage + 140)
  const passage = min + Math.random() * Math.max(1, max - min)
  j.e.passage = passage

  const bords = [
    { x: 0, w: passage - demi },
    { x: passage + demi, w: j.W - (passage + demi) },
  ]
  for (const b of bords) {
    if (b.w < 14) continue
    // On découpe les longs pans : visuellement des blocs, pas un mur.
    let x = b.x
    let reste = b.w
    while (reste > 0) {
      const w = Math.min(reste, 60 + Math.random() * 90)
      j.e.blocs.push({ x: Math.round(x), y: -34, w: Math.round(w) - 2, h: 24 })
      x += w
      reste -= w
    }
  }
}
