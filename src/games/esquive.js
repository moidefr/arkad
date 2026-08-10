import { C } from '../palette.js'
import { rect, vers } from '../dessin.js'

export default {
  id: 'esquive',
  consigne: 'ESQUIVE !',
  duree: 4,
  siTempsEcoule: 'gagne',

  init(g) {
    g.e.x = g.W / 2
    g.e.cible = g.W / 2
    g.e.blocs = []
    g.e.prochain = 0.2
  },

  maj(g, dt) {
    g.e.x = vers(g.e.x, g.e.cible, 460 * dt)

    g.e.prochain -= dt
    if (g.e.prochain <= 0) {
      g.e.prochain = 0.3 + g.hasard() * 0.25
      const w = 40 + g.hasard() * 70
      g.e.blocs.push({ x: g.hasard() * (g.W - w), y: -40, w, vy: 300 + g.hasard() * 180 })
    }

    for (const b of g.e.blocs) b.y += b.vy * dt
    g.e.blocs = g.e.blocs.filter((b) => b.y < g.H + 60)

    const px = g.e.x - 16
    const py = g.H - 100
    for (const b of g.e.blocs) {
      if (b.y + 28 > py && b.y < py + 32 && b.x < px + 32 && b.x + b.w > px) g.perd()
    }
  },

  dessine(g, ctx) {
    for (const b of g.e.blocs) rect(ctx, b.x, b.y, b.w, 28, C.danger, 6)
    rect(ctx, g.e.x - 16, g.H - 100, 32, 32, C.joueur, 8)
  },

  appui(g, p) {
    g.e.cible = Math.max(20, Math.min(g.W - 20, p.x))
  },
}
