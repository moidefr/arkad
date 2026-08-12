import { C } from '../palette.js'
import { texte, rect, pastille, bloc, lueur } from '../dessin.js'

const RAYON = 96
const TAILLE = 14

export default {
  id: 'orbite',
  nom: 'ORBITE',
  pitch: 'Appuie pour changer de sens. Évite ce qui tombe',
  couleur: C.rouge,
  unite: 'pts',
  ciel: C.violet,
  vies: 3,

  init(j) {
    j.e.cx = j.W / 2
    j.e.cy = (j.HUD + j.H) / 2
    j.e.ang = -Math.PI / 2
    j.e.sens = 1
    j.e.obs = []
    j.e.prochain = 0.8
  },

  maj(j, dt) {
    const { cx, cy } = j.e
    const vitesse = 2 + j.t * 0.018
    j.e.ang += j.e.sens * vitesse * dt

    j.e.prochain -= dt
    if (j.e.prochain <= 0) {
      j.e.prochain = Math.max(0.44, 1.05 - j.t * 0.010)
      j.e.obs.push({ a: Math.random() * Math.PI * 2, r: 300, v: 90 + Math.random() * 40 })
    }

    for (const o of j.e.obs) o.r -= (o.v + j.t * 2) * dt

    const restants = []
    for (const o of j.e.obs) {
      // La collision ne se teste qu'au moment où l'obstacle croise l'orbite.
      if (Math.abs(o.r - RAYON) < 12) {
        const d = o.a - j.e.ang
        // atan2 ramène l'écart d'angle dans [-pi, pi] sans se soucier des tours.
        if (Math.abs(Math.atan2(Math.sin(d), Math.cos(d))) < 0.2) return j.perdu()
      }
      if (o.r < 26) {
        j.score += 10
        j.fx.eclat(cx + Math.cos(o.a) * o.r, cy + Math.sin(o.a) * o.r, C.bord, {
          n: 6,
          vitesse: 90,
          gravite: 0,
        })
        continue
      }
      restants.push(o)
    }
    j.e.obs = restants
  },

  dessine(j, ctx) {
    const { cx, cy } = j.e

    // L'orbite, en pointillés : le joueur doit voir sa trajectoire.
    for (let k = 0; k < 48; k++) {
      const a = (k / 48) * Math.PI * 2
      rect(ctx, cx + Math.cos(a) * RAYON - 1, cy + Math.sin(a) * RAYON - 1, 2, 2, C.bord)
    }
    pastille(ctx, cx, cy, 20, C.panneau)
    texte(ctx, j.e.sens > 0 ? '>' : '<', cx, cy, 16, C.faible, 700)

    for (const o of j.e.obs) {
      const x = cx + Math.cos(o.a) * o.r
      const y = cy + Math.sin(o.a) * o.r
      const proche = Math.abs(o.r - RAYON) < 40
      if (proche) lueur(ctx, x - 7, y - 7, 14, 14, C.rouge, 2)
      bloc(ctx, x - 7, y - 7, 14, 14, proche ? C.rouge : C.bord, 2)
    }

    const px = cx + Math.cos(j.e.ang) * RAYON
    const py = cy + Math.sin(j.e.ang) * RAYON
    lueur(ctx, px - TAILLE / 2, py - TAILLE / 2, TAILLE, TAILLE, C.accent, 3)
    bloc(ctx, px - TAILLE / 2, py - TAILLE / 2, TAILLE, TAILLE, C.accent, 3)

    if (j.t < 3) texte(ctx, 'appuie pour inverser', j.W / 2, j.H - 50, 13, C.faible, 700)
  },

  appui(j) {
    j.e.sens *= -1
    j.son.rebond()
  },
}
