import { C } from '../palette.js'
import { texte, rect, bloc, lueur } from '../dessin.js'

const TAILLE = 18
const Y_JOUEUR = 520
const MUR_H = 16

export default {
  id: 'slalom',
  nom: 'SLALOM',
  pitch: 'Appuie pour changer de direction. Vise les portes',
  couleur: C.cyan,
  unite: 'portes',
  ciel: C.cyan,
  vies: 3,

  init(j) {
    j.e.x = j.W / 2
    j.e.dir = 1
    j.e.murs = []
    j.e.prochain = 0
    j.e.trace = []
  },

  maj(j, dt) {
    const descente = 145 + j.t * 2.6
    const lateral = 128 + j.t * 1.3

    j.e.x += j.e.dir * lateral * dt
    // On rebondit sur les bords plutôt que de s'y coller : rester bloqué
    // contre un mur invisible est la pire sensation possible.
    if (j.e.x < TAILLE / 2) ((j.e.x = TAILLE / 2), (j.e.dir = 1))
    if (j.e.x > j.W - TAILLE / 2) ((j.e.x = j.W - TAILLE / 2), (j.e.dir = -1))

    // La trace ne garde que les positions passées : dessinée sous le joueur,
    // elle donne à voir le zigzag qu'on vient de faire.
    j.e.trace.unshift(j.e.x)
    if (j.e.trace.length > 26) j.e.trace.pop()

    j.e.prochain -= dt
    if (j.e.prochain <= 0) {
      j.e.prochain = Math.max(0.72, 1.45 - j.t * 0.01)
      const largeur = Math.max(64, 120 - j.t * 0.62)
      j.e.murs.push({ y: j.HUD - MUR_H, trou: 30 + Math.random() * (j.W - 60 - largeur), largeur })
    }

    for (const m of j.e.murs) {
      const avant = m.y
      m.y += descente * dt
      // La porte se franchit pile au moment où le mur croise le joueur.
      if (avant <= Y_JOUEUR && m.y > Y_JOUEUR) {
        if (j.e.x < m.trou || j.e.x > m.trou + m.largeur) {
          j.son.rate()
          return j.perdu()
        }
        j.score += 1
        j.son.touche(Math.min(9, 1 + Math.floor(j.score / 4)))
        j.fx.eclat(m.trou, Y_JOUEUR, C.cyan, { n: 5, vitesse: 90, gravite: 0, duree: 0.3 })
        j.fx.eclat(m.trou + m.largeur, Y_JOUEUR, C.cyan, { n: 5, vitesse: 90, gravite: 0, duree: 0.3 })
      }
    }
    j.e.murs = j.e.murs.filter((m) => m.y < j.H + 40)
  },

  dessine(j, ctx) {
    for (const m of j.e.murs) {
      bloc(ctx, 0, m.y, m.trou, MUR_H, C.bord, 2)
      bloc(ctx, m.trou + m.largeur, m.y, j.W - m.trou - m.largeur, MUR_H, C.bord, 2)
      lueur(ctx, m.trou - 5, m.y, 5, MUR_H, C.cyan, 2, 0.8)
      bloc(ctx, m.trou - 5, m.y, 5, MUR_H, C.cyan, 2)
      lueur(ctx, m.trou + m.largeur, m.y, 5, MUR_H, C.cyan, 2, 0.8)
      bloc(ctx, m.trou + m.largeur, m.y, 5, MUR_H, C.cyan, 2)
    }

    j.e.trace.forEach((x, i) => {
      if (i % 2) return
      rect(ctx, x - 2, Y_JOUEUR + i * 4, 4, 4, i < 12 ? C.bord : C.panneau)
    })

    lueur(ctx, j.e.x - TAILLE / 2, Y_JOUEUR - TAILLE / 2, TAILLE, TAILLE, C.accent, 3)
    bloc(ctx, j.e.x - TAILLE / 2, Y_JOUEUR - TAILLE / 2, TAILLE, TAILLE, C.accent, 3)
    rect(ctx, j.e.x - 2 + j.e.dir * 6, Y_JOUEUR - 2, 4, 4, C.fond)

    if (j.t < 3) texte(ctx, 'appuie pour zigzaguer', j.W / 2, j.H - 40, 13, C.faible, 700)
  },

  appui(j) {
    j.e.dir *= -1
    j.son.rebond()
    j.fx.jet(j.e.x, Y_JOUEUR + 8, C.bord, { angle: Math.PI / 2, ouverture: 1.6, n: 4, vitesse: 70, duree: 0.25 })
  },
}
