import { C } from '../palette.js'
import { texte, rect, cadre } from '../dessin.js'

const SEGMENTS = 20

export default {
  id: 'calcul',
  nom: 'CALCUL',
  pitch: 'Vrai à droite, faux à gauche. Vite',
  couleur: C.violet,
  unite: 'pts',

  init(j) {
    j.e.vies = 3
    j.e.serie = 0
    j.e.flash = 0
    j.e.bon = 0
    tire(j)
  },

  maj(j, dt) {
    j.e.flash = Math.max(0, j.e.flash - dt * 3)
    j.e.reste -= dt
    if (j.e.reste <= 0) rate(j)
  },

  dessine(j, ctx) {
    const q = j.e.question

    rect(ctx, 20, 190, 320, 130, C.panneau)
    cadre(ctx, 20, 190, 320, 130, C.bord)
    texte(ctx, q.texte, j.W / 2, 240, 34, C.texte, 700, 290)
    texte(ctx, `= ${q.propose}`, j.W / 2, 288, 28, C.accent, 700, 290)

    // Le temps restant, en segments comme partout ailleurs sur la borne.
    const pleins = Math.max(0, Math.round((j.e.reste / j.e.duree) * SEGMENTS))
    for (let i = 0; i < SEGMENTS; i++) {
      rect(ctx, 26 + i * 16, 340, 12, 10, i < pleins ? C.accent : C.bord)
    }

    for (const [i, mot] of ['FAUX', 'VRAI'].entries()) {
      const x = i === 0 ? 20 : j.W / 2 + 10
      const w = j.W / 2 - 30
      rect(ctx, x, 420, w, 90, C.panneau)
      cadre(ctx, x, 420, w, 90, i === 0 ? C.rouge : C.vert)
      texte(ctx, mot, x + w / 2, 465, 24, i === 0 ? C.rouge : C.vert, 700)
    }

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
    const repond = p.x >= j.W / 2 // droite = vrai
    if (repond === j.e.question.juste) {
      j.e.serie++
      const gain = 10 + Math.min(j.e.serie, 10) * 2
      j.score += gain
      j.son.touche(Math.min(9, j.e.serie))
      j.fx.eclat(j.W / 2, 260, C.accent, { n: 12, vitesse: 170, taille: 5 })
      j.fx.bulle(j.W / 2, 210, '+' + gain, C.accent, 17)
      tire(j)
      return
    }
    rate(j)
  },
}

function rate(j) {
  j.e.serie = 0
  j.e.vies--
  j.e.flash = 1
  j.son.rate()
  j.fx.secoue(6)
  if (j.e.vies <= 0) return j.perdu()
  tire(j)
}

function tire(j) {
  // La difficulté monte par les nombres et par le temps, pas par l'opération.
  const niveau = 1 + Math.min(6, Math.floor(j.score / 120))
  const ops = niveau < 3 ? ['+', '-'] : ['+', '-', '×']
  const op = ops[Math.floor(Math.random() * ops.length)]

  let a, b, vrai
  if (op === '×') {
    a = 2 + Math.floor(Math.random() * (3 + niveau))
    b = 2 + Math.floor(Math.random() * (3 + niveau))
    vrai = a * b
  } else {
    a = 5 + Math.floor(Math.random() * (10 * niveau))
    b = 1 + Math.floor(Math.random() * (8 * niveau))
    if (op === '-' && b > a) [a, b] = [b, a]
    vrai = op === '+' ? a + b : a - b
  }

  const juste = Math.random() < 0.5
  // Un faux résultat doit rester crédible : on décale de peu.
  const ecart = (1 + Math.floor(Math.random() * 3)) * (Math.random() < 0.5 ? -1 : 1)

  j.e.question = { texte: `${a} ${op} ${b}`, propose: juste ? vrai : vrai + ecart, juste }
  j.e.duree = Math.max(2.1, 4.4 - niveau * 0.3)
  j.e.reste = j.e.duree
}
