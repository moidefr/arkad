/**
 * Les deux promesses du système de thèmes, et rien d'autre.
 *
 * 1. **Le phosphore n'a pas bougé.** C'est le thème d'origine ; le jour où une
 *    retouche de `dessin.js` le change sans qu'on le veuille, ce fichier le
 *    dit. Les vingt-six jeux sont réglés à l'œil sur ce rendu-là.
 * 2. **La disposition ne dépend pas du thème.** Un thème change la peinture,
 *    jamais une mesure — c'est ce qui permet de basculer en pleine partie, et
 *    c'est ce qui fait que les tests d'écran des jeux couvrent les deux thèmes
 *    sans avoir à être écrits deux fois.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fauxCtx, fauxJeu } from './faux.js'
import { theme, THEMES, IDS } from '../src/theme.js'
import { C } from '../src/palette.js'
import * as D from '../src/dessin.js'

/** Rejoue une scène sous un thème donné, puis remet le thème d'avant. */
function sous(id, scene) {
  const avant = theme.id
  theme.choisis(id)
  const ctx = fauxCtx()
  try {
    scene(ctx)
  } finally {
    theme.choisis(avant)
  }
  return ctx.ops
}

/** Ce qu'une op occupe à l'écran, sans sa couleur ni sa façon d'être peinte. */
const place = (o) =>
  o.type === 'texte'
    ? `texte ${o.s} ${Math.round(o.x)},${Math.round(o.y)}`
    : `${Math.round(o.x)},${Math.round(o.y)} ${Math.round(o.w)}x${Math.round(o.h)}`

// Une scène qui touche chaque primitive sensible au thème.
const SCENE = (ctx) => {
  D.rect(ctx, 10, 20, 100, 40, C.panneau)
  D.cadre(ctx, 10, 20, 100, 40, C.bord)
  D.bloc(ctx, 20, 70, 60, 30, C.cyan)
  D.pastille(ctx, 200, 90, 12, C.vert)
  D.lueur(ctx, 20, 70, 60, 30, C.accent)
  D.texte(ctx, 'ARKAD', 180, 40, 14, C.texte)
  D.trame(ctx, 0, 120, 200, 60, 8, C.bord)
  D.scanlines(ctx, 360, 640)
  D.vignette(ctx, 360, 640)
}

test('le phosphore reste le thème par défaut', () => {
  assert.equal(IDS[0], 'phosphore')
  assert.equal(THEMES.phosphore.arrondi, 0)
  assert.equal(THEMES.phosphore.relief, 'arete')
  assert.ok(THEMES.phosphore.trame)
})

test('sous le phosphore, rien n’est peint par chemin', () => {
  // Le tracé de chemin est le mécanisme du thème moderne. S'il apparaît sous
  // le phosphore, c'est qu'une primitive a changé de manière de peindre — et
  // le rendu d'origine a bougé, même si les rectangles se ressemblent.
  const ops = sous('phosphore', SCENE)
  assert.equal(
    ops.filter((o) => o.r !== undefined || o.disque || o.type === 'trait').length,
    0,
    'le phosphore doit peindre en fillRect, pas en fill()/stroke()',
  )
})

test('le phosphore garde exactement sa palette d’origine', () => {
  const avant = theme.id
  theme.choisis('moderne')
  theme.choisis('phosphore')
  try {
    assert.equal(C.fond, '#0b0e0d')
    assert.equal(C.accent, '#ffb43c')
    assert.equal(C.texte, '#d6e0d9')
  } finally {
    theme.choisis(avant)
  }
})

test('changer de thème ne déplace ni ne redimensionne quoi que ce soit', () => {
  // Ce n'est pas la liste des ops qu'on compare — un thème a le droit de
  // peindre un cadre en un trait là où l'autre pose quatre bandes, c'est
  // exactement ce qu'on lui demande. Ce qui ne doit pas bouger, c'est
  // **l'emprise** de chaque primitive : la surface qu'elle occupe à l'écran.
  const emprise = (ops) => {
    if (!ops.length) return null
    const x = Math.min(...ops.map((o) => o.x))
    const y = Math.min(...ops.map((o) => o.y))
    return {
      x: Math.round(x),
      y: Math.round(y),
      w: Math.round(Math.max(...ops.map((o) => o.x + (o.w ?? o.larg ?? 0))) - x),
      h: Math.round(Math.max(...ops.map((o) => o.y + (o.h ?? o.taille ?? 0))) - y),
    }
  }

  const PRIMITIVES = {
    rect: (ctx) => D.rect(ctx, 10, 20, 100, 40, C.panneau),
    cadre: (ctx) => D.cadre(ctx, 10, 20, 100, 40, C.bord),
    bloc: (ctx) => D.bloc(ctx, 20, 70, 60, 30, C.cyan),
    pastille: (ctx) => D.pastille(ctx, 200, 90, 12, C.vert),
    lueur: (ctx) => D.lueur(ctx, 20, 70, 60, 30, C.accent),
    texte: (ctx) => D.texte(ctx, 'ARKAD', 180, 40, 14, C.texte),
    trame: (ctx) => D.trame(ctx, 0, 120, 200, 60, 8, C.bord),
  }

  for (const [nom, appel] of Object.entries(PRIMITIVES)) {
    assert.deepEqual(
      emprise(sous('moderne', appel)),
      emprise(sous('phosphore', appel)),
      `${nom} n’occupe pas la même place d’un thème à l’autre`,
    )
  }
})

test('le thème moderne peint bien autrement', () => {
  const ops = sous('moderne', SCENE)
  assert.ok(
    ops.some((o) => o.r > 0),
    'des coins arrondis',
  )
  assert.ok(
    ops.some((o) => o.disque),
    'un vrai disque plutôt qu’un escalier',
  )
  assert.notEqual(THEMES.moderne.couleurs.fond, THEMES.phosphore.couleurs.fond)
})

test('un thème ne déclare aucune mesure', () => {
  // Le garde-fou de conception : le jour où quelqu'un ajoute `marge: 8` à un
  // thème, ce test tombe et la discussion a lieu avant que la disposition ne
  // se mette à dépendre de la peinture.
  const AUTORISES = new Set([
    'id',
    'nom',
    'pitch',
    'couleurs',
    'arrondi',
    'relief',
    'halo',
    'trame',
    'balayage',
    'vignette',
  ])
  for (const id of IDS) {
    for (const cle of Object.keys(THEMES[id])) {
      assert.ok(AUTORISES.has(cle), `${id} déclare « ${cle} », qui n’est pas un trait de peinture connu`)
    }
  }
})

test('les deux thèmes portent exactement les mêmes couleurs', () => {
  const cles = (id) => Object.keys(THEMES[id].couleurs).sort()
  assert.deepEqual(cles('moderne'), cles('phosphore'))
})

test('un jeu se dessine sous les deux thèmes sans rien casser', async () => {
  const { default: jeu } = await import('../src/long/breche/index.js')
  for (const id of IDS) {
    const j = fauxJeu(jeu)
    const ops = sous(id, (ctx) => jeu.dessine(j, ctx))
    assert.ok(ops.length > 20, `${id} : l’écran est vide`)
  }
})
