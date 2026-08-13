/**
 * FRONT dans les deux gabarits.
 *
 * Deux choses à tenir, et elles tirent en sens contraire.
 *
 * La première : **le portrait ne bouge pas d'un pixel**. FRONT était réglé à
 * la main, écran par écran ; le passage au paysage a transformé toutes ses
 * constantes en fonctions, et une fonction qui rend 331 au lieu de 330 ne lève
 * aucune erreur. On empreinte donc le dessin complet de chaque écran, comme
 * `format.test.js` fige les rectangles du moteur.
 *
 * La seconde : **couché, tout tient**. Zones dans l'écran, jamais sous le
 * bandeau, jamais plus petites que 44 × 30, jamais l'une sur l'autre — et le
 * dessin et le doigt lisent la même disposition, ce qui se vérifie en tapant
 * là où c'est peint.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'

import front from '../src/massif/front.js'
import * as B from '../src/massif/front/bataille.js'
import * as Cie from '../src/massif/front/compagnie.js'
import * as VC from '../src/massif/front/vue/champ.js'
import * as VD from '../src/massif/front/vue/dispo.js'
import { liste } from '../src/massif/front/vue/menus.js'
import { fauxJeu, fauxCtx, FORMATS, PAS } from './faux.js'

const dessine = (j) => {
  const ctx = fauxCtx()
  front.dessine(j, ctx)
  return ctx
}

function tape(j, quoi, filtre) {
  dessine(j)
  const z = j.e.zones.find((x) => x.quoi === quoi && (!filtre || filtre(x)))
  assert.ok(z, `aucune zone « ${quoi} » à l’écran ${j.e.vue}`)
  const p = { x: z.x + z.w / 2, y: z.y + z.h / 2 }
  front.appui(j, p)
  front.relache(j, p)
  return z
}

function jusquAuFeu(graine, format) {
  const j = fauxJeu(front, { graine, neuve: true, format })
  tape(j, 'nouvelle')
  tape(j, 'campagne')
  tape(j, 'offre', (z) => z.k === 0)
  tape(j, 'engager')
  assert.equal(j.e.vue, 'bataille')
  return j
}

/** Tous les écrans, chacun dans un état où il a quelque chose à montrer. */
function tousLesEcrans(format) {
  const ecrans = []
  const j = fauxJeu(front, { graine: 31, neuve: true, format })
  ecrans.push(['titre', dessine(j), j.e.zones.slice()])
  tape(j, 'nouvelle')
  j.e.c.or = 99999
  j.e.c.niveau = 8
  Cie.rafraichit(j.e.c)
  for (const vue of ['camp', 'campagne', 'caserne', 'uniques', 'compagnie']) {
    j.e.vue = vue
    if (vue === 'campagne') j.e.choix = 0
    if (vue === 'compagnie') j.e.selTroupe = j.e.c.troupes[0].id
    ecrans.push([vue, dessine(j), j.e.zones.slice()])
  }
  j.e.vue = 'fiche'
  ecrans.push(['fiche', dessine(j), j.e.zones.slice()])

  const k = jusquAuFeu(37, format)
  ecrans.push(['bataille', dessine(k), k.e.zones.slice()])
  const u = B.vivantes(k.e.bat, 0)[0]
  tape(k, 'troupe', (z) => z.ref === u.ref)
  ecrans.push(['bataille/troupe', dessine(k), k.e.zones.slice()])
  const sien = B.vivantes(k.e.bat, 1)[0]
  u.q = sien.q + 1
  u.r = sien.r
  k.e.sel.visee = sien
  ecrans.push(['bataille/prévision', dessine(k), k.e.zones.slice()])
  k.e.sel = { inspect: sien }
  ecrans.push(['bataille/ennemi', dessine(k), k.e.zones.slice()])

  k.e.bat.fini = 'gagne'
  front.maj(k, PAS)
  ecrans.push(['bilan', dessine(k), k.e.zones.slice()])
  return ecrans
}

