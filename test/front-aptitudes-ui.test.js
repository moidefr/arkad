/**
 * L'aide d'affichage des aptitudes, partagée entre la fiche et le panneau de
 * combat (lot 5) : une fonction pure pour l'état d'expansion, un rendu qui
 * ne descend jamais sous le plancher du doigt.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { bascule, ligneApt, descriptionApt } from '../src/massif/front/vue/aptitudes-ui.js'
import { APT } from '../src/massif/front/donnees/aptitudes.js'
import { C } from '../src/palette.js'
import { fauxCtx } from './faux.js'

test('bascule ajoute puis retire, sans muter l’ensemble reçu', () => {
  const vide = new Set()
  const un = bascule(vide, 'charge')
  assert.equal(vide.size, 0, 'l’ensemble d’origine a été muté')
  assert.ok(un.has('charge'))
  const deux = bascule(un, 'charge')
  assert.ok(!deux.has('charge'))
})

test('descriptionApt rend le texte de l’aptitude, une chaîne vide pour un id inconnu', () => {
  assert.equal(descriptionApt('charge'), APT.charge.texte)
  assert.equal(descriptionApt('n’existe pas'), '')
})

test('une ligne repliée ne descend jamais sous le plancher du doigt, et s’ouvre plus grande', () => {
  const ctx = fauxCtx()
  const apt = APT.charge
  const repliee = ligneApt(ctx, 10, 10, 300, apt, false)
  assert.ok(repliee >= 30, `${repliee} px de haut, trop bas pour un doigt`)
  const ouverte = ligneApt(ctx, 10, 10, 300, apt, true)
  assert.ok(ouverte > repliee, 'ouvrir l’aptitude ne change pas la hauteur')
})

test('un ordre se peint en violet, une passive en accent', () => {
  // La pastille est le tout premier trait posé par ligneApt() — un rectangle
  // (ou un arc, selon le thème), jamais du texte.
  const ctxOrdre = fauxCtx()
  ligneApt(ctxOrdre, 10, 10, 300, APT.sprint, false)
  const ctxPassif = fauxCtx()
  ligneApt(ctxPassif, 10, 10, 300, APT.charge, false)
  assert.equal(ctxOrdre.ops[0].couleur, C.violet, 'un ordre ne se peint pas en violet')
  assert.equal(ctxPassif.ops[0].couleur, C.accent, 'une passive ne se peint pas en accent')
})
