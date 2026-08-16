/**
 * Le routage entre l'URL et l'état de la borne. Comme `format.js`, aucun
 * DOM : on prouve l'aller et le retour sur le vrai catalogue, pas sur des
 * exemples choisis à la main.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { depuisChemin, cheminDe } from '../src/route.js'
import { CATEGORIES, TOUS } from '../src/catalogue.js'

test('la racine ne résout ni catégorie ni jeu', () => {
  for (const chemin of ['/', '', '//']) {
    assert.deepEqual(depuisChemin(chemin), { cat: null, def: null }, chemin)
  }
})

test('chaque catégorie réelle se résout depuis son chemin, avec ou sans barre finale', () => {
  for (const cat of CATEGORIES) {
    assert.deepEqual(depuisChemin(`/${cat.id}/`), { cat, def: null })
    assert.deepEqual(depuisChemin(`/${cat.id}`), { cat, def: null })
  }
})

test('chaque jeu réel se résout depuis son chemin, catégorie comprise', () => {
  for (const cat of CATEGORIES) {
    for (const jeu of cat.jeux) {
      assert.deepEqual(depuisChemin(`/${cat.id}/${jeu.id}/`), { cat, def: jeu })
    }
  }
})

test('une catégorie inconnue ne résout rien : l’appelant retombe sur l’accueil', () => {
  assert.equal(depuisChemin('/inexistante/'), null)
})

test('un jeu inconnu dans une catégorie connue retombe sur la catégorie, pas sur l’accueil', () => {
  const cat = CATEGORIES[0]
  assert.deepEqual(depuisChemin(`/${cat.id}/ce-jeu-n-existe-pas/`), { cat, def: null })
})

test('doubles barres et segments en trop sont tolérés', () => {
  const cat = CATEGORIES[0]
  const jeu = cat.jeux[0]
  assert.deepEqual(depuisChemin(`//${cat.id}//${jeu.id}//`), { cat, def: jeu })
  assert.deepEqual(depuisChemin(`/${cat.id}/${jeu.id}/rien/a/voir/`), { cat, def: jeu })
})

test('cheminDe est l’inverse exact de depuisChemin, pour tout le catalogue', () => {
  assert.equal(cheminDe(null, null), '/')
  for (const cat of CATEGORIES) {
    assert.equal(cheminDe(cat, null), `/${cat.id}/`)
    assert.deepEqual(depuisChemin(cheminDe(cat, null)), { cat, def: null })
    for (const jeu of cat.jeux) {
      const chemin = cheminDe(cat, jeu)
      assert.equal(chemin, `/${cat.id}/${jeu.id}/`)
      assert.deepEqual(depuisChemin(chemin), { cat, def: jeu })
    }
  }
})

test('tout jeu de TOUS s’identifie sans ambiguïté par son chemin', () => {
  for (const jeu of TOUS) {
    const cat = CATEGORIES.find((c) => c.jeux.includes(jeu))
    assert.deepEqual(depuisChemin(cheminDe(cat, jeu)), { cat, def: jeu })
  }
})
