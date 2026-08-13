import { C, ton } from '../palette.js'
import { texte, rect, cadre, bloc, lueur } from '../dessin.js'

const CASE = 38
const LONG_APPUI = 0.32 // au-delà, on pose un drapeau

/**
 * Ce que la grille laisse au-dessus d'elle et sous elle.
 *
 * Debout, elle commence sous deux lignes d'information empilées et garde une
 * large marge en bas : ce sont les mesures d'origine, et elles redonnent case
 * pour case les 9 × 12 posées en (9, 132). Couché, la hauteur est le bien rare
 * — les deux lignes se rangent côte à côte et la marge basse tombe à un liseré,
 * ce qui laisse sept rangs au lieu de six.
 */
const HAUT_DEBOUT = 132
const BAS_DEBOUT = 52
const HAUT_COUCHE = 84
const BAS_COUCHE = 10

/**
 * La grille prend toute la largeur et toute la hauteur qui reste, en cases
 * entières de 38 px, et se centre sur ce qui dépasse.
 *
 * Debout : 9 × 12 en (9, 132). Couché : 16 × 7 en (16, 84) — près du double de
 * front, et c'est là que le démineur est le meilleur, parce qu'une déduction
 * de bord se lit d'un coup au lieu de se dérouler en colonne.
 */
function dispo(j) {
  const haut = j.paysage ? HAUT_COUCHE : HAUT_DEBOUT
  const bas = j.paysage ? BAS_COUCHE : BAS_DEBOUT
  const cols = Math.floor(j.W / CASE)
  const rangs = Math.floor((j.H - haut - bas) / CASE)
  return { cols, rangs, x0: Math.floor((j.W - cols * CASE) / 2), y0: haut }
}

/**
 * Une grille seule tient cinq minutes. Le jeu, c'est la série : chaque grille
 * déminée en amène une plus lourde, et la partie ne s'arrête que sur une
 * erreur. C'est ce qui fait tenir la promesse des quinze minutes.
 */
const MINES_DEPART = 14
const MINES_PAS = 3

/** La grille debout : c'est sur elle que la difficulté et la prime sont réglées. */
const REFERENCE = 9 * 12

