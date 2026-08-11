import { C } from '../palette.js'
import { texte, rect } from '../dessin.js'

const G = 190
const POUSSEE = 430
const VX = 64 // dérive horizontale : c'est elle qui rend le posé difficile
const SOL = 70
const LARGE = 16
const HAUT = 22
const VITESSE_MAX = 95 // au-delà, c'est un crash

export default {
  id: 'fusee',
  nom: 'FUSÉE',
  pitch: 'Maintiens pour freiner. Pose-toi en douceur',
  couleur: C.rouge,
  unite: 'pts',

  init(j) {
    j.e.poses = 0
    j.e.piste = { x: j.W / 2 - 60, w: 120 }
    depart(j)
  },

  maj(j, dt) {
    const sol = j.H - SOL

    j.e.x += VX * dt
    if (j.e.x > j.W) j.e.x -= j.W

    if (j.maintenu && j.e.carburant > 0) {
      j.e.vy -= POUSSEE * dt
      j.e.carburant = Math.max(0, j.e.carburant - dt * 0.3)
    } else {
      j.e.vy += G * dt
    }
    j.e.y += j.e.vy * dt

    if (j.e.y < j.HUD + 20) (j.e.y = j.HUD + 20), (j.e.vy = 0)

    if (j.e.y + HAUT / 2 >= sol) {
      const centre = j.e.x
      const dedans = centre > j.e.piste.x && centre < j.e.piste.x + j.e.piste.w
      if (dedans && j.e.vy < VITESSE_MAX) {
        j.e.poses++
        // Le carburant qui reste est une prime : ça récompense les descentes
        // franches plutôt que les longues hésitations.
        j.score += 50 + Math.round(j.e.carburant * 50)
        j.son.niveau()
        j.e.piste.w = Math.max(46, j.e.piste.w - 12)
        j.e.piste.x = 20 + Math.random() * (j.W - 40 - j.e.piste.w)
        depart(j)
        return
      }
      j.son.rate()
      return j.perdu()
    }
  },

  dessine(j, ctx) {
    const sol = j.H - SOL
    rect(ctx, 0, sol, j.W, j.H - sol, C.bord)
    rect(ctx, j.e.piste.x, sol - 4, j.e.piste.w, 6, C.accent)
    for (let i = 0; i < j.e.piste.w; i += 12) rect(ctx, j.e.piste.x + i, sol + 6, 6, 3, C.accent)

    const x = j.e.x - LARGE / 2
    const y = j.e.y - HAUT / 2
    const vite = j.e.vy >= VITESSE_MAX
    rect(ctx, x, y, LARGE, HAUT, vite ? C.rouge : C.texte)
    rect(ctx, x + 4, y + 4, 8, 6, C.fond)
    if (j.maintenu && j.e.carburant > 0) {
      rect(ctx, x + 4, y + HAUT, 8, 8 + Math.random() * 8, C.accent)
    }

    // Jauge de carburant, en segments comme partout ailleurs.
    for (let i = 0; i < 16; i++) {
      rect(ctx, 16 + i * 12, j.H - 26, 8, 10, i / 16 < j.e.carburant ? C.cyan : C.bord)
    }
    ctx.textAlign = 'right'
    texte(ctx, `${Math.round(j.e.vy)}`, j.W - 16, j.HUD + 20, 13, vite ? C.rouge : C.faible, 700)
    ctx.textAlign = 'left'
    texte(ctx, `posés ${j.e.poses}`, 16, j.HUD + 20, 12, C.faible, 700)
    ctx.textAlign = 'center'
  },
}

function depart(j) {
  j.e.x = Math.random() * j.W
  j.e.y = j.HUD + 60
  j.e.vy = 0
  j.e.carburant = 1
}
