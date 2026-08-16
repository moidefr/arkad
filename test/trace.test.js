/**
 * TRACÉ : le doigt doit rester dans le tube tant qu'il glisse.
 *
 * Comme pour CORDE, ces tests ne lisent pas l'état interne du jeu pour
 * décider où poser le doigt : ils lisent **ce qui est dessiné** — le repère
 * de couleur d'accent posé sur la ligne de jugement — comme le ferait un
 * joueur qui regarde son écran.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import trace from '../src/court/trace.js'
import { C } from '../src/palette.js'
import { fauxJeu, fauxCtx, PAS } from './faux.js'

/** Ce qu'un joueur voit : le centre du tube sur la ligne de jugement. */
function regarde(ops) {
  const repere = ops.find((o) => o.type === 'rect' && o.couleur === C.accent && o.w === 8 && o.h === 8)
  return { cx: repere ? repere.x + 4 : null }
}

/** Joue une partie en ne posant le doigt que là où l'écran montre le tube. */
function partie({ duree = 30, maintenu = true }) {
  const j = fauxJeu(trace, { graine: 1 })
  const ctx = fauxCtx()

  while (j.t < duree && !j.fini) {
    ctx.ops.length = 0
    trace.dessine(j, ctx)
    const vu = regarde(ctx.ops)
    j.maintenu = maintenu
    if (vu.cx !== null) j.pointer.x = vu.cx

    trace.maj(j, PAS)
    j.t += PAS
  }

  return { j, mort: j.fini }
}

test('le repère du tube est toujours visible, dans l’écran', () => {
  const j = fauxJeu(trace, { graine: 1 })
  const ctx = fauxCtx()
  j.maintenu = true
  for (let i = 0; i < 600; i++) {
    trace.maj(j, PAS)
    ctx.ops.length = 0
    trace.dessine(j, ctx)
    const vu = regarde(ctx.ops)
    assert.ok(vu.cx !== null, 'le repère du tube est introuvable à l’écran')
    assert.ok(vu.cx > 0 && vu.cx < j.W, `le repère sort de l’écran (x=${vu.cx})`)
  }
})

test('suivre fidèlement le centre du tube fait survivre — trente secondes', () => {
  const { j, mort } = partie({ duree: 30 })
  assert.equal(mort, false, `mort au bout de ${j.t.toFixed(1)} s en suivant le repère affiché`)
  assert.ok(j.score > 0, 'aucun score gagné en suivant le tube')
  assert.ok(j.e.dist > 1000, `distance parcourue trop faible (${j.e.dist.toFixed(0)}) pour trente secondes de suivi`)
})

test('rester immobile loin du tube fait perdre une vie', () => {
  const j = fauxJeu(trace, { graine: 1 })
  j.maintenu = true
  j.pointer.x = 2 // collé au bord gauche, largement hors tolérance dès que le tube bouge
  let t = 0
  while (t < 15 && !j.fini) {
    trace.maj(j, PAS)
    t += PAS
  }
  assert.equal(j.fini, true, 'rester loin du tube en glissant devrait finir par coûter une vie')
})

test('relâcher arrête le tracé et ne fait pas perdre', () => {
  const j = fauxJeu(trace, { graine: 1 })
  j.maintenu = false
  j.pointer.x = 2 // hors tube, mais le doigt n'est pas posé
  for (let i = 0; i < 600; i++) trace.maj(j, PAS)
  assert.equal(j.fini, false, 'ne rien poser ne doit jamais coûter une vie')
  assert.equal(j.e.dist, 0, 'le tube a avancé sans que le doigt soit posé')
})

test('une vie perdue recule la distance, elle ne la remet pas à zéro', () => {
  const j = fauxJeu(trace, { graine: 1 })
  j.e.dist = 900
  trace.reprend(j)
  assert.ok(j.e.dist > 0, 'la distance est retombée à zéro, toute la difficulté gagnée est effacée')
  assert.ok(j.e.dist < 900, 'une chute doit quand même coûter quelque chose')
  assert.equal(j.e.endurance, 1)
})
