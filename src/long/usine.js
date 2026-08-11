import { C } from '../palette.js'
import { texte, rect, cadre } from '../dessin.js'

const MACHINES = [
  { nom: 'PIOCHE', cout: 12, taux: 1.15, prod: 0.4, couleur: C.faible },
  { nom: 'FOREUSE', cout: 140, taux: 1.16, prod: 3.5, couleur: C.cyan },
  { nom: 'CONVOYEUR', cout: 1700, taux: 1.17, prod: 24, couleur: C.vert },
  { nom: 'FONDERIE', cout: 24000, taux: 1.18, prod: 170, couleur: C.violet },
  { nom: 'RÉACTEUR', cout: 400000, taux: 1.2, prod: 1400, couleur: C.accent },
]

const RANGEE_Y = 232
const RANGEE_H = 66
const HORS_LIGNE_MAX = 8 * 3600 // on ne crédite jamais plus de huit heures

export default {
  id: 'usine',
  nom: 'USINE',
  pitch: 'Ça produit même quand tu n’es pas là',
  couleur: C.violet,
  unite: '',
  persistant: true,
  sansScore: true,

  titreHud: (j) => nombre(j.e.minerai),

  init(j) {
    const s = j.charge()
    j.e.minerai = s?.minerai ?? 0
    j.e.n = s?.n ?? MACHINES.map(() => 0)
    j.e.total = s?.total ?? 0
    j.e.horsLigne = 0
    j.e.depuisSauve = 0
    j.e.pulse = 0

    // Production hors ligne : c'est ce qui donne envie de rouvrir le jeu.
    if (s?.quand) {
      const ecoule = Math.min(HORS_LIGNE_MAX, Math.max(0, (Date.now() - s.quand) / 1000))
      const gagne = production(j) * ecoule
      if (gagne > 1) {
        j.e.minerai += gagne
        j.e.total += gagne
        j.e.horsLigne = gagne
      }
    }
  },

  maj(j, dt) {
    const p = production(j) * dt
    j.e.minerai += p
    j.e.total += p
    j.e.pulse = Math.max(0, j.e.pulse - dt * 4)

    j.e.depuisSauve += dt
    if (j.e.depuisSauve > 2) {
      j.e.depuisSauve = 0
      ecrit(j)
    }
  },

  quitte: (j) => ecrit(j),

  dessine(j, ctx) {
    // Le gisement : on tape dessus pour extraire à la main.
    const k = 1 + j.e.pulse * 0.06
    ctx.save()
    ctx.translate(j.W / 2, 148)
    ctx.scale(k, k)
    rect(ctx, -66, -42, 132, 84, C.panneau)
    cadre(ctx, -66, -42, 132, 84, C.accent)
    texte(ctx, 'CREUSER', 0, 0, 20, C.accent, 700)
    ctx.restore()

    texte(ctx, nombre(j.e.minerai), j.W / 2, 84, 34, C.texte, 700, 320)
    texte(ctx, `${nombre(production(j))} / s`, j.W / 2, 110, 14, C.faible, 700)

    MACHINES.forEach((m, i) => {
      const y = RANGEE_Y + i * (RANGEE_H + 6)
      const prix = cout(j, i)
      const possible = j.e.minerai >= prix
      rect(ctx, 16, y, 328, RANGEE_H, C.panneau)
      rect(ctx, 16, y, 4, RANGEE_H, possible ? m.couleur : C.bord)

      ctx.textAlign = 'left'
      texte(ctx, m.nom, 32, y + 20, 16, possible ? C.texte : C.faible, 700)
      texte(ctx, `${nombre(m.prod * j.e.n[i])} / s`, 32, y + 44, 13, C.faible, 700)
      ctx.textAlign = 'right'
      texte(ctx, `x${j.e.n[i]}`, 336, y + 20, 16, C.texte, 700)
      texte(ctx, nombre(prix), 336, y + 44, 14, possible ? C.accent : C.bord, 700)
      ctx.textAlign = 'center'
    })

    if (j.e.horsLigne > 1 && j.t < 6) {
      texte(ctx, `pendant ton absence : +${nombre(j.e.horsLigne)}`, j.W / 2, 200, 13, C.accent, 700)
    }
  },

  appui(j, p) {
    if (p.y < 200) {
      // Extraction manuelle : jamais rentable longtemps, mais c'est par là
      // qu'on démarre.
      const gain = 1 + production(j) * 0.05
      j.e.minerai += gain
      j.e.total += gain
      j.e.pulse = 1
      j.son.rebond()
      j.fx.bulle(p.x, p.y - 10, '+' + nombre(gain), C.accent, 14)
      return
    }

    const i = Math.floor((p.y - RANGEE_Y) / (RANGEE_H + 6))
    if (i < 0 || i >= MACHINES.length) return
    const prix = cout(j, i)
    if (j.e.minerai < prix) return j.son.rate()

    j.e.minerai -= prix
    j.e.n[i]++
    j.son.niveau()
    j.fx.eclat(180, RANGEE_Y + i * (RANGEE_H + 6) + RANGEE_H / 2, MACHINES[i].couleur, { n: 12, vitesse: 140 })
    ecrit(j)
  },
}

const production = (j) => MACHINES.reduce((s, m, i) => s + m.prod * j.e.n[i], 0)
const cout = (j, i) => Math.floor(MACHINES[i].cout * Math.pow(MACHINES[i].taux, j.e.n[i]))

function ecrit(j) {
  j.sauve({ minerai: j.e.minerai, n: j.e.n, total: j.e.total, quand: Date.now() })
}

/** 1.2k, 34.5M… sinon les grands nombres débordent de l'écran. */
function nombre(v) {
  if (v < 1000) return v < 10 ? v.toFixed(1) : String(Math.floor(v))
  const suffixes = ['k', 'M', 'G', 'T', 'P', 'E']
  let i = -1
  while (v >= 1000 && i < suffixes.length - 1) {
    v /= 1000
    i++
  }
  return v.toFixed(v < 10 ? 2 : 1) + suffixes[i]
}
