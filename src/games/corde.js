import { C } from '../palette.js'
import { texte, rect } from '../dessin.js'

const SOL = 470
const TAILLE = 26
const SAUT = 0.44 // durée d'un saut, en secondes
const HAUTEUR = 46

export default {
  id: 'corde',
  nom: 'CORDE',
  pitch: 'Saute quand la corde passe sous tes pieds',
  couleur: C.vert,
  unite: 'sauts',

  init(j) {
    j.e.phase = 0
    j.e.cadence = 0.72 // tours par seconde
    j.e.saut = 0
    j.e.eclat = 0
  },

  maj(j, dt) {
    j.e.saut = Math.max(0, j.e.saut - dt)
    j.e.eclat = Math.max(0, j.e.eclat - dt * 3)

    const avant = j.e.phase
    j.e.phase += j.e.cadence * dt

    // Le tour se boucle quand la corde touche le sol : c'est le seul instant
    // qui compte de toute la partie.
    if (Math.floor(j.e.phase) > Math.floor(avant)) {
      if (j.e.saut <= 0) {
        j.son.rate()
        return j.perdu()
      }
      j.score += 1
      j.e.cadence = Math.min(1.9, j.e.cadence + 0.035)
      j.e.eclat = 1
      j.son.touche(Math.min(9, 1 + Math.floor(j.score / 3)))
    }
  },

  dessine(j, ctx) {
    const cx = j.W / 2
    rect(ctx, 0, SOL, j.W, 4, C.bord)

    // La corde tourne dans un plan vu de côté : une ellipse de points, et un
    // repère plus vif à l'endroit où elle se trouve vraiment.
    const a = j.e.phase * Math.PI * 2
    for (let k = 0; k < 40; k++) {
      const t = (k / 40) * Math.PI * 2
      rect(ctx, cx + Math.sin(t) * 120 - 1, SOL - 80 - Math.cos(t) * 80 - 1, 2, 2, C.panneau)
    }
    const rx = cx + Math.sin(a) * 120
    const ry = SOL - 80 - Math.cos(a) * 80
    rect(ctx, rx - 5, ry - 5, 10, 10, C.accent)
    // Le brin, tracé en pointillés entre les mains et la corde.
    for (let k = 1; k < 9; k++) {
      rect(ctx, cx + ((rx - cx) * k) / 9 - 1, SOL - 80 + ((ry - (SOL - 80)) * k) / 9 - 1, 2, 2, C.faible)
    }

    const monte = j.e.saut > 0 ? Math.sin((1 - j.e.saut / SAUT) * Math.PI) * HAUTEUR : 0
    const y = SOL - TAILLE - monte
    rect(ctx, cx - TAILLE / 2, y, TAILLE, TAILLE, j.e.eclat > 0 ? C.accent : C.vert)
    rect(ctx, cx - 7, y + 7, 4, 5, C.fond)
    rect(ctx, cx + 3, y + 7, 4, 5, C.fond)

    if (j.t < 4) texte(ctx, 'appuie pour sauter', j.W / 2, j.H - 60, 12, C.faible, 700)
  },

  appui(j) {
    if (j.e.saut > 0) return
    j.e.saut = SAUT
    j.son.rebond()
  },
}
