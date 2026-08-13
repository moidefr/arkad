import { C, ton } from '../palette.js'
import { texte, rect, cadre, trame, bloc, lueur, borne } from '../dessin.js'

const CASE = 24
const TOP = 88 // debout : le bandeau, puis un palier d'air avant la grille
const BANDE = 20 // hauteur des repères gauche/droite en bas
const BAS = 48 // ce que les repères d'appui réservent sous la grille

/** La grille debout, celle sur laquelle le jeu est réglé depuis le premier jour. */
const REFERENCE = 15 * 21

// Sens rangés dans l'ordre horaire : tourner revient à ±1 sur l'index.
const SENS = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
]

/**
 * La grille remplit ce qui reste de l'écran, dans les deux sens.
 *
 * Debout on retrouve exactement les quinze colonnes sur vingt-et-un rangs
 * d'origine, collées aux bords. Couché, la hauteur est le bien rare : le palier
 * d'air sous le bandeau fond, et la largeur qui reste après le compte des
 * colonnes entières se partage en deux marges.
 */
function dispo(j) {
  const haut = j.paysage ? j.HUD + 8 : TOP
  const cols = Math.floor(j.W / CASE)
  const rangs = Math.floor((j.H - haut - BAS) / CASE)
  return { gauche: Math.floor((j.W - cols * CASE) / 2), haut, cols, rangs }
}

export default {
  id: 'serpent',
  nom: 'SERPENT',
  pitch: 'Appuie à gauche ou à droite pour tourner',
  couleur: C.vert,
  unite: 'pts',
  vies: 3,
  // Une grille sait vivre couchée, mais pas mieux : à surface presque égale,
  // 26 × 10 est une bande où l'on se coince, quand 15 × 21 laisse de la place
  // dans les deux sens. On autorise le format sans le conseiller.
  paysage: true,

  init(j) {
    Object.assign(j.e, dispo(j))
    const { cols, rangs } = j.e

    // Le serpent part le long du grand côté, à six dixièmes de la piste, et
    // remonte vers le mur le plus loin : c'est ce qui lui laisse la plus longue
    // ligne droite avant d'avoir à tourner. Debout, ça redonne case par case le
    // placement d'origine — colonne 7, rangs 12 à 14, tête vers le haut.
    const debout = rangs >= cols
    const piste = debout ? rangs : cols
    const tete = Math.round((piste - 1) * 0.6)
    const travers = Math.floor((debout ? cols : rangs) / 2)
    j.e.sens = debout ? 0 : 3
    j.e.corps = [0, 1, 2].map((i) => (debout ? { x: travers, y: tete + i } : { x: tete + i, y: travers }))

    j.e.enAttente = null // virage demandé pendant le pas en cours
    j.e.pas = 0
    j.e.cadence = 6 // cases par seconde
    // Une case fait vingt-quatre pixels dans les deux formats : à cadence égale
    // le serpent va aussi vite à l'œil, et le temps de lecture d'un pas ne
    // bouge pas. Ce qui change, c'est la surface — 315 cases debout, 260
    // couché. Avec un palier fixe, la grille couchée atteindrait la vitesse
    // maximale avec un serpent proportionnellement plus court, donc bien plus
    // tôt dans la partie. On indexe donc le palier sur la surface : la vitesse
    // maximale tombe au même taux de remplissage dans les deux sens.
    j.e.palier = (0.25 * REFERENCE) / (cols * rangs)
    poseFruit(j)
  },

  /**
   * L'écran a tourné en pleine partie. On recadre, on ne régénère pas : une
   * partie en cours ne se reprend pas sous les pieds du joueur. Le corps est
   * translaté d'un bloc — une translation garde sa forme et ne peut pas
   * superposer deux anneaux — juste assez pour ramener la tête dans la grille,
   * puis coupé au premier anneau resté dehors. La queue disparaît, jamais la
   * tête : c'est elle que le joueur pilote.
   */
  redim(j) {
    Object.assign(j.e, dispo(j))
    const { cols, rangs } = j.e
    const t = j.e.corps[0]
    const ox = borne(t.x, 0, cols - 1) - t.x
    const oy = borne(t.y, 0, rangs - 1) - t.y
    const corps = j.e.corps.map((c) => ({ x: c.x + ox, y: c.y + oy }))
    const dehors = corps.findIndex((c) => c.x < 0 || c.x >= cols || c.y < 0 || c.y >= rangs)
    j.e.corps = dehors < 0 ? corps : corps.slice(0, dehors)
    // Le virage en attente visait l'ancienne grille, et le pas en cours part
    // d'une case qui a bougé : on repart d'un pas net.
    j.e.enAttente = null
    j.e.pas = 0
    j.e.palier = (0.25 * REFERENCE) / (cols * rangs)
    const f = j.e.fruit
    if (f.x >= cols || f.y >= rangs || j.e.corps.some((c) => c.x === f.x && c.y === f.y)) poseFruit(j)
  },

  maj(j, dt) {
    j.e.pas += dt * j.e.cadence
    while (j.e.pas >= 1) {
      j.e.pas -= 1
      avance(j)
      if (j.fini) return
    }
  },

  dessine(j, ctx) {
    const { gauche, haut, cols, rangs } = j.e
    const L = cols * CASE
    const H = rangs * CASE
    trame(ctx, gauche, haut, L, H, CASE, C.panneau)
    cadre(ctx, gauche, haut, L, H, C.bord)

    const f = j.e.fruit
    lueur(ctx, gauche + f.x * CASE + 6, haut + f.y * CASE + 6, 12, 12, C.accent, 3)
    bloc(ctx, gauche + f.x * CASE + 6, haut + f.y * CASE + 6, 12, 12, C.accent, 2)

    // Chaque anneau glisse depuis la case du suivant : le serpent avance au
    // lieu de sauter, alors que la logique reste au tour par tour.
    const k = Math.min(1, j.e.pas)
    j.e.corps.forEach((c, i) => {
      const de = j.e.corps[i + 1] ?? c
      const x = gauche + (de.x + (c.x - de.x) * k) * CASE + 2
      const y = haut + (de.y + (c.y - de.y) * k) * CASE + 2
      if (i === 0) lueur(ctx, x, y, CASE - 4, CASE - 4, C.vert, 2)
      bloc(ctx, x, y, CASE - 4, CASE - 4, i === 0 ? C.vert : ton(C.vert, -0.45), 3)
    })

    // La zone d'appui est indiquée en permanence : le jeu n'a pas de tutoriel.
    rect(ctx, 0, j.H - 34, j.W / 2 - 2, BANDE, C.panneau)
    rect(ctx, j.W / 2 + 2, j.H - 34, j.W / 2 - 2, BANDE, C.panneau)
    texte(ctx, '< GAUCHE', j.W / 4, j.H - 24, 13, C.faible, 700)
    texte(ctx, 'DROITE >', (j.W * 3) / 4, j.H - 24, 13, C.faible, 700)
  },

  appui(j, p) {
    // Un seul virage est mémorisé : sans ça, deux appuis rapides font faire
    // demi-tour au serpent, donc mourir sur soi-même.
    if (j.e.enAttente !== null) return
    j.e.enAttente = p.x < j.W / 2 ? -1 : 1
  },
}

