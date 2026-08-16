/**
 * SUDOKU : tout se joue dans `genere`, en pur calcul — pas de canvas ici.
 *
 * Deux choses doivent être vraies pour que la grille soit jouable : la
 * grille de départ n'a qu'une seule façon de se compléter (sinon deux joueurs
 * honnêtes peuvent finir sur des grilles différentes, toutes deux « justes »),
 * et aucune case posée au départ n'est déjà en conflit avec une autre.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import sudoku, { genere, compteSolutions, enConflit } from '../src/moyen/sudoku.js'
import { C } from '../src/palette.js'
import { graine, fauxJeu, fauxCtx, joue } from './faux.js'

const N = 6

test('une grille générée n’a qu’une seule solution', () => {
  for (let g = 1; g <= 8; g++) {
    const { depart } = genere(graine(g))
    assert.equal(compteSolutions(depart, 2), 1, `graine ${g}`)
  }
})

test('la solution complète est elle-même valide et sans conflit', () => {
  for (let g = 1; g <= 8; g++) {
    const { solution } = genere(graine(g))
    assert.equal(solution.length, N * N)
    assert.ok(solution.every((v) => v >= 1 && v <= N))
    for (let i = 0; i < solution.length; i++) assert.equal(enConflit(solution, i), false)
  }
})

test('la grille de départ ne contient aucun doublon ligne / colonne / bloc', () => {
  for (let g = 1; g <= 8; g++) {
    const { depart } = genere(graine(g))
    for (let i = 0; i < depart.length; i++) {
      if (depart[i]) assert.equal(enConflit(depart, i), false, `case ${i}, graine ${g}`)
    }
  }
})

test('la grille de départ est un sous-ensemble de la solution, avec des cases vides', () => {
  for (let g = 1; g <= 8; g++) {
    const { solution, depart } = genere(graine(g))
    let vides = 0
    for (let i = 0; i < depart.length; i++) {
      if (depart[i] === 0) vides++
      else assert.equal(depart[i], solution[i], `case ${i}, graine ${g}`)
    }
    assert.ok(vides > 0, 'il doit rester des cases à remplir')
    assert.ok(vides < depart.length, 'il doit rester des indices')
  }
})

test('compteSolutions distingue une grille truquée à deux solutions', () => {
  // Une grille presque vide (une seule case posée) admet forcément plusieurs
  // remplissages : compteSolutions doit s'arrêter à la limite, pas y croire seule.
  const presqueVide = new Array(N * N).fill(0)
  presqueVide[0] = 1
  assert.ok(compteSolutions(presqueVide, 2) >= 2)
})

// --- Partie simulée : le module complet, tel que le catalogue l'importera ---

test('une partie simulée ne plante jamais, ne produit aucun NaN, et un appui n’importe où ne casse rien', () => {
  const rng = graine(42)
  const { j, ctx } = joue(sudoku, {
    duree: 20,
    dessine: true,
    graine: 7,
    pilote(j) {
      // Un tir aléatoire sur tout l'écran, HUD compris : le contrat exige que
      // appui() ne crashe jamais, où qu'on tape.
      j.pointer = { x: rng() * j.W, y: rng() * j.H }
      return rng() < 0.5 ? 'appui' : null
    },
  })

  assert.equal(j.e.grille.length, N * N)
  for (const v of j.e.grille) assert.ok(Number.isFinite(v))
  assert.ok(Number.isFinite(j.score))
  assert.ok(Number.isFinite(j.t))

  for (const o of ctx.ops) {
    if ('x' in o) assert.ok(Number.isFinite(o.x), o.type)
    if ('y' in o) assert.ok(Number.isFinite(o.y), o.type)
  }
})

test('remplir correctement toute la grille déclenche la victoire', () => {
  const j = fauxJeu(sudoku, { graine: 3 })
  const ctx = fauxCtx()

  // On triche à bon escient : on lit la solution reconstituée depuis l'état
  // du jeu lui-même est impossible (elle n'est pas conservée), donc on
  // regénère avec la même graine que verrait le moteur pour connaître la cible.
  const { solution } = genere(graine(3))

  for (let i = 0; i < solution.length; i++) {
    if (j.e.fixe[i]) continue
    // On appelle la logique de remplissage via le pavé simulé, exactement
    // comme un joueur : un appui sur la case, puis un appui sur le chiffre.
    const x0 = Math.round((j.W - 6 * 46) / 2)
    sudoku.appui(j, { x: x0 + (i % N) * 46 + 5, y: 132 + Math.floor(i / N) * 46 + 5 })
    const px = x0 + (solution[i] - 1) * 46 + 5
    const py = 132 + N * 46 + 30 + 5
    sudoku.appui(j, { x: px, y: py })
  }

  sudoku.dessine(j, ctx)
  assert.ok(j.fini)
  assert.equal(j.e.grille.every((v, i) => v === solution[i]), true)
  assert.ok(Number.isFinite(j.score))
  assert.deepEqual(sudoku.finTitre(j), { texte: 'RÉSOLU', couleur: C.accent })
})
