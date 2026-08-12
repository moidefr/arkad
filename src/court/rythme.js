import { C } from '../palette.js'
import { texte, rect, cadre } from '../dessin.js'

const LIGNE = 500 // hauteur de la ligne de frappe
const TOLERANCE = 30 // fenêtre en pixels autour de la ligne
const NOTE_H = 16

export default {
  id: 'rythme',
  nom: 'RYTHME',
  pitch: 'Appuie du bon côté quand la note passe la ligne',
  couleur: C.accent,
  unite: 'pts',

  init(j) {
    j.e.notes = []
    j.e.vies = 3
    j.e.combo = 1
    j.e.prochaine = 1
    j.e.eclat = [0, 0]
  },

  maj(j, dt) {
    const vitesse = 190 + j.t * 2.4
    j.e.eclat = j.e.eclat.map((v) => Math.max(0, v - dt * 4))

    j.e.prochaine -= dt
    if (j.e.prochaine <= 0) {
      // La cadence se resserre, mais on garde toujours de quoi réagir.
      j.e.prochaine = Math.max(0.42, 1 - j.t * 0.008)
      j.e.notes.push({ voie: Math.random() < 0.5 ? 0 : 1, y: j.HUD - 20 })
    }

    for (const n of j.e.notes) n.y += vitesse * dt

    const passees = j.e.notes.filter((n) => n.y > LIGNE + TOLERANCE)
    if (passees.length) {
      j.e.notes = j.e.notes.filter((n) => n.y <= LIGNE + TOLERANCE)
      j.e.combo = 1
      j.e.vies -= passees.length
      j.son.rate()
      if (j.e.vies <= 0) return j.perdu()
    }
  },

  dessine(j, ctx) {
    for (const v of [0, 1]) {
      const x = v * (j.W / 2)
      rect(ctx, x + 4, j.HUD, j.W / 2 - 8, LIGNE + 60 - j.HUD, C.panneau)
      if (j.e.eclat[v] > 0) rect(ctx, x + 4, LIGNE - 26, j.W / 2 - 8, 52, C.bord)
    }

    // La ligne de frappe : le seul repère du jeu.
    rect(ctx, 0, LIGNE - 2, j.W, 4, C.accent)
    cadre(ctx, 4, LIGNE - TOLERANCE, j.W - 8, TOLERANCE * 2, C.bord)

    for (const n of j.e.notes) {
      const x = n.voie * (j.W / 2) + 16
      const w = j.W / 2 - 32
      const bon = Math.abs(n.y - LIGNE) <= TOLERANCE
      rect(ctx, x, n.y - NOTE_H / 2, w, NOTE_H, bon ? C.accent : C.cyan)
    }

    texte(ctx, '< >', j.W / 2, LIGNE + 92, 14, C.faible, 700)
    ctx.textAlign = 'left'
    for (let i = 0; i < j.e.vies; i++) rect(ctx, 16 + i * 14, j.H - 24, 8, 8, C.rouge)
    ctx.textAlign = 'right'
    if (j.e.combo > 1) texte(ctx, `x${j.e.combo}`, j.W - 16, j.H - 20, 14, C.accent, 700)
    ctx.textAlign = 'center'
  },

  appui(j, p) {
    const voie = p.x < j.W / 2 ? 0 : 1
    j.e.eclat[voie] = 1

    const i = j.e.notes.findIndex((n) => n.voie === voie && Math.abs(n.y - LIGNE) <= TOLERANCE)
    if (i === -1) {
      j.e.combo = 1
      j.son.rate()
      return
    }

    // Plus on tape près de la ligne, plus ça rapporte.
    const ecart = Math.abs(j.e.notes[i].y - LIGNE)
    j.e.notes.splice(i, 1)
    const gain = (ecart < 10 ? 20 : 10) * j.e.combo
    j.score += gain
    const cx = voie * (j.W / 2) + j.W / 4
    j.fx.eclat(cx, LIGNE, ecart < 10 ? C.accent : C.cyan, { n: 12, vitesse: 160, taille: 5 })
    j.fx.bulle(cx, LIGNE - 30, (ecart < 10 ? 'PARFAIT +' : '+') + gain, C.accent, 14)
    j.e.combo = Math.min(9, j.e.combo + 1)
    j.son.touche(j.e.combo)
  },
}
