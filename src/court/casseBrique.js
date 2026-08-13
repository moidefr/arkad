import { C, ton } from '../palette.js'
import { texte, rect, pastille, trame, borne, bloc, lueur } from '../dessin.js'

const COLS = 6
const RANGS = 5
const MARGE = 22
const BRIQUE_H = 20
const RAQUETTE_W = 76
const RAQUETTE_Y = 92 // au-dessus du bas de l'écran
const BALLE_R = 6

const TEINTES = [C.rouge, C.accent, C.violet, C.cyan, C.vert]

export default {
  id: 'casse-brique',
  nom: 'BRIQUES',
  pitch: 'Le doigt déplace la raquette. Trois balles',
  couleur: C.violet,
  unite: 'pts',

  init(j) {
    j.e.vies = 3
    j.e.niveau = 1
    j.e.raquette = j.W / 2
    poseBriques(j)
    poseBalle(j)
  },

  maj(j, dt) {
    j.e.raquette = borne(j.pointer.x, RAQUETTE_W / 2, j.W - RAQUETTE_W / 2)
    const b = j.e.balle

    if (b.collee) {
      b.x = j.e.raquette
      b.y = j.H - RAQUETTE_Y - BALLE_R - 6
      return
    }

    // Deux petits pas par image : à cette vitesse, un seul pas ferait
    // traverser les briques à la balle.
    for (let k = 0; k < 2; k++) {
      b.x += b.vx * dt * 0.5
      b.y += b.vy * dt * 0.5

      if (b.x < BALLE_R) ((b.x = BALLE_R), (b.vx = Math.abs(b.vx)), j.son.rebond())
      if (b.x > j.W - BALLE_R) ((b.x = j.W - BALLE_R), (b.vx = -Math.abs(b.vx)), j.son.rebond())
      if (b.y < j.HUD + BALLE_R) ((b.y = j.HUD + BALLE_R), (b.vy = Math.abs(b.vy)), j.son.rebond())

      const ry = j.H - RAQUETTE_Y
      if (
        b.vy > 0 &&
        b.y + BALLE_R >= ry &&
        b.y - BALLE_R <= ry + 12 &&
        Math.abs(b.x - j.e.raquette) < RAQUETTE_W / 2 + BALLE_R
      ) {
        // L'angle de renvoi dépend de l'endroit touché sur la raquette :
        // c'est ce qui rend le jeu pilotable plutôt que subi.
        const ecart = (b.x - j.e.raquette) / (RAQUETTE_W / 2)
        const v = Math.hypot(b.vx, b.vy)
        const angle = -Math.PI / 2 + ecart * 1.05
        b.vx = Math.cos(angle) * v
        b.vy = Math.sin(angle) * v
        b.y = ry - BALLE_R
        j.son.rebond()
      }

      for (const q of j.e.briques) {
        if (q.morte) continue
        if (b.x + BALLE_R < q.x || b.x - BALLE_R > q.x + q.w) continue
        if (b.y + BALLE_R < q.y || b.y - BALLE_R > q.y + BRIQUE_H) continue
        q.pv--
        // On rebondit dans tous les cas ; la brique ne cède qu'à zéro.
        j.son.casse(RANGS - 1 - q.rang)
        if (q.pv > 0) {
          j.fx.eclat(q.x + q.w / 2, q.y + BRIQUE_H / 2, q.couleur, { n: 4, vitesse: 90, taille: 3 })
          j.fx.secoue(1)
        } else {
          q.morte = true
          j.score += 10 * j.e.niveau * q.pvMax
          j.fx.eclat(q.x + q.w / 2, q.y + BRIQUE_H / 2, q.couleur, { n: 9, vitesse: 130, taille: 5 })
          j.fx.secoue(1.5)
        }
        // On rebondit sur l'axe où la balle est le moins enfoncée.
        const dx = Math.min(Math.abs(b.x - q.x), Math.abs(b.x - (q.x + q.w)))
        const dy = Math.min(Math.abs(b.y - q.y), Math.abs(b.y - (q.y + BRIQUE_H)))
        if (dx < dy) b.vx *= -1
        else b.vy *= -1
        break
      }
    }

    if (b.y > j.H + 20) {
      j.e.vies--
      if (j.e.vies <= 0) return j.perdu()
      j.son.rate()
      j.fx.secoue(7)
      poseBalle(j)
    }

    if (j.e.briques.every((q) => q.morte)) {
      j.e.niveau++
      j.score += 100
      j.son.niveau()
      poseBriques(j)
      poseBalle(j)
    }
  },

  dessine(j, ctx) {
    trame(ctx, 0, j.HUD, j.W, j.H - j.HUD, 20, C.panneau)

    for (const q of j.e.briques) {
      if (q.morte) continue
      const entamee = q.pv < q.pvMax
      bloc(ctx, q.x, q.y, q.w, BRIQUE_H, entamee ? ton(q.couleur, -0.4) : q.couleur, 3)
      // Fissures : quatre pixels en diagonale, et on voit qu'elle a pris.
      if (entamee) {
        for (let k = 0; k < 5; k++) {
          rect(ctx, q.x + 6 + k * 6, q.y + 5 + (k % 2) * 6, 3, 3, ton(q.couleur, 0.5))
        }
      }
    }

    bloc(ctx, j.e.raquette - RAQUETTE_W / 2, j.H - RAQUETTE_Y, RAQUETTE_W, 10, C.texte, 2)
    bloc(ctx, j.e.raquette - 8, j.H - RAQUETTE_Y, 16, 10, C.violet, 2)
    lueur(ctx, j.e.balle.x - BALLE_R, j.e.balle.y - BALLE_R, BALLE_R * 2, BALLE_R * 2, C.cyan, 3)
    pastille(ctx, j.e.balle.x, j.e.balle.y, BALLE_R, C.cyan)
    pastille(ctx, j.e.balle.x - 2, j.e.balle.y - 2, BALLE_R / 2, ton(C.cyan, 0.5))

    for (let i = 0; i < j.e.vies; i++) rect(ctx, 16 + i * 14, j.H - 24, 8, 8, C.cyan)
    ctx.textAlign = 'right'
    texte(ctx, `NIV ${j.e.niveau}`, j.W - 14, j.H - 20, 13, C.faible, 700)
    ctx.textAlign = 'center'

    if (j.e.balle.collee) texte(ctx, 'appuie pour lancer', j.W / 2, j.H - 150, 13, C.faible, 700)
  },

  appui(j) {
    j.e.balle.collee = false
  },
}

function poseBriques(j) {
  const w = (j.W - MARGE * 2 - (COLS - 1) * 6) / COLS
  j.e.briques = []
  for (let r = 0; r < RANGS; r++) {
    for (let c = 0; c < COLS; c++) {
      j.e.briques.push({
        x: MARGE + c * (w + 6),
        y: j.HUD + 34 + r * (BRIQUE_H + 6),
        w,
        rang: r,
        // Les deux rangées du haut tiennent deux coups : la fissure prévient,
        // et le joueur apprend à viser plutôt qu'à espérer.
        pv: r < 2 ? 2 : 1,
        pvMax: r < 2 ? 2 : 1,
        couleur: TEINTES[r % TEINTES.length],
        morte: false,
      })
    }
  }
}

function poseBalle(j) {
  const v = 250 + j.e.niveau * 22
  j.e.balle = {
    x: j.e.raquette,
    y: j.H - RAQUETTE_Y - BALLE_R - 6,
    vx: v * 0.45,
    vy: -v,
    collee: true,
  }
}
