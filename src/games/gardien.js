import { C } from '../palette.js'
import { texte, rect, cadre } from '../dessin.js'

const VOIES = 3
const BUT_Y = 500
const BUT_H = 70
const GARDIEN_W = 62
const BALLE = 16

export default {
  id: 'gardien',
  nom: 'GARDIEN',
  pitch: 'Plonge du bon côté avant que le tir arrive',
  couleur: C.vert,
  unite: 'arrêts',

  init(j) {
    j.e.voie = 1
    j.e.tirs = []
    j.e.vies = 3
    j.e.prochain = 0.9
    j.e.eclat = 0
  },

  maj(j, dt) {
    j.e.eclat = Math.max(0, j.e.eclat - dt * 3)

    j.e.prochain -= dt
    if (j.e.prochain <= 0) {
      j.e.prochain = Math.max(0.55, 1.5 - j.t * 0.02)
      j.e.tirs.push({ voie: Math.floor(Math.random() * VOIES), y: j.HUD, v: 150 + j.t * 5 })
    }

    for (const t of j.e.tirs) t.y += t.v * dt

    const arrives = j.e.tirs.filter((t) => t.y >= BUT_Y)
    if (!arrives.length) return
    j.e.tirs = j.e.tirs.filter((t) => t.y < BUT_Y)

    for (const t of arrives) {
      if (t.voie === j.e.voie) {
        j.score += 1
        j.e.eclat = 1
        j.son.touche(Math.min(9, 1 + Math.floor(j.score / 3)))
      } else {
        j.e.vies--
        j.son.rate()
      }
    }
    if (j.e.vies <= 0) j.perdu()
  },

  dessine(j, ctx) {
    const largeurVoie = j.W / VOIES

    for (let v = 0; v < VOIES; v++) {
      rect(ctx, v * largeurVoie + 2, j.HUD, largeurVoie - 4, BUT_Y - j.HUD, C.panneau)
    }

    // Le but, en bas : c'est le repère qui rend les trois voies lisibles.
    cadre(ctx, 8, BUT_Y, j.W - 16, BUT_H, C.bord)
    for (let v = 1; v < VOIES; v++) rect(ctx, v * largeurVoie - 1, BUT_Y, 2, BUT_H, C.bord)

    for (const t of j.e.tirs) {
      const x = t.voie * largeurVoie + largeurVoie / 2
      rect(ctx, x - BALLE / 2, t.y - BALLE / 2, BALLE, BALLE, C.texte)
    }

    const gx = j.e.voie * largeurVoie + largeurVoie / 2
    rect(ctx, gx - GARDIEN_W / 2, BUT_Y + 14, GARDIEN_W, 42, j.e.eclat > 0 ? C.accent : C.vert)
    rect(ctx, gx - 22, BUT_Y + 22, 10, 10, C.fond)
    rect(ctx, gx + 12, BUT_Y + 22, 10, 10, C.fond)

    ctx.textAlign = 'left'
    for (let i = 0; i < j.e.vies; i++) rect(ctx, 16 + i * 14, j.H - 26, 8, 8, C.rouge)
    ctx.textAlign = 'center'
    texte(ctx, 'appuie à gauche ou à droite', j.W / 2, j.H - 22, 11, C.faible, 700)
  },

  appui(j, p) {
    const avant = j.e.voie
    j.e.voie = Math.max(0, Math.min(VOIES - 1, j.e.voie + (p.x < j.W / 2 ? -1 : 1)))
    if (j.e.voie !== avant) j.son.rebond()
  },
}
