import { C } from '../palette.js'
import { texte, rect, pastille, trame, borne } from '../dessin.js'

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
  nom: 'CASSE-BRIQUE',
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

      if (b.x < BALLE_R) (b.x = BALLE_R), (b.vx = Math.abs(b.vx)), j.son.rebond()
      if (b.x > j.W - BALLE_R) (b.x = j.W - BALLE_R), (b.vx = -Math.abs(b.vx)), j.son.rebond()
      if (b.y < j.HUD + BALLE_R) (b.y = j.HUD + BALLE_R), (b.vy = Math.abs(b.vy)), j.son.rebond()

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
        q.morte = true
        j.score += 10 * j.e.niveau
        // La note dépend de la rangée : vider une colonne fait une gamme.
        j.son.casse(RANGS - 1 - q.rang)
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
      rect(ctx, q.x, q.y, q.w, BRIQUE_H, q.couleur)
      rect(ctx, q.x, q.y, q.w, 4, C.fond)
      rect(ctx, q.x, q.y + BRIQUE_H - 4, q.w, 4, C.fond)
    }

    rect(ctx, j.e.raquette - RAQUETTE_W / 2, j.H - RAQUETTE_Y, RAQUETTE_W, 10, C.texte)
    rect(ctx, j.e.raquette - 8, j.H - RAQUETTE_Y, 16, 10, C.violet)
    pastille(ctx, j.e.balle.x, j.e.balle.y, BALLE_R, C.cyan)

    for (let i = 0; i < j.e.vies; i++) rect(ctx, 16 + i * 14, j.H - 24, 8, 8, C.cyan)
    ctx.textAlign = 'right'
    texte(ctx, `NIV ${j.e.niveau}`, j.W - 14, j.H - 20, 11, C.faible, 700)
    ctx.textAlign = 'center'

    if (j.e.balle.collee) texte(ctx, 'appuie pour lancer', j.W / 2, j.H - 150, 12, C.faible, 700)
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
