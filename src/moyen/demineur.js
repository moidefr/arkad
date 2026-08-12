import { C, ton } from '../palette.js'
import { texte, rect, cadre, bloc, lueur } from '../dessin.js'

const COLS = 9
const RANGS = 12
const CASE = 38
const X0 = 9
const Y0 = 132
const LONG_APPUI = 0.32 // au-delà, on pose un drapeau

/**
 * Une grille seule tient cinq minutes. Le jeu, c'est la série : chaque grille
 * déminée en amène une plus lourde, et la partie ne s'arrête que sur une
 * erreur. C'est ce qui fait tenir la promesse des quinze minutes.
 */
const MINES_DEPART = 14
const MINES_PAS = 3

export default {
  id: 'demineur',
  nom: 'DÉMINEUR',
  pitch: 'Appui court pour creuser, appui long pour marquer',
  couleur: C.vert,
  unite: 'pts',

  finTitre: (j) => ({ texte: `BOUM · GRILLE ${j.e.grille}`, couleur: C.rouge }),

  init(j) {
    j.e.grille = 1
    j.e.fanfare = 0
    pose(j)
  },

  maj(j, dt) {
    j.e.fanfare = Math.max(0, j.e.fanfare - dt)

    // Le drapeau se pose dès que l'appui dure : attendre le relâchement
    // donnerait l'impression que le jeu n'a pas compris.
    const a = j.e.appui
    if (a && !a.fait && j.maintenu) {
      a.duree += dt
      if (a.duree >= LONG_APPUI) {
        a.fait = true
        marque(j, a.i)
      }
    }
  },

  dessine(j, ctx) {
    ctx.textAlign = 'center'
    for (let i = 0; i < j.e.cases.length; i++) {
      const c = j.e.cases[i]
      const x = X0 + (i % COLS) * CASE
      const y = Y0 + Math.floor(i / COLS) * CASE

      if (!c.vu) {
        bloc(ctx, x + 1, y + 1, CASE - 2, CASE - 2, ton(C.panneau, 0.22), 3)
        if (c.drapeau) {
          rect(ctx, x + 12, y + 9, 4, 20, C.faible)
          rect(ctx, x + 16, y + 9, 12, 9, C.rouge)
        }
        continue
      }

      // Ouverture en vague : la case se creuse en grandissant, avec un retard
      // proportionnel à sa distance du point cliqué. La propagation se voit.
      const age = j.t - (c.ouvert ?? 0)
      if (age < 0) {
        bloc(ctx, x + 1, y + 1, CASE - 2, CASE - 2, ton(C.panneau, 0.22), 3)
        continue
      }
      const k = Math.min(1, age / 0.16)
      const m = (1 - k) * (CASE / 2 - 2)
      rect(ctx, x + 1 + m, y + 1 + m, CASE - 2 - m * 2, CASE - 2 - m * 2, C.fond)
      if (k < 1) continue
      cadre(ctx, x + 1, y + 1, CASE - 2, CASE - 2, C.panneau)
      if (c.mine) {
        lueur(ctx, x + 10, y + 10, CASE - 20, CASE - 20, C.rouge, 2)
        bloc(ctx, x + 10, y + 10, CASE - 20, CASE - 20, C.rouge, 2)
      }
      else if (c.voisins) texte(ctx, c.voisins, x + CASE / 2, y + CASE / 2, 20, TEINTE[c.voisins - 1], 700)
    }

    ctx.textAlign = 'left'
    texte(ctx, `GRILLE ${j.e.grille}`, 12, 76, 16, C.accent, 700)
    texte(ctx, `${j.e.mines - j.e.marque} mines`, 12, 102, 14, C.faible, 700)
    ctx.textAlign = 'right'
    texte(ctx, `${Math.floor(j.t)} s`, j.W - 12, 76, 14, C.faible, 700)
    texte(ctx, 'appui long = drapeau', j.W - 12, 102, 13, C.faible, 700)
    ctx.textAlign = 'center'

    if (j.e.fanfare > 0) {
      ctx.fillStyle = `rgba(11, 14, 13, ${Math.min(0.8, j.e.fanfare)})`
      ctx.fillRect(0, 0, j.W, j.H)
      texte(ctx, `GRILLE ${j.e.grille - 1} DÉMINÉE`, j.W / 2, j.H / 2 - 16, 22, C.accent, 700)
      texte(ctx, `${j.e.mines} mines maintenant`, j.W / 2, j.H / 2 + 18, 15, C.texte, 700)
    }
  },

  appui(j, p) {
    if (j.e.fanfare > 0) return
    const i = index(p)
    if (i === null) return
    j.e.appui = { i, duree: 0, fait: false }
  },

  relache(j) {
    const a = j.e.appui
    j.e.appui = null
    if (!a || a.fait || j.e.fanfare > 0) return
    creuse(j, a.i)
  },
}

