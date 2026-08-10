import { C } from '../palette.js'
import { texte, rect } from '../dessin.js'

/**
 * Le jeu qui se gagne en ne faisant rien — pendant qu'un énorme bouton
 * te supplie d'appuyer. Aucune ligne de logique, et c'est celui qui fait
 * perdre le plus de monde.
 */
export default {
  id: 'immobile',
  consigne: 'NE TOUCHE À RIEN !',
  duree: 3.5,
  siTempsEcoule: 'gagne',

  init(g) {
    g.e.pulse = 0
  },

  maj(g, dt) {
    g.e.pulse += dt * 6
  },

  dessine(g, ctx) {
    const k = 1 + Math.sin(g.e.pulse) * 0.05
    ctx.save()
    ctx.translate(g.W / 2, g.H / 2)
    ctx.scale(k, k)
    rect(ctx, -120, -70, 240, 140, C.danger, 24)
    texte(ctx, 'APPUIE', 0, 0, 38, C.fond, 900)
    ctx.restore()
    texte(ctx, 'vraiment, appuie', g.W / 2, g.H / 2 + 130, 15, C.faible, 600)
  },

  appui(g) {
    g.perd()
  },
}