function avance(j) {
  if (j.e.enAttente !== null) {
    j.e.sens = (j.e.sens + j.e.enAttente + 4) % 4
    j.e.enAttente = null
  }

  const d = SENS[j.e.sens]
  const t = j.e.corps[0]
  const tete = { x: t.x + d.x, y: t.y + d.y }

  if (tete.x < 0 || tete.x >= j.e.cols || tete.y < 0 || tete.y >= j.e.rangs) return j.perdu()
  if (j.e.corps.some((c) => c.x === tete.x && c.y === tete.y)) return j.perdu()

  j.e.corps.unshift(tete)

  if (tete.x === j.e.fruit.x && tete.y === j.e.fruit.y) {
    j.score += 10
    j.e.cadence = Math.min(14, j.e.cadence + j.e.palier)
    j.son.ramasse()
    j.fx.eclat(j.e.gauche + tete.x * CASE + CASE / 2, j.e.haut + tete.y * CASE + CASE / 2, C.accent, {
      n: 12,
      vitesse: 110,
      gravite: 0,
    })
    poseFruit(j)
  } else {
    j.e.corps.pop()
  }
}

function poseFruit(j) {
  let f
  do {
    f = { x: j.entier(0, j.e.cols), y: j.entier(0, j.e.rangs) }
  } while (j.e.corps.some((c) => c.x === f.x && c.y === f.y))
  j.e.fruit = f
}
