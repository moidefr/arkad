import { C } from '../palette.js'
import { texte, cercle } from '../dessin.js'

/**
 * Le seul jeu qui utilise le relâchement : on maintient pour gonfler, on
 * lâche dans la bonne fenêtre. Une pression trop longue et ça éclate.
 */
export default {
  id: 'gonfle',
  consigne: 'GONFLE !',
  duree: 4,
  siTempsEcoule: 'perd',

  init(g) {
    g.e.r = 18
    g.e.min = 78 + g.hasard() * 20
    g.e.max = g.e.min + 22
    g.e.limite = g.e.max + 26
  },

  maj(g, dt) {
    if (g.maintenu) g.e.r += 62 * dt
    if (g.e.r > g.e.limite) g.perd()
  },

  dessine(g, ctx) {
    const cx = g.W / 2
    const cy = g.H / 2
    cercle(ctx, cx, cy, g.e.r, g.e.r > g.e.max ? C.danger : C.violet)
    // L'anneau cible reste visible par-dessus le ballon : c'est la seule
    // information dont le joueur a besoin pour viser.
    ctx.strokeStyle = C.joueur
    ctx.lineWidth = 3
    for (const r of [g.e.min, g.e.max]) {
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.stroke()
    }
    texte(ctx, 'maintiens, puis lâche dans l’anneau', cx, g.H - 90, 14, C.faible, 600)
  },

  relache(g) {
    g.e.r >= g.e.min && g.e.r <= g.e.max ? g.gagne() : g.perd()
  },
}
