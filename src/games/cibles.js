import { C } from '../palette.js'
import { texte, rect, cadre, trame } from '../dessin.js'

const HAUT = 116 // zone de jeu, sous la jauge
const BAS = 60
const R_MAX = 34
const SEGMENTS = 24

export default {
  id: 'cibles',
  nom: 'CIBLES',
  pitch: 'Touche tout. Chaque touche rallonge le chrono',
  couleur: C.accent,
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
      j.son.rate()
    }
  },

  dessine(j, ctx) {
    trame(ctx, 0, HAUT, j.W, j.H - HAUT, 16, C.panneau)

    // Chrono en segments : plus lisible qu'une barre continue, et plus dans
    // le ton de la borne.
    const part = Math.max(0, Math.min(j.e.jauge / 12, 1))
    const pleins = Math.round(part * SEGMENTS)
    for (let i = 0; i < SEGMENTS; i++) {
      const couleur = i < pleins ? (part > 0.25 ? C.accent : C.rouge) : C.bord
      rect(ctx, 22 + i * 13, HAUT - 30, 9, 12, couleur)
    }
    ctx.textAlign = 'left'
    texte(ctx, 'CHRONO', 22, HAUT - 46, 10, C.faible, 700)
    ctx.textAlign = 'right'
    if (j.e.combo > 1) texte(ctx, `COMBO x${j.e.combo}`, j.W - 22, HAUT - 46, 12, C.accent, 700)
    ctx.textAlign = 'center'

    // Cible : des carrés concentriques, pas des cercles — même grammaire que
    // le reste de l'écran.
    for (const c of j.e.cibles) {
      const reste = 1 - c.age / c.duree
      const r = 12 + R_MAX * reste
      const chaud = reste < 0.3
      cadre(ctx, c.x - r, c.y - r, r * 2, r * 2, chaud ? C.rouge : C.faible)
      rect(ctx, c.x - r * 0.6, c.y - r * 0.6, r * 1.2, r * 1.2, chaud ? C.rouge : C.accent)
      rect(ctx, c.x - 4, c.y - 4, 8, 8, C.fond)
    }

    if (j.e.flash > 0) {
      ctx.fillStyle = `rgba(255, 95, 86, ${j.e.flash * 0.22})`
      ctx.fillRect(0, 0, j.W, j.H)
    }
  },

  appui(j, p) {
    const i = j.e.cibles.findIndex((c) => {
      const r = 12 + R_MAX * (1 - c.age / c.duree)
      return Math.abs(p.x - c.x) <= r && Math.abs(p.y - c.y) <= r
    })
    if (i === -1) {
      j.e.combo = 1
      j.e.jauge = Math.max(0, j.e.jauge - 0.8)
      j.e.flash = 1
      j.son.rate()
      return
    }
    j.e.cibles.splice(i, 1)
    j.score += 10 * j.e.combo
    j.son.touche(j.e.combo)
    j.e.combo = Math.min(9, j.e.combo + 1)
    j.e.jauge = Math.min(12, j.e.jauge + 0.75)
  },
}
