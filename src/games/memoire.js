import { C } from '../palette.js'
import { texte, rect } from '../dessin.js'

const TEINTES = [C.rouge, C.accent, C.cyan, C.vert]
const HAUT = 130
const MARGE = 30

export default {
  id: 'memoire',
  nom: 'MÉMOIRE',
  pitch: 'Regarde la séquence, refais-la',
  couleur: C.vert,
  unite: 'pts',

  init(j) {
    j.e.suite = []
    j.e.phase = 'montre'
    j.e.i = 0
    j.e.t = 0
    j.e.actif = -1
    allonge(j)
  },

  maj(j, dt) {
    j.e.t += dt

    if (j.e.phase === 'montre') {
      // Un temps par case : allumée, puis éteinte. La cadence accélère avec
      // la longueur, sinon les dernières manches durent une éternité.
      const pas = Math.max(0.34, 0.62 - j.e.suite.length * 0.02)
      const k = Math.floor(j.e.t / pas)
      if (k >= j.e.suite.length) {
        j.e.phase = 'joue'
        j.e.i = 0
        j.e.actif = -1
        return
      }
      const dedans = j.e.t % pas < pas * 0.6
      const nouveau = dedans ? j.e.suite[k] : -1
      if (nouveau !== j.e.actif) {
        j.e.actif = nouveau
        if (nouveau >= 0) j.son.touche(nouveau + 1)
      }
      return
    }

    if (j.e.phase === 'gagne') {
      if (j.e.t > 0.6) {
        allonge(j)
        j.e.phase = 'montre'
        j.e.t = 0
        j.e.actif = -1
      }
      return
    }

    // En saisie, la case allumée s'éteint toute seule.
    if (j.e.actif >= 0 && j.e.t > 0.16) j.e.actif = -1
  },

  dessine(j, ctx) {
    const c = cases(j)
    c.forEach((z, i) => {
      const allume = j.e.actif === i
      rect(ctx, z.x, z.y, z.w, z.h, allume ? TEINTES[i] : C.panneau)
      rect(ctx, z.x, z.y, z.w, 4, TEINTES[i])
    })

    texte(ctx, `SÉQUENCE ${j.e.suite.length}`, j.W / 2, HAUT - 40, 14, C.faible, 700)
    if (j.e.phase === 'montre') texte(ctx, 'REGARDE', j.W / 2, j.H - 60, 16, C.accent, 700)
    else if (j.e.phase === 'joue') {
      texte(ctx, `${j.e.i} / ${j.e.suite.length}`, j.W / 2, j.H - 60, 16, C.texte, 700)
    }
  },

  appui(j, p) {
    if (j.e.phase !== 'joue') return
    const i = cases(j).findIndex((z) => p.x >= z.x && p.x <= z.x + z.w && p.y >= z.y && p.y <= z.y + z.h)
    if (i === -1) return

    j.e.actif = i
    j.e.t = 0

    if (j.e.suite[j.e.i] !== i) {
      j.son.rate()
      return j.perdu()
    }

    j.son.touche(i + 1)
    const z = cases(j)[i]
    j.fx.eclat(z.x + z.w / 2, z.y + z.h / 2, TEINTES[i], { n: 10, vitesse: 130, gravite: 60 })
    j.e.i++
    if (j.e.i >= j.e.suite.length) {
      j.score += 10 * j.e.suite.length
      j.e.phase = 'gagne'
      j.e.t = 0
      j.son.niveau()
    }
  },
}

function cases(j) {
  const w = (j.W - MARGE * 3) / 2
  const h = w
  return [0, 1, 2, 3].map((i) => ({
    x: MARGE + (i % 2) * (w + MARGE),
    y: HAUT + Math.floor(i / 2) * (h + MARGE),
    w,
    h,
  }))
}

function allonge(j) {
  j.e.suite.push(Math.floor(Math.random() * 4))
}
