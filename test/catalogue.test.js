/**
 * Le contrat que tout jeu doit tenir avec le moteur. Ces tests ne jugent aucun
 * gameplay : ils attrapent les fautes qui font qu'un jeu ne démarre pas, ou
 * qu'il en écrase un autre dans le stockage.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CATEGORIES, TOUS } from '../src/catalogue.js'
import { fauxJeu, fauxCtx, PAS } from './faux.js'

test('chaque jeu déclare sa fiche', () => {
  for (const jeu of TOUS) {
    assert.match(jeu.id, /^[a-zA-Z][a-zA-Z-]*$/, `id invalide : ${jeu.id}`)
    assert.ok(jeu.nom?.length, `${jeu.id} : pas de nom`)
    assert.ok(jeu.pitch?.length, `${jeu.id} : pas de pitch`)
    assert.match(jeu.couleur ?? '', /^#[0-9a-f]{6}$/i, `${jeu.id} : couleur invalide`)
    assert.equal(typeof jeu.dessine, 'function', `${jeu.id} : pas de dessine`)
    // Un jeu sans score doit dire ce qu'il affiche à la place ; sinon il lui
    // faut une unité, c'est elle qui légende le compteur.
    if (jeu.sansScore) assert.equal(typeof jeu.titreHud, 'function', `${jeu.id} : sansScore sans titreHud`)
    else assert.ok(jeu.unite?.length, `${jeu.id} : pas d'unité`)
  }
})

test("les identifiants sont uniques — c'est la clé de sauvegarde", () => {
  const vus = new Map()
  for (const jeu of TOUS) {
    assert.equal(vus.has(jeu.id), false, `id en double : ${jeu.id}`)
    vus.set(jeu.id, jeu)
  }
})

test('chaque catégorie annonce une durée et au moins un jeu', () => {
  for (const cat of CATEGORIES) {
    assert.ok(cat.duree?.length, `${cat.id} : pas de durée annoncée`)
    assert.ok(cat.jeux.length > 0, `${cat.id} : catégorie vide`)
  }
})

test('un jeu survit à trois secondes sans joueur', () => {
  for (const jeu of TOUS) {
    const j = fauxJeu(jeu, { graine: 7 })
    const ctx = fauxCtx()
    for (let i = 0; i < 180 && !j.fini; i++) {
      jeu.maj?.(j, PAS)
      ctx.ops.length = 0
      jeu.dessine(j, ctx)
      j.t += PAS
    }
    assert.ok(Number.isFinite(j.score), `${jeu.id} : score devenu ${j.score}`)
  }
})

test('un jeu survit à des appuis au hasard partout sur l’écran', () => {
  for (const jeu of TOUS) {
    const j = fauxJeu(jeu, { graine: 23 })
    const ctx = fauxCtx()
    for (let i = 0; i < 240; i++) {
      if (j.fini) {
        // Une partie perdue se rejoue : c'est ce que fait le moteur.
        j.fini = false
        ;(jeu.reprend ?? jeu.init)?.(j)
      }
      j.pointer.x = j.entier(0, 361)
      j.pointer.y = j.entier(0, 641)
      if (i % 3 === 0) jeu.appui?.(j, j.pointer)
      if (i % 3 === 1) jeu.relache?.(j, j.pointer)
      jeu.maj?.(j, PAS)
      ctx.ops.length = 0
      jeu.dessine(j, ctx)
      j.t += PAS
    }
  }
})
