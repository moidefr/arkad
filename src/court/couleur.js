import { C } from '../palette.js'
import { texte, rect, cadre } from '../dessin.js'

const TEINTES = [
  { nom: 'ROUGE', c: C.rouge },
  { nom: 'VERT', c: C.vert },
  { nom: 'BLEU', c: C.cyan },
  { nom: 'JAUNE', c: C.accent },
  { nom: 'VIOLET', c: C.violet },
]
const SEGMENTS = 20

export default {
  id: 'couleur',
  nom: 'COULEUR',
  pitch: 'Le mot ment. Choisis la couleur de l’encre',
  couleur: C.violet,
  unite: 'pts',

  init(j) {
    j.e.vies = 3
    j.e.serie = 0
    j.e.flash = 0
    tire(j)
  },

  maj(j, dt) {
    j.e.flash = Math.max(0, j.e.flash - dt * 3)
    j.e.reste -= dt
    if (j.e.reste <= 0) rate(j)
  },

  dessine(j, ctx) {
    const q = j.e.question

    // Le mot est écrit dans une couleur qui le contredit : tout le jeu est là.
    rect(ctx, 20, 170, 320, 120, C.panneau)
    cadre(ctx, 20, 170, 320, 120, C.bord)
    texte(ctx, q.mot.nom, j.W / 2, 230, 40, q.encre.c, 700, 290)

    const pleins = Math.max(0, Math.round((j.e.reste / j.e.duree) * SEGMENTS))
    for (let i = 0; i < SEGMENTS; i++) {
      rect(ctx, 26 + i * 16, 310, 12, 10, i < pleins ? C.accent : C.bord)
    }
    texte(ctx, 'QUELLE EST L’ENCRE ?', j.W / 2, 356, 13, C.faible, 700)

    q.choix.forEach((t, i) => {
      const x = i === 0 ? 20 : j.W / 2 + 10
      const w = j.W / 2 - 30
      rect(ctx, x, 390, w, 110, C.panneau)
      cadre(ctx, x, 390, w, 110, C.bord)
      rect(ctx, x + 20, 415, w - 40, 60, t.c)
    })

    ctx.textAlign = 'left'
    for (let i = 0; i < j.e.vies; i++) rect(ctx, 20 + i * 14, j.H - 30, 8, 8, C.rouge)
    ctx.textAlign = 'right'
    if (j.e.serie > 1) texte(ctx, `série ${j.e.serie}`, j.W - 20, j.H - 26, 13, C.accent, 700)
    ctx.textAlign = 'center'

    if (j.e.flash > 0) {
      ctx.fillStyle = `rgba(255, 95, 86, ${j.e.flash * 0.22})`
      ctx.fillRect(0, 0, j.W, j.H)
    }
  },

  appui(j, p) {
    const i = p.x < j.W / 2 ? 0 : 1
    if (j.e.question.choix[i] === j.e.question.encre) {
      j.e.serie++
      const gain = 10 + Math.min(j.e.serie, 10) * 2
      j.score += gain
      j.son.touche(Math.min(9, j.e.serie))
      j.fx.eclat(j.W / 2, 230, j.e.question.encre.c, { n: 14, vitesse: 190, taille: 5 })
      j.fx.bulle(j.W / 2, 190, '+' + gain, C.accent, 17)
      return tire(j)
    }
    rate(j)
  },
}

function rate(j) {
  j.e.serie = 0
  j.e.vies--
  j.e.flash = 1
  j.son.rate()
  if (j.e.vies <= 0) return j.perdu()
  tire(j)
}

function tire(j) {
  const mot = TEINTES[Math.floor(Math.random() * TEINTES.length)]
  // L'encre diffère du mot une fois sur deux : sans les cas honnêtes, on
  // apprendrait vite à ne plus lire du tout.
  let encre = mot
  if (Math.random() < 0.75) {
    do {
      encre = TEINTES[Math.floor(Math.random() * TEINTES.length)]
    } while (encre === mot)
  }

  let leurre
  do {
    leurre = TEINTES[Math.floor(Math.random() * TEINTES.length)]
  } while (leurre === encre)

  const choix = Math.random() < 0.5 ? [encre, leurre] : [leurre, encre]
  const niveau = 1 + Math.min(6, Math.floor(j.score / 120))

  j.e.question = { mot, encre, choix }
  j.e.duree = Math.max(1.7, 3.6 - niveau * 0.26)
  j.e.reste = j.e.duree
}
