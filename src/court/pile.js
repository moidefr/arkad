import { C } from '../palette.js'
import { texte, rect, bloc, lueur } from '../dessin.js'

const BLOC_H = 22
const BASE_Y = 520 // hauteur du sommet de la pile à l'écran, fixe
const TEINTES = [C.cyan, C.vert, C.violet, C.accent, C.rouge]

export default {
  id: 'pile',
  nom: 'PILE',
  pitch: 'Appuie pour poser. Ce qui dépasse tombe',
  couleur: C.violet,
  unite: 'étages',
  ciel: C.violet,
  vies: 3,

  init(j) {
    j.e.pile = [{ x: j.W / 2 - 70, w: 140 }]
    j.e.tassement = 0
    j.e.v = 150
    nouveau(j)
  },

  maj(j, dt) {
    const c = j.e.courant
    c.x += c.dir * j.e.v * dt
    if (c.x < 0) (c.x = 0), (c.dir = 1)
    if (c.x + c.w > j.W) (c.x = j.W - c.w), (c.dir = -1)

    j.e.tassement = Math.max(0, j.e.tassement - dt * 7)

    for (const d of j.e.chutes) {
      d.vy += 900 * dt
      d.y += d.vy * dt
    }
    j.e.chutes = j.e.chutes.filter((d) => d.y < j.H + 40)
  },

  dessine(j, ctx) {
    // La pile est dessinée depuis le sommet vers le bas : la caméra ne bouge
    // jamais, c'est le monde qui descend.
    for (let i = j.e.pile.length - 1; i >= 0; i--) {
      const b = j.e.pile[i]
      const y = BASE_Y + (j.e.pile.length - 1 - i) * BLOC_H
      if (y > j.H) break
      // Le sommet s'écrase un instant : la pose se sent au lieu de se voir.
      const ecrase = i === j.e.pile.length - 1 ? j.e.tassement * 4 : 0
      bloc(ctx, b.x, y + ecrase, b.w, BLOC_H - ecrase, TEINTES[i % TEINTES.length], 3)
    }

    for (const d of j.e.chutes) rect(ctx, d.x, d.y, d.w, BLOC_H, C.bord)

    const c = j.e.courant
    lueur(ctx, c.x, BASE_Y - BLOC_H, c.w, BLOC_H, C.texte, 2, 0.6)
    bloc(ctx, c.x, BASE_Y - BLOC_H, c.w, BLOC_H, C.texte, 3)

    ctx.textAlign = 'left'
    texte(ctx, `largeur ${Math.round(j.e.pile[j.e.pile.length - 1].w)}`, 16, j.H - 20, 13, C.faible, 700)
    ctx.textAlign = 'center'
    if (j.e.pile.length < 3) texte(ctx, 'appuie pour poser', j.W / 2, j.HUD + 40, 13, C.faible, 700)
  },

  appui(j) {
    const c = j.e.courant
    const sous = j.e.pile[j.e.pile.length - 1]

    const gauche = Math.max(c.x, sous.x)
    const droite = Math.min(c.x + c.w, sous.x + sous.w)
    const large = droite - gauche

    if (large <= 2) {
      j.son.rate()
      return j.perdu()
    }

    // Le morceau qui dépasse tombe : c'est ce qui rétrécit la pile.
    if (c.x < gauche) j.e.chutes.push({ x: c.x, y: BASE_Y - BLOC_H, w: gauche - c.x, vy: 0 })
    if (c.x + c.w > droite) {
      j.e.chutes.push({ x: droite, y: BASE_Y - BLOC_H, w: c.x + c.w - droite, vy: 0 })
    }

    j.e.pile.push({ x: gauche, w: large })
    j.score++
    j.fx.eclat(gauche + large / 2, BASE_Y - BLOC_H / 2, TEINTES[j.e.pile.length % TEINTES.length], {
      n: 8,
      vitesse: 110,
      taille: 4,
    })
    j.fx.secoue(2.5)
    j.e.tassement = 1
    if (large > sous.w - 3) j.fx.bulle(gauche + large / 2, BASE_Y - 40, 'PILE !', C.accent, 16)
    j.e.v = Math.min(420, j.e.v + 9)
    j.son.casse(Math.min(11, j.e.pile.length))
    nouveau(j)
  },
}

function nouveau(j) {
  const sous = j.e.pile[j.e.pile.length - 1]
  j.e.chutes = j.e.chutes || []
  j.e.courant = {
    x: sous.x > j.W / 2 ? 0 : j.W - sous.w,
    w: sous.w,
    dir: sous.x > j.W / 2 ? 1 : -1,
  }
}