// --- Le portrait est figé -----------------------------------------------------------

const arrondi = (v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v)

const empreinte = (ctx) =>
  createHash('sha256')
    .update(
      ctx.ops
        .map((o) =>
          [
            o.type,
            arrondi(o.x),
            arrondi(o.y),
            arrondi(o.w),
            arrondi(o.h),
            o.s ?? '',
            o.couleur ?? '',
            arrondi(o.alpha),
          ].join('|'),
        )
        .join('\n'),
    )
    .digest('hex')
    .slice(0, 16)

/**
 * Le dessin de chaque écran debout, relevé **avant** le passage au paysage.
 * Une empreinte qui change veut dire qu'un pixel du portrait a bougé : c'est
 * une régression, pas une mise à jour à recopier ici sans réfléchir.
 */
const PORTRAIT = [
  ['titre', 18, 'ec969a079f2d16e6'],
  ['camp', 59, 'b1a9fe8284708641'],
  ['campagne', 54, '3b9b04d51ab6a423'],
  ['caserne', 87, '880ef1c955502281'],
  ['uniques', 65, 'b676316a6b563257'],
  ['compagnie', 89, '77d685cf64eaba4a'],
  ['fiche', 63, 'eedf887e3fd64603'],
  ['bataille', 396, 'cad016f2097e0dab'],
  ['bataille/troupe', 408, '8b79da9d914c844b'],
  ['bataille/prévision', 414, '31f1100cc351fa28'],
  ['bataille/ennemi', 366, 'fcc0258684ea47de'],
  ['bilan', 24, 'e540684b8388e3af'],
]

test('le portrait n’a pas bougé d’un pixel', () => {
  const rendus = tousLesEcrans('portrait')
  assert.equal(rendus.length, PORTRAIT.length)
  rendus.forEach(([nom, ctx], i) => {
    const [attendu, n, cle] = PORTRAIT[i]
    assert.equal(nom, attendu)
    assert.equal(ctx.ops.length, n, `${nom} : ${ctx.ops.length} traits au lieu de ${n}`)
    assert.equal(empreinte(ctx), cle, `${nom} : le dessin debout a changé`)
  })
})

test('les rectangles historiques du portrait sont exactement ceux d’avant', () => {
  const j = { W: 360, H: 640 }
  const b = VD.bataille(j)
  assert.deepEqual(b.champ, { x: 0, y: 88, w: 360, h: 364 })
  assert.deepEqual(b.panneau, { x: 0, y: 452, w: 360, h: 188 })
  assert.deepEqual(b.bandeau, { x: 0, y: 56, w: 360, h: 32 })
  assert.equal(b.px, 8)
  assert.equal(b.pw, 344)

  assert.deepEqual(VD.camp(j).items[1], { x: 20, y: 248, w: 320, h: 58, quoi: 'caserne' })
  assert.deepEqual(VD.caserne(j).zone, { x: 20, y: 118, w: 320, h: 396 })
  assert.deepEqual(VD.compagnie(j, 2, true).zone, { x: 20, y: 116, w: 320, h: 348 })
  assert.deepEqual(VD.titre(j, true).reprendre, { x: 50, y: 300, w: 260, h: 56, quoi: 'reprendre' })
  assert.deepEqual(VD.fiche(j).retour, { x: 20, y: 552, w: 320, h: 36, quoi: 'retour' })
  assert.deepEqual(VD.bilan(j).suite, { x: 20, y: 552, w: 320, h: 44, quoi: 'suite' })
})

// --- Couché, tout tient ---------------------------------------------------------------

const chevauche = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