export default {
  id: 'demineur',
  nom: 'DÉMINEUR',
  pitch: 'Appui court pour creuser, appui long pour marquer',
  couleur: C.vert,
  unite: 'pts',
  // Un champ de mines se lit d'autant mieux qu'on en voit large : 112 cases de
  // front couché contre 108 en colonne, mais surtout seize de large, où les
  // bords et les coins — les seules cases dont on déduit quelque chose sans
  // deviner — sont tous visibles en même temps.
  paysage: true,
  confort: 'paysage',

  finTitre: (j) => ({ texte: `BOUM · GRILLE ${j.e.grille}`, couleur: C.rouge }),

  init(j) {
    j.e.grille = 1
    j.e.fanfare = 0
    pose(j)
  },

  /**
   * L'écran a tourné en pleine partie. Une grille de démineur ne se recadre
   * pas : un nombre ne veut rien dire ailleurs que sur les huit cases qu'il
   * compte, et rogner une colonne rendrait faux tout ce que le joueur venait de
   * déduire. On repose donc une grille neuve, au même numéro donc à la même
   * difficulté — le score déjà encaissé, lui, reste acquis.
   *
   * Et seulement si la grille change vraiment de taille : une rotation qui ne
   * déplacerait que le cadrage ne doit pas coûter une partie en cours.
   */
  redim(j) {
    const d = dispo(j)
    if (d.cols === j.e.cols && d.rangs === j.e.rangs) return Object.assign(j.e, d)
    pose(j)
    j.fx.bulle(j.W / 2, j.H / 2, 'GRILLE REPOSÉE', C.accent, 18)
    j.son.niveau()
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
    const { cols, x0, y0 } = j.e
    ctx.textAlign = 'center'
    for (let i = 0; i < j.e.cases.length; i++) {
      const c = j.e.cases[i]
      const x = x0 + (i % cols) * CASE
      const y = y0 + Math.floor(i / cols) * CASE

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

    // Debout les quatre informations s'empilent en deux lignes ; couché, la
    // hauteur qu'elles prendraient est un rang de cases, alors elles se rangent
    // sur une seule ligne, le rappel de l'appui long au milieu.
    ctx.textAlign = 'left'
    if (j.paysage) {
      texte(ctx, `GRILLE ${j.e.grille}`, 12, 70, 16, C.accent, 700)
      texte(ctx, `${j.e.mines - j.e.marque} mines`, 122, 70, 14, C.faible, 700)
      ctx.textAlign = 'center'
      texte(ctx, 'appui long = drapeau', j.W / 2, 70, 13, C.faible, 700)
      ctx.textAlign = 'right'
      texte(ctx, `${Math.floor(j.t)} s`, j.W - 12, 70, 14, C.faible, 700)
    } else {
      texte(ctx, `GRILLE ${j.e.grille}`, 12, 76, 16, C.accent, 700)
      texte(ctx, `${j.e.mines - j.e.marque} mines`, 12, 102, 14, C.faible, 700)
      ctx.textAlign = 'right'
      texte(ctx, `${Math.floor(j.t)} s`, j.W - 12, 76, 14, C.faible, 700)
      texte(ctx, 'appui long = drapeau', j.W - 12, 102, 13, C.faible, 700)
    }
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
    const i = index(j, p)
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
  Object.assign(j.e, dispo(j))
  const n = j.e.cols * j.e.rangs
  // Ce qui fait la difficulté d'une grille, c'est la densité de mines, jamais
  // leur nombre : à quatorze mines fixes, les 112 cases couchées seraient plus
  // faciles que les 108 debout, et la série entière glisserait d'un cran. On
  // garde donc les mines par case. Debout le rapport vaut un tout rond, et la
  // suite reste 14, 17, 20…
  j.e.mines = Math.round(((MINES_DEPART + (j.e.grille - 1) * MINES_PAS) * n) / REFERENCE)
  j.e.cases = Array.from({ length: n }, () => ({
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

function index(j, p) {
  const c = Math.floor((p.x - j.e.x0) / CASE)
  const r = Math.floor((p.y - j.e.y0) / CASE)
  if (c < 0 || c >= j.e.cols || r < 0 || r >= j.e.rangs) return null
  return r * j.e.cols + c
}

function voisins(j, i) {
  const cols = j.e.cols
  const c = i % cols
  const r = Math.floor(i / cols)
  const out = []
  for (let dc = -1; dc <= 1; dc++) {
    for (let dr = -1; dr <= 1; dr++) {
      if (!dc && !dr) continue
      const nc = c + dc
      const nr = r + dr
      if (nc < 0 || nc >= cols || nr < 0 || nr >= j.e.rangs) continue
      out.push(nr * cols + nc)
    }
  }
  return out
}

/** Les mines arrivent après le premier creusement : on ne perd jamais au premier coup. */
function seme(j, epargne) {
  const interdit = new Set([epargne, ...voisins(j, epargne)])
  let reste = j.e.mines
  while (reste > 0) {
    const i = Math.floor(Math.random() * j.e.cases.length)
    if (interdit.has(i) || j.e.cases[i].mine) continue
    j.e.cases[i].mine = true
    reste--
  }
  for (let i = 0; i < j.e.cases.length; i++) {
    j.e.cases[i].voisins = voisins(j, i).filter((k) => j.e.cases[k].mine).length
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

  const { cols, x0, y0 } = j.e
  if (c.mine) {
    for (const k of j.e.cases) if (k.mine) k.vu = true
    j.son.rate()
    j.fx.secoue(10)
    j.fx.eclat(x0 + (i % cols) * CASE + CASE / 2, y0 + Math.floor(i / cols) * CASE + CASE / 2, C.rouge, {
      n: 22,
      vitesse: 220,
    })
    return j.perdu()
  }

  // Propagation en largeur : la profondeur donne le retard d'ouverture, donc
  // la vague se voit partir du doigt. Le retard est par case et une case fait
  // 38 px dans les deux gabarits — la vague traverse donc l'écran à la même
  // vitesse à l'œil, et il n'y a rien à corriger de ce côté.
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
      if (cc.voisins === 0) suivant.push(...voisins(j, k))
    }
    front = suivant
    profondeur++
  }
  j.score += ouvertes * 10 * j.e.grille
  j.son.touche(Math.min(9, 1 + Math.floor(ouvertes / 3)))

  if (j.e.cases.every((k) => k.vu || k.mine)) suivante(j)
}

function suivante(j) {
  // Prime de vitesse, puis on remet ça avec trois mines de plus. La prime se
  // juge au temps *par case* : une grille plus large en demande plus au regard,
  // et un chrono absolu la punirait d'être grande alors qu'elle n'est pas plus
  // dure. Debout le facteur vaut un, donc la prime est au pixel celle d'avant.
  const n = j.e.cols * j.e.rangs
  j.score += Math.max(200, 1200 - Math.round((Math.floor(j.t) * 4 * REFERENCE) / n)) * j.e.grille
  j.e.grille++
  j.son.record()
  j.fx.eclat(j.W / 2, j.H / 2, C.accent, { n: 34, vitesse: 250 })
  pose(j)
  j.e.fanfare = 1.6
}
