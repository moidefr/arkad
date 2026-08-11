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

  init(j) {
    j.e.x = j.W / 2
    j.e.blocs = []
    j.e.etoiles = []
    j.e.filantes = Array.from({ length: 18 }, () => ({
      x: j.hasard() * j.W,
      y: j.hasard() * j.H,
      v: 200 + j.hasard() * 300,
    }))
    j.e.prochainBloc = 0.5
    j.e.prochaineEtoile = 2
  },

  maj(j, dt) {
    // Tout se durcit avec le temps : vitesse de chute et cadence.
    const vitesse = 180 + j.t * 11
    const cadence = Math.max(0.26, 0.8 - j.t * 0.012)

    j.e.x = vers(j.e.x, borne(j.pointer.x, TAILLE / 2, j.W - TAILLE / 2), 640 * dt)
    j.score += dt * 10

    for (const f of j.e.filantes) {
      f.y += (f.v + vitesse) * dt
      if (f.y > j.H) (f.y = j.HUD - 20), (f.x = j.hasard() * j.W)
    }

    j.e.prochainBloc -= dt
    if (j.e.prochainBloc <= 0) {
      j.e.prochainBloc = cadence * (0.7 + j.hasard() * 0.6)
      const w = 44 + Math.floor(j.hasard() * 5) * 24
      j.e.blocs.push({ x: Math.floor((j.hasard() * (j.W - w)) / 4) * 4, y: -34, w, h: 24 })
    }

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
