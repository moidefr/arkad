import { C } from '../palette.js'
import { cercle, dist } from '../dessin.js'

export default {
  id: 'pas-le-rouge',
  consigne: 'TOUT SAUF LE ROUGE !',
  duree: 4.5,
  siTempsEcoule: 'perd',

  init(g) {
    g.e.pastilles = []
    const total = 7
    let essais = 0
    while (g.e.pastilles.length < total && essais < 400) {
      essais++
      const r = 30
      const x = 50 + g.hasard() * (g.W - 100)
      const y = 130 + g.hasard() * (g.H - 260)
      if (g.e.pastilles.some((p) => dist(p.x, p.y, x, y) < r * 2 + 12)) continue
      g.e.pastilles.push({ x, y, r, rouge: false, prise: false })
    }
    // Deux pièges rouges tirés au sort parmi les pastilles posées.
    for (let i = 0; i < 2 && i < g.e.pastilles.length; i++) {
      let p
      do {
        p = g.e.pastilles[g.entier(0, g.e.pastilles.length)]
      } while (p.rouge)
      p.rouge = true
    }
  },

  dessine(g, ctx) {
    for (const p of g.e.pastilles) {
      if (p.prise) {
        cercle(ctx, p.x, p.y, p.r * 0.4, C.fondClair)
        continue
      }
      cercle(ctx, p.x, p.y, p.r, p.rouge ? C.danger : C.bleu)
    }
  },

  appui(g, p) {
    const cible = g.e.pastilles.find((c) => !c.prise && dist(p.x, p.y, c.x, c.y) <= c.r)
    if (!cible) return
    if (cible.rouge) return g.perd()
    cible.prise = true
    if (g.e.pastilles.every((c) => c.rouge || c.prise)) g.gagne()
  },
}