test('couché, aucune zone tactile ne sort de l’écran ni ne passe sous le bandeau', () => {
  const t = FORMATS.paysage
  for (const [nom, , zones] of tousLesEcrans('paysage')) {
    for (const z of zones) {
      assert.ok(z.y >= 56, `${nom} : « ${z.quoi} » démarre à ${z.y}, sous le bandeau du moteur`)
      assert.ok(z.y + z.h <= t.H, `${nom} : « ${z.quoi} » finit à ${z.y + z.h}`)
      assert.ok(z.x >= 0 && z.x + z.w <= t.W, `${nom} : « ${z.quoi} » déborde en largeur`)
      assert.ok(z.w >= 44 && z.h >= 30, `${nom} : « ${z.quoi} » fait ${z.w}×${z.h}, trop petit pour un doigt`)
    }
  }
})

test('couché, deux zones ne se recouvrent jamais sur un même écran', () => {
  for (const [nom, , zones] of tousLesEcrans('paysage')) {
    for (let i = 0; i < zones.length; i++) {
      for (let k = i + 1; k < zones.length; k++) {
        assert.ok(!chevauche(zones[i], zones[k]), `${nom} : « ${zones[i].quoi} » et « ${zones[k].quoi} » se recouvrent`)
      }
    }
  }
})

test('couché, aucun texte n’est écrit au-dessus du bandeau ni sous l’écran', () => {
  const t = FORMATS.paysage
  for (const [nom, ctx] of tousLesEcrans('paysage')) {
    for (const o of ctx.ops) {
      if (o.type !== 'texte' || o.alpha === 0) continue
      assert.ok(o.y >= 56, `${nom} : « ${o.s} » écrit à y=${Math.round(o.y)}, sous le bandeau`)
      assert.ok(o.y <= t.H - 4, `${nom} : « ${o.s} » écrit à y=${Math.round(o.y)}, hors de l’écran`)
      assert.ok(o.x > -20 && o.x < t.W + 20, `${nom} : « ${o.s} » écrit à x=${Math.round(o.x)}`)
    }
  }
})

test('couché, le champ et le panneau d’ordres sont côte à côte, pas empilés', () => {
  const d = VD.bataille({ W: 640, H: 360 })
  assert.ok(d.champ.x + d.champ.w <= d.panneau.x, 'le champ mord sur le panneau')
  assert.ok(d.champ.w > d.panneau.w, 'le champ n’a pas la plus grosse part de la largeur')
  assert.equal(d.panneau.y, 56, 'le panneau n’occupe pas toute la colonne')
  assert.equal(d.panneau.y + d.panneau.h, 360)
  // Debout, ils s'empilent et pavent exactement les 640.
  const p = VD.bataille({ W: 360, H: 640 })
  assert.equal(p.bandeau.y + p.bandeau.h, p.champ.y)
  assert.equal(p.champ.y + p.champ.h, p.panneau.y)
  assert.equal(p.panneau.y + p.panneau.h, 640)
})

test('couché, la carte hexagonale respire vraiment', () => {
  const carte = { cols: 19, rows: 15 }
  const debout = VD.bataille({ W: 360, H: 640 }).champ
  const couche = VD.bataille({ W: 640, H: 360 }).champ
  // Le rapport de forme de la grille : √3·(cols+0,5) sur 1,5·(rows−1)+2.
  const forme = (Math.sqrt(3) * 19.5) / (1.5 * 14 + 2)
  assert.ok(Math.abs(couche.w / couche.h - forme) < 0.1, 'la fenêtre couchée n’a pas la forme de la carte')
  assert.ok(Math.abs(debout.w / debout.h - forme) > 0.4, 'la fenêtre debout aurait déjà la bonne forme')
  // Et sur une petite carte, le zoom « tout voir » gagne des pixels par case.
  const petite = { cols: 9, rows: 7 }
  assert.ok(VC.rayonPour(couche, petite, 0) > VC.rayonPour(debout, petite, 0))
})

// --- Le dessin et le doigt lisent la même disposition ----------------------------------

