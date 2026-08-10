import { C } from '../palette.js'
import { texte, rect, cercle, dist } from '../dessin.js'

const HAUT = 110 // zone de jeu, sous la jauge
const BAS = 60
const R_MAX = 34

export default {
  id: 'cibles',
  nom: 'CIBLES',
  pitch: 'Touche tout. Chaque touche rallonge le chrono',
  couleur: C.or,
  unite: 'pts',

  init(j) {
    j.e.jauge = 9
    j.e.cibles = []
    j.e.prochaine = 0.3
    j.e.combo = 1
    j.e.flash = 0
  },

  maj(j, dt) {
    j.e.flash = Math.max(0, j.e.flash - dt * 3)

    // Le chrono se vide de plus en plus vite : c'est la seule difficulté.
    j.e.jauge -= dt * (1 + j.t * 0.012)
    if (j.e.jauge <= 0) return j.perdu()

    const duree = Math.max(0.85, 2.2 - j.t * 0.014)
    j.e.prochaine -= dt
    if (j.e.prochaine <= 0 && j.e.cibles.length < 4) {
      j.e.prochaine = Math.max(0.35, 1 - j.t * 0.008)
      j.e.cibles.push({
        x: 40 + j.hasard() * (j.W - 80),
        y: HAUT + 40 + j.hasard() * (j.H - HAUT - BAS - 80),
        age: 0,
        duree,
      })
    }

    for (const c of j.e.cibles) c.age += dt
    const avant = j.e.cibles.length
    j.e.cibles = j.e.cibles.filter((c) => c.age < c.duree)
    // Une cible manquée casse le combo et coûte du temps.
    if (j.e.cibles.length < avant) {
      j.e.combo = 1
      j.e.jauge = Math.max(0, j.e.jauge - 0.6)
    }
  },

  dessine(j, ctx) {
    const part = Math.max(0, Math.min(j.e.jauge / 12, 1))
    rect(ctx, 24, HAUT - 26, j.W - 48, 12, C.fondClair, 6)
    rect(ctx, 24, HAUT - 26, (j.W - 48) * part, 12, part > 0.25 ? C.joueur : C.danger, 6)

    if (j.e.combo > 1) texte(ctx, `x${j.e.combo}`, j.W / 2, HAUT - 48, 20, C.or, 900)

    for (const c of j.e.cibles) {
      const reste = 1 - c.age / c.duree
      const r = 12 + R_MAX * reste
      cercle(ctx, c.x, c.y, r, C.fondClair)
      cercle(ctx, c.x, c.y, r * 0.62, reste < 0.3 ? C.danger : C.or)
    }

    if (j.e.flash > 0) {
      ctx.fillStyle = `rgba(255, 61, 110, ${j.e.flash * 0.25})`
      ctx.fillRect(0, 0, j.W, j.H)
    }
  },

  appui(j, p) {
    const i = j.e.cibles.findIndex((c) => dist(p.x, p.y, c.x, c.y) < 12 + R_MAX * (1 - c.age / c.duree))
    if (i === -1) {
      j.e.combo = 1
      j.e.jauge = Math.max(0, j.e.jauge - 0.8)
      j.e.flash = 1
      return
    }
    j.e.cibles.splice(i, 1)
    j.score += 10 * j.e.combo
    j.e.combo = Math.min(9, j.e.combo + 1)
    j.e.jauge = Math.min(12, j.e.jauge + 0.75)
  },
}
