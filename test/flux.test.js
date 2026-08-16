/**
 * FLUX : la génération se joue toute en pur calcul — pas de canvas ici.
 *
 * Ce qui doit être vrai pour que la grille soit jouable : chaque case
 * appartient à exactement un chemin (un pavage complet, aucune case
 * orpheline), chaque chemin a exactement deux extrémités, et deux chemins ne
 * se chevauchent jamais.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import flux, { genere } from '../src/moyen/flux.js'
import { C } from '../src/palette.js'
import { graine, joue } from './faux.js'

const TAILLES = [5, 6, 7, 8]

test('chaque case appartient à exactement un chemin, pour toutes les tailles', () => {
  for (const n of TAILLES) {
    for (let g = 1; g <= 8; g++) {
      const chemins = genere(n, 4, graine(g))
      const compte = new Array(n * n).fill(0)
      for (const chemin of chemins) for (const cellule of chemin) compte[cellule]++
      assert.ok(
        compte.every((c) => c === 1),
        `n=${n}, graine ${g} : une case orpheline ou dupliquée`,
      )
    }
  }
})

test('chaque chemin a exactement deux extrémités distinctes', () => {
  for (const n of TAILLES) {
    for (let g = 1; g <= 8; g++) {
      const chemins = genere(n, 4, graine(g))
      for (const chemin of chemins) {
        assert.ok(chemin.length >= 2, `n=${n}, graine ${g} : chemin trop court`)
        assert.notEqual(chemin[0], chemin[chemin.length - 1])
      }
    }
  }
})

test('deux chemins ne se chevauchent jamais', () => {
  for (const n of TAILLES) {
    for (let g = 1; g <= 8; g++) {
      const chemins = genere(n, 4, graine(g))
      const vues = new Set()
      for (const chemin of chemins) {
        for (const cellule of chemin) {
          assert.ok(!vues.has(cellule), `n=${n}, graine ${g} : case ${cellule} vue deux fois`)
          vues.add(cellule)
        }
      }
      assert.equal(vues.size, n * n)
    }
  }
})

test('un chemin est une suite de cases réellement voisines sur la grille', () => {
  for (const n of TAILLES) {
    for (let g = 1; g <= 8; g++) {
      const chemins = genere(n, 4, graine(g))
      for (const chemin of chemins) {
        for (let i = 1; i < chemin.length; i++) {
          const a = chemin[i - 1]
          const b = chemin[i]
          const ac = a % n
          const ar = Math.floor(a / n)
          const bc = b % n
          const br = Math.floor(b / n)
          const voisin = (ac === bc && Math.abs(ar - br) === 1) || (ar === br && Math.abs(ac - bc) === 1)
          assert.ok(voisin, `n=${n}, graine ${g} : ${a} -> ${b} ne sont pas voisines`)
        }
      }
    }
  }
})

test('le nombre de chemins demandé est bien celui obtenu', () => {
  for (const k of [2, 3, 4, 5]) {
    const chemins = genere(6, k, graine(k))
    assert.equal(chemins.length, k)
  }
})

// --- Partie simulée : le module complet, tel que le catalogue l'importera ---

test('une partie simulée ne plante jamais, ne produit aucun NaN, et un appui n’importe où ne casse rien', () => {
  const rng = graine(11)
  const { j, ctx } = joue(flux, {
    duree: 25,
    dessine: true,
    graine: 5,
    pilote(j) {
      // Un tir aléatoire sur tout l'écran, HUD compris, avec des relâchements
      // entrecoupés : le contrat exige qu'appui()/relache() ne crashent jamais.
      j.pointer = { x: rng() * j.W, y: rng() * j.H }
      j.maintenu = rng() < 0.7
      return rng() < 0.15 ? 'appui' : rng() < 0.05 ? 'relache' : null
    },
  })

  assert.ok(Number.isFinite(j.score))
  assert.ok(Number.isFinite(j.t))
  assert.ok(Number.isFinite(j.e.n))
  for (const v of j.e.grille) assert.ok(Number.isFinite(v))

  for (const o of ctx.ops) {
    if ('x' in o) assert.ok(Number.isFinite(o.x), o.type)
    if ('y' in o) assert.ok(Number.isFinite(o.y), o.type)
  }
})

test('relier toutes les paires en suivant la solution déclenche la victoire', () => {
  const { j } = joue(flux, {
    duree: 60,
    pilote(j) {
      // On triche à bon escient : `j.e.solution` est exactement le pavage qui
      // a servi à poser les extrémités (voir poseNiveau dans flux.js), donc le
      // suivre case par case reproduit ce que ferait un joueur parfait, et
      // garantit — par construction — qu'aucune case ne reste vide à la fin.
      if (j.e.fanfare > 0) return null // le fondu du changement de niveau ignore les appuis
      // `j.e.solution` change d'identité à chaque nouveau niveau : c'est le
      // signal pour reconstruire le plan plutôt que de continuer sur l'ancien.
      if (!j.e.plan || j.e.plan.solution !== j.e.solution) {
        j.e.plan = { solution: j.e.solution, etapes: j.e.solution.map((chemin) => ({ chemin, pas: 0 })), idx: 0 }
      }
      const plan = j.e.plan
      const etape = plan.etapes[plan.idx]
      if (!etape) return null

      const cell = etape.chemin[etape.pas]
      const { x0, y0, case_, n } = j.e
      j.pointer = { x: x0 + (cell % n) * case_ + case_ / 2, y: y0 + Math.floor(cell / n) * case_ + case_ / 2 }
      j.maintenu = true

      if (etape.pas === 0) {
        etape.pas++
        return 'appui'
      }
      etape.pas++
      // `maj` traite ce dernier pas dans la même image, avant qu'on ne
      // regarde `plan.idx` au prochain appel : avancer ici ne casse rien.
      if (etape.pas >= etape.chemin.length) plan.idx++
      return null
    },
  })

  assert.ok(j.fini)
  assert.ok(Number.isFinite(j.score))
  assert.deepEqual(flux.finTitre(j), { texte: 'RÉSOLU', couleur: C.cyan })
})
