import { C } from '../palette.js'
import { rect, cercle, borne, vers } from '../dessin.js'

const RAYON = 14
const SOL = 90 // hauteur du joueur au-dessus du bas de l'écran

export default {
  id: 'esquive',
  nom: 'ESQUIVE',
  pitch: 'Survis sous les blocs, ramasse les étoiles',
  couleur: C.joueur,
  unite: 'm',

  init(j) {
    j.e.x = j.W / 2
    j.e.blocs = []
    j.e.etoiles = []
    j.e.prochainBloc = 0.5
    j.e.prochaineEtoile = 2
  },

  maj(j, dt) {
    // Tout se durcit avec le temps : la vitesse de chute et la cadence.
    const vitesse = 180 + j.t * 11
    const cadence = Math.max(0.26, 0.8 - j.t * 0.012)

    j.e.x = vers(j.e.x, borne(j.pointer.x, RAYON, j.W - RAYON), 640 * dt)
    j.score += dt * 10

    j.e.prochainBloc -= dt
    if (j.e.prochainBloc <= 0) {
      j.e.prochainBloc = cadence * (0.7 + j.hasard() * 0.6)
      const w = 45 + j.hasard() * 95
      j.e.blocs.push({ x: j.hasard() * (j.W - w), y: -34, w, h: 26 })
    }

    j.e.prochaineEtoile -= dt
    if (j.e.prochaineEtoile <= 0) {
      j.e.prochaineEtoile = 2.4 + j.hasard() * 2.5
      j.e.etoiles.push({ x: 24 + j.hasard() * (j.W - 48), y: -20 })
    }

    for (const b of j.e.blocs) b.y += vitesse * dt
    for (const s of j.e.etoiles) s.y += vitesse * 0.85 * dt
    j.e.blocs = j.e.blocs.filter((b) => b.y < j.H + 40)

    const py = j.H - SOL
    for (const b of j.e.blocs) {
      if (cercleRect(j.e.x, py, RAYON, b.x, b.y, b.w, b.h)) return j.perdu()
    }
    j.e.etoiles = j.e.etoiles.filter((s) => {
      if (Math.hypot(s.x - j.e.x, s.y - py) < RAYON + 12) {
        j.score += 25
        return false
      }
      return s.y < j.H + 30
    })
  },

  dessine(j, ctx) {
    for (const s of j.e.etoiles) cercle(ctx, s.x, s.y, 8, C.or)
    for (const b of j.e.blocs) rect(ctx, b.x, b.y, b.w, b.h, C.danger, 7)
    cercle(ctx, j.e.x, j.H - SOL, RAYON, C.joueur)
  },
}

function cercleRect(cx, cy, r, rx, ry, rw, rh) {
  const px = borne(cx, rx, rx + rw)
  const py = borne(cy, ry, ry + rh)
  return Math.hypot(cx - px, cy - py) < r
}
