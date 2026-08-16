/**
 * GESTE lit une intention à l'écran (un repère planté à la pointe d'une
 * flèche) et sanctionne le geste réel du joueur. Ces tests ne lisent jamais
 * `j.e.dir` : ils décodent le sens demandé depuis `ctx.ops`, comme le ferait
 * un joueur qui ne voit que l'écran — exactement la discipline de
 * `test/corde.test.js`.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import geste from '../src/court/geste.js'
import { C } from '../src/palette.js'
import { fauxJeu, fauxCtx, PAS } from './faux.js'

// Doit rester égal à CY dans src/court/geste.js : le signe est toujours
// dessiné à cette hauteur fixe, comme SOL l'est pour CORDE.
const CY = 260

/** Le sens demandé : le seul carré plein de 6×6 en couleur d'accent. */
function regarde(j, ctx) {
  const marque = ctx.ops.find((o) => o.type === 'rect' && o.couleur === C.accent && o.w === 6 && o.h === 6)
  if (!marque) return null
  const dx = marque.x + 3 - j.W / 2
  const dy = marque.y + 3 - CY
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'droite' : 'gauche'
  return dy > 0 ? 'bas' : 'haut'
}

const VECTEURS = { haut: { x: 0, y: -1 }, bas: { x: 0, y: 1 }, gauche: { x: -1, y: 0 }, droite: { x: 1, y: 0 } }

function dessineEtLis(j, ctx) {
  ctx.ops.length = 0
  geste.dessine(j, ctx)
  return regarde(j, ctx)
}

/** Joue le geste donné (départ au centre du signe, arrivée décalée de `ampleur`). */
function joueGeste(j, sens, ampleur) {
  const v = VECTEURS[sens]
  const centre = { x: j.W / 2, y: CY }
  geste.appui(j, centre)
  geste.relache(j, { x: centre.x + v.x * ampleur, y: centre.y + v.y * ampleur })
}

test('un micro-mouvement de 3px ne compte jamais comme un geste valide', () => {
  const j = fauxJeu(geste, { graine: 1 })
  const ctx = fauxCtx()
  const sens = dessineEtLis(j, ctx)
  assert.ok(sens, 'aucun repère de direction trouvé à l’écran')

  // Même dans le bon sens, 3 px reste sous le seuil de 8 px.
  joueGeste(j, sens, 3)

  assert.equal(j.score, 0, 'un micro-mouvement a rapporté un point')
  assert.equal(j.fini, true, 'un micro-mouvement aurait dû compter comme un raté')
})

test('un geste net dans la bonne direction est reconnu', () => {
  const j = fauxJeu(geste, { graine: 1 })
  const ctx = fauxCtx()
  const sens = dessineEtLis(j, ctx)
  assert.ok(sens, 'aucun repère de direction trouvé à l’écran')

  joueGeste(j, sens, 40)

  assert.equal(j.fini, false, `un geste net et correct (${sens}) a été sanctionné`)
  assert.equal(j.score, 1, 'le point n’a pas été compté')
})

test('un geste net mais dans le mauvais sens coûte une vie', () => {
  const j = fauxJeu(geste, { graine: 1 })
  const ctx = fauxCtx()
  const sens = dessineEtLis(j, ctx)
  const autre = Object.keys(VECTEURS).find((s) => s !== sens)

  joueGeste(j, autre, 40)

  assert.equal(j.fini, true, 'un mauvais sens aurait dû coûter une vie')
  assert.equal(j.score, 0)
})

test('ne rien faire jusqu’à la fin de la fenêtre coûte une vie', () => {
  const j = fauxJeu(geste, { graine: 1 })
  let t = 0
  while (t < 5 && !j.fini) {
    geste.maj(j, PAS)
    t += PAS
  }
  assert.equal(j.fini, true, 'trop lent aurait dû coûter une vie')
})

test('obéir à l’écran, geste après geste, fait tenir la partie', () => {
  const j = fauxJeu(geste, { graine: 7 })
  const ctx = fauxCtx()
  let manches = 0

  while (j.t < 20 && !j.fini && manches < 12) {
    const sens = dessineEtLis(j, ctx)
    assert.ok(sens, `aucun repère lisible à t=${j.t.toFixed(2)}`)
    joueGeste(j, sens, 50)
    assert.equal(j.fini, false, `mort après un geste net et correct (${sens})`)
    manches++
    // On laisse la brève pause de réussite s'écouler avant le prochain signe.
    for (let i = 0; i < 30 && j.e.pause > 0; i++) {
      geste.maj(j, PAS)
      j.t += PAS
    }
  }

  assert.ok(manches >= 8, `seulement ${manches} manches réussies en 20 s de jeu obéissant`)
  assert.equal(j.score, manches)
})