const TEINTE = [C.cyan, C.vert, C.accent, C.violet, C.rouge, C.rouge, C.rouge, C.rouge]

function pose(j) {
  j.e.mines = MINES_DEPART + (j.e.grille - 1) * MINES_PAS
  j.e.cases = Array.from({ length: COLS * RANGS }, () => ({
    mine: false,
    vu: false,
    drapeau: false,
    voisins: 0,
    ouvert: 0,
  }))
  j.e.place = false // les mines ne sont posées qu'au premier creusement
  j.e.marque = 0
  j.e.appui = null
}

function index(p) {
  const c = Math.floor((p.x - X0) / CASE)
  const r = Math.floor((p.y - Y0) / CASE)
  if (c < 0 || c >= COLS || r < 0 || r >= RANGS) return null
  return r * COLS + c
}

function voisins(i) {
  const c = i % COLS
  const r = Math.floor(i / COLS)
  const out = []
  for (let dc = -1; dc <= 1; dc++) {
    for (let dr = -1; dr <= 1; dr++) {
      if (!dc && !dr) continue
      const nc = c + dc
      const nr = r + dr
      if (nc < 0 || nc >= COLS || nr < 0 || nr >= RANGS) continue
      out.push(nr * COLS + nc)
    }
  }
  return out
}

/** Les mines arrivent après le premier creusement : on ne perd jamais au premier coup. */
function seme(j, epargne) {
  const interdit = new Set([epargne, ...voisins(epargne)])
  let reste = j.e.mines
  while (reste > 0) {
    const i = Math.floor(Math.random() * j.e.cases.length)
    if (interdit.has(i) || j.e.cases[i].mine) continue
    j.e.cases[i].mine = true
    reste--
  }
  for (let i = 0; i < j.e.cases.length; i++) {
    j.e.cases[i].voisins = voisins(i).filter((k) => j.e.cases[k].mine).length
  }
  j.e.place = true
}

function marque(j, i) {
  const c = j.e.cases[i]
  if (c.vu) return
  c.drapeau = !c.drapeau
  j.e.marque += c.drapeau ? 1 : -1
  j.son.rebond()
}

function creuse(j, i) {
  const c = j.e.cases[i]
  if (c.vu || c.drapeau) return
  if (!j.e.place) seme(j, i)

  if (c.mine) {
    for (const k of j.e.cases) if (k.mine) k.vu = true
    j.son.rate()
    j.fx.secoue(10)
    j.fx.eclat(X0 + (i % COLS) * CASE + CASE / 2, Y0 + Math.floor(i / COLS) * CASE + CASE / 2, C.rouge, {
      n: 22,
      vitesse: 220,
    })
    return j.perdu()
  }

  // Propagation en largeur : la profondeur donne le retard d'ouverture, donc
  // la vague se voit partir du doigt.
  let front = [i]
  let profondeur = 0
  let ouvertes = 0
  while (front.length) {
    const suivant = []
    for (const k of front) {
      const cc = j.e.cases[k]
      if (cc.vu || cc.drapeau) continue
      cc.vu = true
      cc.ouvert = j.t + profondeur * 0.035
      ouvertes++
      if (cc.voisins === 0) suivant.push(...voisins(k))
    }
    front = suivant
    profondeur++
  }
  j.score += ouvertes * 10 * j.e.grille
  j.son.touche(Math.min(9, 1 + Math.floor(ouvertes / 3)))

  if (j.e.cases.every((k) => k.vu || k.mine)) suivante(j)
}

function suivante(j) {
  // Prime de vitesse, puis on remet ça avec trois mines de plus.
  j.score += Math.max(200, 1200 - Math.floor(j.t) * 4) * j.e.grille
  j.e.grille++
  j.son.record()
  j.fx.eclat(j.W / 2, j.H / 2, C.accent, { n: 34, vitesse: 250 })
  pose(j)
  j.e.fanfare = 1.6
}
