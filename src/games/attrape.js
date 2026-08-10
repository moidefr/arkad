import { C } from '../palette.js'
import { cercle, dist } from '../dessin.js'

export default {
  id: 'attrape',
  consigne: 'ATTRAPE !',
  duree: 3.5,
  siTempsEcoule: 'perd',

  init(g) {
    g.e.x = 60 + g.hasard() * (g.W - 120)
    g.e.y = 160 + g.hasard() * (g.H - 320)
    g.e.vx = (g.hasard() < 0.5 ? -1 : 1) * (140 + g.hasard() * 120)
    g.e.vy = (g.hasard() < 0.5 ? -1 : 1) * (140 + g.hasard() * 120)
    g.e.r = 46
  },

  maj(g, dt) {
    // La cible rétrécit : rater coûte du temps, et le temps coûte de la taille.
    g.e.r = Math.max(16, 46 - (g.t / g.duree) * 26)
    g.e.x += g.e.vx * dt
    g.e.y += g.e.vy * dt
    if (g.e.x < g.e.r || g.e.x > g.W - g.e.r) g.e.vx *= -1
    if (g.e.y < 80 + g.e.r || g.e.y > g.H - 80 - g.e.r) g.e.vy *= -1
  },

  dessine(g, ctx) {
    cercle(ctx, g.e.x, g.e.y, g.e.r + 6, C.fondClair)
    cercle(ctx, g.e.x, g.e.y, g.e.r, C.or)
  },

  appui(g, p) {
    if (dist(p.x, p.y, g.e.x, g.e.y) <= g.e.r) g.gagne()
  },
}
