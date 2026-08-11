import { C } from '../palette.js'
import { texte, rect, cadre } from '../dessin.js'

const BAC_Y = 512
const BAC_H = 60
const TAILLE = 30
const GAUCHE = C.cyan
const DROITE = C.violet

export default {
  id: 'tri',
  nom: 'TRI',
  pitch: 'Envoie chaque bloc dans le bac de sa couleur',
  couleur: C.cyan,
  unite: 'pts',

  init(j) {
    j.e.objets = []
    j.e.vies = 3
    j.e.prochain = 0.5
    j.e.flash = 0
  },

  maj(j, dt) {
    j.e.flash = Math.max(0, j.e.flash - dt * 3)
    const vitesse = 90 + j.t * 3.4

    j.e.prochain -= dt
    if (j.e.prochain <= 0) {
      j.e.prochain = Math.max(0.7, 1.7 - j.t * 0.02)
      j.e.objets.push({ x: j.W / 2, y: j.HUD, gauche: Math.random() < 0.5 })
    }

    for (const o of j.e.objets) o.y += vitesse * dt

    // Un objet qui touche le sol sans avoir été trié coûte une vie.
    const tombes = j.e.objets.filter((o) => o.y > BAC_Y)
    if (tombes.length) {
      j.e.objets = j.e.objets.filter((o) => o.y <= BAC_Y)
      j.e.vies -= tombes.length
      j.e.flash = 1
      j.son.rate()
      if (j.e.vies <= 0) return j.perdu()
    }
  },

  dessine(j, ctx) {
    for (const [i, couleur] of [GAUCHE, DROITE].entries()) {
      const x = i === 0 ? 16 : j.W / 2 + 8
      const w = j.W / 2 - 24
      rect(ctx, x, BAC_Y, w, BAC_H, C.panneau)
      cadre(ctx, x, BAC_Y, w, BAC_H, couleur)
      rect(ctx, x + w / 2 - 14, BAC_Y + BAC_H / 2 - 8, 28, 16, couleur)
    }

    for (const o of j.e.objets) {
      const couleur = o.gauche ? GAUCHE : DROITE
      rect(ctx, o.x - TAILLE / 2, o.y - TAILLE / 2, TAILLE, TAILLE, couleur)
      rect(ctx, o.x - 6, o.y - 6, 12, 12, C.fond)
    }

    ctx.textAlign = 'left'
    for (let i = 0; i < j.e.vies; i++) rect(ctx, 16 + i * 14, j.H - 22, 8, 8, C.rouge)
    ctx.textAlign = 'center'
    texte(ctx, 'appuie du côté du bon bac', j.W / 2, j.H - 18, 13, C.faible, 700)

    if (j.e.flash > 0) {
      ctx.fillStyle = `rgba(255, 95, 86, ${j.e.flash * 0.22})`
      ctx.fillRect(0, 0, j.W, j.H)
    }
  },

  appui(j, p) {
    // On trie toujours l'objet le plus bas : c'est le plus urgent, et ça
    // évite d'avoir à viser.
    if (!j.e.objets.length) return
    const o = j.e.objets.reduce((a, b) => (b.y > a.y ? b : a))
    const versGauche = p.x < j.W / 2

    j.e.objets.splice(j.e.objets.indexOf(o), 1)

    if (versGauche === o.gauche) {
      j.score += 10
      j.son.ramasse()
      const bx = versGauche ? j.W / 4 : (j.W * 3) / 4
      j.fx.eclat(bx, BAC_Y + BAC_H / 2, versGauche ? GAUCHE : DROITE, { n: 10, vitesse: 130 })
      j.fx.bulle(bx, BAC_Y - 10, '+10', C.accent, 14)
      return
    }
    j.e.vies--
    j.e.flash = 1
    j.son.rate()
    j.fx.secoue(6)
    if (j.e.vies <= 0) j.perdu()
  },
}