for (const format of ['portrait', 'paysage']) {
  test(`${format} : l’hexagone dessiné est celui que le doigt retrouve`, () => {
    const j = jusquAuFeu(41, format)
    const ch = VD.bataille(j).champ
    const vue = j.e.vueChamp
    let vus = 0
    for (let q = -6; q <= 6; q++) {
      for (let r = -6; r <= 6; r++) {
        const p = VC.place(ch, vue, q, r)
        if (!VC.dansChamp(ch, p)) continue
        vus++
        assert.deepEqual(VC.hexSous(ch, vue, p), { q, r }, `${q},${r} n’est pas retrouvé sous son propre centre`)
      }
    }
    assert.ok(vus > 20, `seulement ${vus} hexagones à l’écran`)
  })
}

test('couché, un appui dans le panneau d’ordres ne désigne aucun hexagone', () => {
  const j = jusquAuFeu(43, 'paysage')
  const d = VD.bataille(j)
  const dedans = { x: d.panneau.x + d.panneau.w / 2, y: d.panneau.y + d.panneau.h / 2 }
  assert.equal(VC.hexSous(d.champ, j.e.vueChamp, dedans), null)
  assert.equal(VC.dansChamp(d.champ, dedans), false)
  // Et le geste de glissement lit le même prédicat que `hexSous`.
  front.appui(j, dedans)
  assert.equal(j.e.geste.champ, false, 'le doigt croit faire glisser la carte depuis le panneau')
})

test('une ligne de liste n’est jamais touchable en dehors de son cadre', () => {
  const cadre = { x: 20, y: 100, w: 320, h: 200 }
  const elements = Array.from({ length: 12 }, (_, i) => i)
  for (let defile = 0; defile <= 400; defile += 7) {
    const r = liste(fauxCtx(), cadre, elements, 62, defile, () => {})
    for (const z of r.zones) {
      assert.ok(z.y >= cadre.y, `à defile=${defile}, une ligne est touchable à ${z.y}, au-dessus du cadre`)
      assert.ok(z.y + z.h <= cadre.y + cadre.h, `à defile=${defile}, une ligne est touchable à ${z.y + z.h}`)
      assert.ok(z.h >= 24, 'une ligne rognée trop fine reste proposée au doigt')
    }
  }
})

test('couché, les listes passent à deux colonnes', () => {
  const couche = { W: 640, H: 360 }
  const debout = { W: 360, H: 640 }
  // Ce que chaque liste montre en entier, couché : la fenêtre n'a plus que 170
  // px de haut, c'est la seconde colonne qui rend les lignes perdues.
  const attendus = [
    ['caserne', VD.caserne, 4],
    ['état-major', VD.uniques, 2],
    ['compagnie', (j) => VD.compagnie(j, 2, true), 6],
  ]
  for (const [nom, ecran, combien] of attendus) {
    const d = ecran(couche)
    assert.equal(d.cols, 2, `${nom} reste en colonne unique une fois couché`)
    const rangs = Math.floor(d.zone.h / (d.ligne + 4))
    assert.equal(rangs * d.cols, combien, `${nom} montre ${rangs * d.cols} lignes entières couché`)
    assert.ok(rangs * d.cols > rangs, `${nom} : la seconde colonne ne montre rien de plus`)
    assert.equal(ecran(debout).cols, 1, `${nom} debout est passé à deux colonnes`)
  }
})

// --- La rotation en pleine bataille -----------------------------------------------------

