import { C } from '../palette.js'
import { texte, rect } from '../dessin.js'

const BASE_Y = 500
const LONGUEUR = 190
const LIMITE = 0.62 // radians : au-delà, le mât est tombé
const POUSSEE = 0.95

export default {
  id: 'balance',
  nom: 'BALANCE',
  pitch: 'Le mât penche. Appuie du côté qui le redresse',
  couleur: C.accent,
  unite: 'pts',

  init(j) {
    j.e.angle = 0.05 * (Math.random() < 0.5 ? -1 : 1)
    j.e.vitesse = 0
    j.e.eclat = 0
  },

  maj(j, dt) {
    j.e.eclat = Math.max(0, j.e.eclat - dt * 4)

    // Pendule inversé : plus il penche, plus il tombe vite. C'est instable
    // par construction, et c'est tout l'intérêt.
    j.e.vitesse += Math.sin(j.e.angle) * 5.8 * dt
    // Une bourrasque, de plus en plus forte : sans elle, un joueur appliqué
    // tiendrait indéfiniment.
    j.e.vitesse += (Math.random() * 2 - 1) * (0.5 + j.t * 0.03) * dt

    j.e.angle += j.e.vitesse * dt
    if (Math.abs(j.e.angle) > LIMITE) {
      j.son.rate()
      return j.perdu()
    }

    j.score += dt * 10
  },

  dessine(j, ctx) {
    const cx = j.W / 2
    rect(ctx, 0, BASE_Y, j.W, 4, C.bord)
    rect(ctx, cx - 26, BASE_Y - 12, 52, 12, C.faible)

    // Le mât, tracé en gros pixels le long de son axe.
    const dx = Math.sin(j.e.angle)
    const dy = -Math.cos(j.e.angle)
    const chaud = Math.abs(j.e.angle) > LIMITE * 0.66
    for (let k = 0; k <= 22; k++) {
      const d = (k / 22) * LONGUEUR
      rect(ctx, cx + dx * d - 3, BASE_Y - 12 + dy * d - 3, 6, 6, chaud ? C.rouge : C.texte)
    }
    const bx = cx + dx * LONGUEUR
    const by = BASE_Y - 12 + dy * LONGUEUR
    rect(ctx, bx - 9, by - 9, 18, 18, j.e.eclat > 0 ? C.accent : chaud ? C.rouge : C.cyan)

    // Inclinomètre : on voit venir la chute avant de la sentir.
    const part = j.e.angle / LIMITE
    rect(ctx, 60, j.H - 60, 240, 10, C.panneau)
    rect(ctx, 60 + 120 - 2, j.H - 66, 4, 22, C.bord)
    rect(ctx, 60 + 120 + part * 118 - 5, j.H - 62, 10, 14, chaud ? C.rouge : C.accent)

    texte(ctx, 'appuie du côté opposé à la chute', j.W / 2, j.H - 26, 13, C.faible, 700)
  },

  appui(j, p) {
    const sens = p.x < j.W / 2 ? -1 : 1
    j.e.vitesse += sens * POUSSEE
    j.e.eclat = 1
    j.son.rebond()
    j.fx.jet(j.W / 2 - sens * 26, BASE_Y - 14, C.accent, {
      angle: sens > 0 ? Math.PI : 0,
      ouverture: 1,
      n: 5,
      vitesse: 130,
      gravite: 220,
      duree: 0.3,
    })
  },
}
