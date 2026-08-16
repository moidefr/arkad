/**
 * Les deux gabarits, et les écrans du moteur dans chacun.
 *
 * Le moteur calcule chaque disposition avec **une seule fonction**, utilisée à
 * la fois par le dessin et par le test de clic. Ce test vérifie que ces
 * fonctions rendent, dans les deux formats, des rectangles qui tiennent dans
 * l'écran, ne se recouvrent pas, et restent assez gros pour un doigt.
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { FORMATS, HUD, orientationAppareil, formatPour, tailleDe, suggestion, estTactile } from '../src/format.js'
import {
  dispoAccueil,
  carteAccueil,
  dispoTuiles,
  tuile,
  dispoRangees,
  rangee,
  dispoMenu,
  boutonMenu,
  dispoSon,
  enRangees,
} from '../src/engine.js'
import { CATEGORIES, TOUS } from '../src/catalogue.js'

const GABARITS = [FORMATS.portrait, FORMATS.paysage]

const dedans = (z, t) => z.x >= 0 && z.y >= HUD - 44 && z.x + z.w <= t.W && z.y + z.h <= t.H
const chevauche = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

const verifie = (zones, t, nom) => {
  for (const z of zones) {
    assert.ok(dedans(z, t), `${nom} ${t.W}×${t.H} : une zone déborde (${z.x},${z.y} ${z.w}×${z.h})`)
    assert.ok(z.w >= 44 && z.h >= 30, `${nom} ${t.W}×${t.H} : zone de ${z.w}×${z.h}, trop petite pour un doigt`)
  }
  for (let i = 0; i < zones.length; i++) {
    for (let k = i + 1; k < zones.length; k++) {
      assert.ok(!chevauche(zones[i], zones[k]), `${nom} ${t.W}×${t.H} : deux zones se recouvrent`)
    }
  }
}

// --- Les formats ---------------------------------------------------------------

test('les deux gabarits sont l’un le miroir de l’autre', () => {
  assert.deepEqual(FORMATS.portrait, { W: 360, H: 640 })
  assert.deepEqual(FORMATS.paysage, { W: 640, H: 360 })
  assert.equal(tailleDe('inconnu'), FORMATS.portrait, 'un format inconnu retombe sur le portrait')
})

test('l’orientation a de la marge : un écran presque carré ne clignote pas', () => {
  assert.equal(orientationAppareil(390, 844), 'portrait')
  assert.equal(orientationAppareil(844, 390), 'paysage')
  assert.equal(orientationAppareil(800, 780), 'portrait', 'presque carré : on ne bascule pas')
  assert.equal(orientationAppareil(1280, 800), 'paysage')
})

test('estTactile lit le pointeur principal, pas la taille de la fenêtre', () => {
  const avant = globalThis.matchMedia
  try {
    globalThis.matchMedia = (q) => ({ matches: q === '(pointer: coarse)' })
    assert.equal(estTactile(), true, 'un doigt (pointeur grossier) doit se reconnaître')
    globalThis.matchMedia = () => ({ matches: false })
    assert.equal(estTactile(), false, 'une souris (pointeur fin) ne doit jamais passer pour un doigt')
    delete globalThis.matchMedia
    assert.equal(estTactile(), true, 'sans matchMedia, on ne prive personne de la suggestion par défaut')
  } finally {
    globalThis.matchMedia = avant
  }
})

test('un jeu ne passe en paysage que s’il sait le faire', () => {
  assert.equal(formatPour({ paysage: true }, 'paysage'), 'paysage')
  assert.equal(formatPour({ paysage: true }, 'portrait'), 'portrait')
  assert.equal(formatPour({}, 'paysage'), 'portrait', 'un jeu portrait reste portrait, même couché')
  assert.equal(formatPour(null, 'paysage'), 'portrait')
})

test('la suggestion ne se déclenche que dans les deux cas qui le méritent', () => {
  // Couché devant un jeu qui ne sait pas l'être : il va se retrouver dans une
  // bande étroite, on conseille de redresser.
  assert.equal(suggestion({ nom: 'A' }, 'paysage'), 'portrait')
  // Debout devant un jeu franchement plus confortable couché.
  assert.equal(suggestion({ paysage: true, confort: 'paysage' }, 'portrait'), 'paysage')
  // Tous les autres cas : on ne dit rien.
  assert.equal(suggestion({ paysage: true }, 'paysage'), null)
  assert.equal(suggestion({ paysage: true }, 'portrait'), null)
  assert.equal(suggestion({ nom: 'A' }, 'portrait'), null)
  assert.equal(suggestion(null, 'paysage'), null)
})

test('tout jeu qui se dit plus confortable couché sait vraiment l’être', () => {
  for (const def of TOUS) {
    if (def.confort === 'paysage') assert.ok(def.paysage, `${def.id} préfère le paysage sans savoir le dessiner`)
    if (def.paysage) assert.ok(typeof def.dessine === 'function', def.id)
  }
})

// --- Les écrans du moteur --------------------------------------------------------

test('l’accueil tient dans les deux formats', () => {
  for (const t of GABARITS) {
    const d = dispoAccueil(t.W, t.H)
    const zones = CATEGORIES.map((_, i) => carteAccueil(i, d))
    verifie([...zones, dispoSon(t.W)], t, 'accueil')
  }
})

test('les tuiles d’une grosse catégorie tiennent dans les deux formats', () => {
  const n = Math.max(...CATEGORIES.map((c) => c.jeux.length))
  for (const t of GABARITS) {
    const d = dispoTuiles(t.W, t.H, n)
    verifie(
      Array.from({ length: n }, (_, i) => tuile(i, d)),
      t,
      'tuiles',
    )
  }
})

test('les rangées d’une petite catégorie tiennent dans les deux formats', () => {
  for (const t of GABARITS) {
    for (const n of [1, 2, 3, 4, 5, 6]) {
      if (!enRangees(t.W, t.H, n)) continue
      const d = dispoRangees(t.W, t.H, n)
      verifie(
        Array.from({ length: n }, (_, i) => rangee(i, d)),
        t,
        `rangées(${n})`,
      )
    }
  }
})

test('on ne passe en rangées que quand elles tiennent vraiment', () => {
  // Six rangées débordaient en portrait ; le choix se fait maintenant sur la
  // place disponible, pas sur un nombre écrit à la main.
  assert.equal(enRangees(360, 640, 3), true)
  assert.equal(enRangees(360, 640, 6), false)
  assert.equal(enRangees(640, 360, 4), true)
  assert.equal(enRangees(360, 640, 7), false)
})

test('les menus de pause et de fin tiennent dans les deux formats', () => {
  for (const t of GABARITS) {
    const d = dispoMenu(t.W, t.H, 4)
    verifie(
      [0, 1, 2, 3].map((i) => boutonMenu(i, d)),
      t,
      'pause',
    )
    // Et il reste de la place au-dessus pour le titre.
    assert.ok(d.y >= 76, `${t.W}×${t.H} : le menu monte trop haut (${d.y})`)
  }
})

test('en paysage, l’accueil et les tuiles profitent vraiment de la largeur', () => {
  const p = dispoAccueil(FORMATS.portrait.W, FORMATS.portrait.H)
  const l = dispoAccueil(FORMATS.paysage.W, FORMATS.paysage.H)
  assert.equal(p.cols, 1)
  assert.equal(l.cols, 2, 'les catégories restent en colonne unique une fois couchées')

  const n = Math.max(...CATEGORIES.map((c) => c.jeux.length))
  const tp = dispoTuiles(FORMATS.portrait.W, FORMATS.portrait.H, n)
  const tl = dispoTuiles(FORMATS.paysage.W, FORMATS.paysage.H, n)
  assert.ok(tl.cols > tp.cols, `${tl.cols} colonnes couché contre ${tp.cols} debout`)
  // La plus grosse catégorie doit tenir sans sortir de l'écran, quel que soit
  // son nombre de jeux — pas seulement dix-huit.
  const bas = tuile(n - 1, tl)
  assert.ok(bas.y + bas.h <= FORMATS.paysage.H, 'la dernière tuile sort en bas')
})

test('le portrait n’a pas bougé d’un pixel', () => {
  // Les positions historiques : on change de format, pas de jeu.
  const t = FORMATS.portrait
  const d = dispoAccueil(t.W, t.H)
  assert.deepEqual(carteAccueil(0, d), { x: 20, y: 96, w: 320, h: 88 })
  assert.deepEqual(carteAccueil(1, d), { x: 20, y: 198, w: 320, h: 88 })
  const g = dispoTuiles(t.W, t.H)
  assert.deepEqual(tuile(0, g), { x: 20, y: 116, w: 74, h: 70 })
  assert.deepEqual(tuile(4, g), { x: 20, y: 194, w: 74, h: 70 })
  const r = dispoRangees(t.W, t.H, 3)
  assert.deepEqual(rangee(0, r), { x: 20, y: 130, w: 320, h: 92 })
  assert.deepEqual(rangee(1, r), { x: 20, y: 236, w: 320, h: 92 })
  const m = dispoMenu(t.W, t.H, 4)
  assert.deepEqual(boutonMenu(0, m), { x: 50, y: 250, w: 260, h: 56 })
  assert.deepEqual(boutonMenu(3, m), { x: 50, y: 454, w: 260, h: 56 })
})