test('tourner l’écran en pleine bataille recadre sans rien casser', () => {
  const j = jusquAuFeu(47, 'portrait')
  const u = B.vivantes(j.e.bat, 0)[0]
  tape(j, 'troupe', (z) => z.ref === u.ref)
  const avant = { q: u.q, r: u.r, pm: u.pm, tour: j.e.bat.tour }
  j.e.defile = 120

  // Le moteur ne fait que changer le gabarit : `j.W` et `j.H` sont des
  // accesseurs branchés dessus, le jeu n'y touche jamais lui-même.
  j.W = FORMATS.paysage.W
  j.H = FORMATS.paysage.H
  front.redim(j)

  const d = VD.bataille(j)
  assert.equal(j.e.sel.unite, u, 'la troupe choisie a été perdue en tournant')
  assert.deepEqual({ q: u.q, r: u.r, pm: u.pm, tour: j.e.bat.tour }, avant, 'la partie a bougé en tournant')
  assert.equal(j.e.defile, 0, 'un défilement mesuré debout survit à la rotation')
  assert.equal(j.e.geste, null, 'le doigt en cours pointe des coordonnées disparues')
  assert.equal(
    j.e.vueChamp.R,
    VC.rayonPour(d.champ, j.e.bat.carte, j.e.vueChamp.zoom),
    'le rayon ne cadre plus la carte',
  )
  assert.ok(VC.dansChamp(d.champ, VC.place(d.champ, j.e.vueChamp, u.q, u.r)), 'la troupe choisie est hors du champ')

  // Et la bataille se joue encore, par le vrai chemin d'appui.
  tape(j, 'finTour')
  assert.ok(j.e.bat.tour > avant.tour || j.e.bat.camp === 1, 'le tour ne passe plus')
  dessine(j)
  assert.ok(j.e.zones.length > 0)
})

test('tourner l’écran hors bataille ne demande rien de plus', () => {
  const j = fauxJeu(front, { graine: 53, neuve: true })
  tape(j, 'nouvelle')
  tape(j, 'caserne')
  j.e.defile = 90
  j.W = FORMATS.paysage.W
  j.H = FORMATS.paysage.H
  front.redim(j)
  assert.equal(j.e.defile, 0)
  assert.equal(j.e.vue, 'caserne')
  dessine(j)
  assert.ok(j.e.zones.some((z) => z.quoi === 'retour'))
})

// --- Une partie entière, couché ------------------------------------------------------------

test('une bataille couchée se joue jusqu’au bilan par le vrai chemin d’appui', () => {
  const j = jusquAuFeu(59, 'paysage')
  for (let garde = 0; garde < 3000 && j.e.vue === 'bataille'; garde++) {
    if (j.e.bat && j.e.bat.camp === 0 && !j.e.bat.fini) tape(j, 'finTour')
    front.maj(j, PAS)
    dessine(j)
  }
  assert.equal(j.e.vue, 'bilan', 'la bataille couchée ne se termine pas')
  tape(j, 'suite')
  assert.ok(j.e.vue === 'camp' || j.fini)
})

test('couché, tous les écrans du camp s’ouvrent et se referment', () => {
  const j = fauxJeu(front, { graine: 61, neuve: true, format: 'paysage' })
  tape(j, 'nouvelle')
  for (const ecran of ['campagne', 'caserne', 'uniques', 'compagnie']) {
    tape(j, ecran)
    assert.equal(j.e.vue, ecran, `${ecran} ne s’ouvre pas couché`)
    tape(j, 'retour')
    assert.equal(j.e.vue, 'camp', `${ecran} ne se referme pas couché`)
  }
})

test('couché, on recrute, on affecte, et on ouvre une fiche', () => {
  const j = fauxJeu(front, { graine: 67, neuve: true, format: 'paysage' })
  tape(j, 'nouvelle')
  j.e.c.or = 9000
  tape(j, 'caserne')
  const n = j.e.c.troupes.length
  tape(j, 'recrute')
  assert.equal(j.e.c.troupes.length, n + 1, 'aucune recrue couché')
  tape(j, 'retour')
  tape(j, 'compagnie')
  const cible = j.e.c.troupes[0]
  tape(j, 'troupe', (z) => z.id === cible.id)
  tape(j, 'depot')
  tape(j, 'affecte', (z) => z.k === 0)
  assert.ok(Cie.escouadeDe(j.e.c, cible.id), 'l’affectation ne fait rien couché')
  tape(j, 'fiche')
  assert.equal(j.e.vue, 'fiche')
  tape(j, 'retour')
  assert.equal(j.e.vue, 'compagnie')
})
