import { C } from '../palette.js'
import { texte, rect } from '../dessin.js'

export default {
  id: 'jauge',
  consigne: 'STOP AU BON MOMENT !',
  duree: 4,
  siTempsEcoule: 'perd',

  init(g) {
    g.e.p = 0 // position du curseur, 0..1
    g.e.sens = 1
    g.e.zone = 0.15 + g.hasard() * 0.6
    g.e.largeur = 0.13
  },

  maj(g, dt) {
    g.e.p += g.e.sens * dt * 0.9
    if (g.e.p > 1) {
      g.e.p = 1
      g.e.sens = -1
    }
    if (g.e.p < 0) {
      g.e.p = 0
      g.e.sens = 1
    }
  },

  dessine(g, ctx) {
    const x = 40
    const w = g.W - 80
    const y = g.H / 2 - 22
    rect(ctx, x, y, w, 44, C.fondClair, 12)
    rect(ctx, x + g.e.zone * w, y, g.e.largeur * w, 44, C.joueur, 12)
    rect(ctx, x + g.e.p * w - 3, y - 14, 6, 72, C.texte, 3)
    texte(ctx, 'appuie dans le vert', g.W / 2, y + 110, 15, C.faible, 600)
  },

  appui(g) {
    const dans = g.e.p >= g.e.zone && g.e.p <= g.e.zone + g.e.largeur
    dans ? g.gagne() : g.perd()
  },
}
