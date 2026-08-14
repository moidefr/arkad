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
import * as VB from '../src/massif/front/vue/bataille.js'
import * as VD from '../src/massif/front/vue/dispo.js'
import * as VM from '../src/massif/front/vue/menus.js'
import { liste } from '../src/massif/front/vue/menus.js'
import { tronque } from '../src/massif/front/vue/pieces.js'
import * as U from '../src/massif/front/unites.js'
import { rect, texte } from '../src/dessin.js'
import { fauxJeu, fauxCtx, peint, FORMATS, PAS } from './faux.js'

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
  j.e.vue = 'village'
  ecrans.push(['village', dessine(j), j.e.zones.slice()])
  for (const vue of ['campagne', 'caserne', 'uniques', 'compagnie']) {
    j.e.vue = vue
    if (vue === 'campagne') j.e.choix = 0
    if (vue === 'compagnie') j.e.selTroupe = j.e.c.troupes[0].id
    ecrans.push([vue, dessine(j), j.e.zones.slice()])
  }
  j.e.vue = 'fiche'
  ecrans.push(['fiche', dessine(j), j.e.zones.slice()])

  j.e.vue = 'ville'
  ecrans.push(['ville', dessine(j), j.e.zones.slice()])
  j.e.c.ville.bat.caserne = 2
  j.e.vue = 'batiment'
  j.e.batimentId = 'caserne'
  ecrans.push(['batiment', dessine(j), j.e.zones.slice()])

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
  // Neuf au lot 6 : le camp aux boutons empilés est remplacé par le village
  // vivant — huit emplacements réactifs, un ciel qui suit l'heure du jour.
  // Réétalonné au lot 7 : l'entête porte désormais la saison, cosmétique
  // (« JOUR 1 · PRINTEMPS ») — même nombre de traits, texte différent.
  ['village', 100, '8529507f475f8d20'],
  ['campagne', 54, '3b9b04d51ab6a423'],
  // Réétalonné : le lot 2 ajoute dix classes au vivier générique, donc le
  // même tirage à la même graine ne pioche plus les mêmes six cartes à la
  // caserne — et le tirage d'uniques qui suit dans le même flux de hasard en
  // pioche d'autres à son tour. Même nombre de traits par carte, textes
  // différents : ce n'est pas la disposition qui a bougé.
  ['caserne', 87, '2e76887e29820200'],
  ['uniques', 65, 'f9eb2366a6a79c11'],
  ['compagnie', 89, '77d685cf64eaba4a'],
  // Réétalonné au lot 4 : la fiche troque sa grille de six cases et son
  // « FORT/FAIBLE CONTRE » textuel pour des pastilles, trois emplacements
  // d'équipement et des puces hexagonales — plus de traits, même plancher
  // tactile.
  // Réétalonné au lot 7 : la ligne de classe porte désormais le compteur
  // cosmétique (« · 1 PIQUIER ») — même nombre de traits, texte différent.
  ['fiche', 136, '87bab8d653658400'],
  // Neufs au lot 3 : la liste des bâtiments, et le détail de la caserne (le
  // seul qui ait quelque chose de propre à montrer — ses sessions).
  ['ville', 81, 'fe41f50755b1fcff'],
  ['batiment', 54, '72fb57b86857024c'],
  // Réétalonné au lot 5 : ZOOM et FIN DE TOUR passent de 26 à 30 px de haut
  // dans le bandeau, commun aux quatre états — même nombre de traits, le
  // bouton bouge de deux pixels.
  ['bataille', 396, '0026a4679b1d45a9'],
  ['bataille/troupe', 408, 'efac87fa29a5f1f7'],
  // Réétalonné au lot 8 : `adversaire.js` recrutait un rang de classe
  // d'avance (`niveau + 1`) sur la caserne du joueur, plafonnée à `niveau`
  // sans le « + 1 » — corrigé pour aligner les deux plafonds. À graine
  // égale, l'armée adverse tire d'autres classes : la troupe visée par la
  // prévision et l'ennemi inspecté changent de contenu, pas de disposition.
  ['bataille/prévision', 414, 'e987a480288d0ae4'],
  ['bataille/ennemi', 366, '660dfecfeebb2bce'],
  // Réétalonné au lot 6 : le bouton du bilan dit désormais AU VILLAGE, plus
  // « AU CAMP » — même bouton, même nombre de traits, texte différent.
  // Réétalonné au lot 7 : le titre porte le carnet de guerre quand ce bilan
  // en a un (ici « victoire sans perte ») — même nombre de traits.
  ['bilan', 24, 'ea3641bdcabb13c6'],
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

  assert.deepEqual(VD.village(j).plots[1], { x: 92, y: 160, w: 84, h: 92 })
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

// --- Ce qui est peint est ce qui se touche --------------------------------------------

const dedans = (cadre, r) =>
  r.x >= cadre.x - 0.01 &&
  r.y >= cadre.y - 0.01 &&
  r.x + r.w <= cadre.x + cadre.w + 0.01 &&
  r.y + r.h <= cadre.y + cadre.h + 0.01

/** Une ligne de liste comme les vraies : un panneau plein, et du texte dessus. */
const carteFactice = (ctx, z, el) => {
  ctx.textAlign = 'left'
  rect(ctx, z.x, z.y, z.w, z.h, '#141a18')
  texte(ctx, `LIGNE ${el}`, z.x + 12, z.y + 17, 13)
  texte(ctx, 'CLASSE 8 · SERGENT', z.x + 12, z.y + 33, 10)
}

/**
 * Les trois fenêtres défilantes du jeu, dans les deux gabarits — c'est là que
 * l'écart entre le dessin et le doigt se paie, une carte entière à la fois.
 */
const FENETRES = [
  ['caserne debout', VD.caserne({ W: 360, H: 640 })],
  ['caserne couché', VD.caserne({ W: 640, H: 360 })],
  ['état-major debout', VD.uniques({ W: 360, H: 640 })],
  ['état-major couché', VD.uniques({ W: 640, H: 360 })],
  ['compagnie debout', VD.compagnie({ W: 360, H: 640 }, 2, true)],
  ['compagnie couché', VD.compagnie({ W: 640, H: 360 }, 2, true)],
]

test('une liste ne peint rien hors de sa fenêtre, à aucun défilement', () => {
  const elements = Array.from({ length: 20 }, (_, i) => i)
  for (const [nom, d] of FENETRES) {
    const rangs = Math.ceil(elements.length / d.cols)
    const max = rangs * (d.ligne + 4) - 4 - d.zone.h
    for (let defile = 0; defile <= max; defile++) {
      const ctx = fauxCtx()
      liste(ctx, d.zone, elements, d.ligne, defile, carteFactice, d.cols)
      for (const o of ctx.ops) {
        const p = peint(o)
        if (!p) continue
        assert.ok(dedans(d.zone, p), `${nom} à defile=${defile} : « ${o.s ?? o.couleur} » déborde de la fenêtre`)
      }
    }
  }
})

test('une ligne de liste peinte est touchable, et sur toute sa part visible', () => {
  const elements = Array.from({ length: 20 }, (_, i) => i)
  for (const [nom, d] of FENETRES) {
    const rangs = Math.ceil(elements.length / d.cols)
    const max = rangs * (d.ligne + 4) - 4 - d.zone.h
    for (let defile = 0; defile <= max; defile++) {
      const ctx = fauxCtx()
      const traces = []
      const r = liste(
        ctx,
        d.zone,
        elements,
        d.ligne,
        defile,
        (c, z, el) => {
          const debut = c.ops.length
          carteFactice(c, z, el)
          traces.push({ el, debut, fin: c.ops.length })
        },
        d.cols,
      )
      assert.deepEqual(
        r.zones.map((z) => z.el),
        traces.map((t) => t.el),
        `${nom} à defile=${defile} : une ligne est peinte sans être touchable, ou l’inverse`,
      )
      for (const t of traces) {
        const z = r.zones.find((z) => z.el === t.el)
        assert.ok(
          z.w >= 44 && z.h >= 30,
          `${nom} à defile=${defile} : zone de ${z.w}×${z.h}, sous le plancher du doigt`,
        )
        for (let i = t.debut; i < t.fin; i++) {
          const p = peint(ctx.ops[i])
          if (!p) continue
          assert.ok(dedans(z, p), `${nom} à defile=${defile} : la ligne ${t.el} se voit là où le doigt ne trouve rien`)
        }
      }
    }
  }
})

/** Une compagnie assez fournie pour que la liste déborde de sa fenêtre. */
function compagnieFournie(format, combien) {
  const j = fauxJeu(front, { graine: 31, neuve: true, format })
  tape(j, 'nouvelle')
  j.e.c.or = 999999
  j.e.c.niveau = 8
  Cie.rafraichit(j.e.c)
  let garde = 0
  while (j.e.c.troupes.length < combien && garde++ < 80) {
    j.e.vue = 'caserne'
    dessine(j)
    // L'étal se vide : on le regarnit comme le ferait un engagement de plus.
    if (j.e.zones.some((x) => x.quoi === 'recrute')) tape(j, 'recrute')
    else Cie.rafraichit(j.e.c)
  }
  assert.ok(j.e.c.troupes.length >= combien, `seulement ${j.e.c.troupes.length} troupes recrutées`)
  j.e.vue = 'compagnie'
  j.e.selTroupe = null
  j.e.defile = 0
  return j
}

for (const format of ['portrait', 'paysage']) {
  test(`${format} : aucune fiche de troupe ne se peint hors de la fenêtre de la compagnie`, () => {
    const j = compagnieFournie(format, 10)
    const c = j.e.c
    const mesure = fauxCtx()
    // Le libellé exact que la fiche écrit : c'est lui qui trahit une carte
    // peinte hors du cadre. Deux troupes peuvent porter le même, d'où la liste.
    const noms = new Map()
    for (const u of c.troupes) {
      const l = tronque(mesure, U.nomComplet(u), 13, 168)
      noms.set(l, [...(noms.get(l) ?? []), u.id])
    }
    for (let defile = 0; defile <= j.e.defileMax; defile += 3) {
      j.e.defile = defile
      const ctx = dessine(j)
      const cadre = j.e.listeRect
      for (const o of ctx.ops) {
        const ids = o.type === 'texte' ? noms.get(o.s) : null
        if (!ids) continue
        const p = peint(o)
        if (!p) continue
        assert.ok(dedans(cadre, p), `à defile=${defile}, « ${o.s} » est peint hors de la fenêtre`)
        const z = j.e.zones.find((x) => x.quoi === 'troupe' && ids.includes(x.id) && dedans(x, p))
        assert.ok(z, `à defile=${defile}, la fiche « ${o.s} » se voit là où le doigt ne trouve rien`)
      }
    }
  })
}

test('couché, l’état-major ne peint aucun dossier sous sa fenêtre', () => {
  const j = fauxJeu(front, { graine: 31, neuve: true, format: 'paysage' })
  tape(j, 'nouvelle')
  j.e.c.or = 999999
  j.e.c.niveau = 8
  Cie.rafraichit(j.e.c)
  j.e.vue = 'uniques'
  j.e.defile = 0
  const ctx = dessine(j)
  const cadre = j.e.listeRect
  assert.ok(j.e.c.offre.uniques.length >= 3, 'l’état-major n’offre pas assez de dossiers pour déborder')
  // « APPARITION … % » est écrit par la dernière ligne de chaque dossier : si
  // elle sort du cadre, c'est toute une carte qui pend sous la fenêtre.
  for (const o of ctx.ops) {
    if (o.type !== 'texte' || !o.s.startsWith('APPARITION')) continue
    const p = peint(o)
    assert.ok(
      !p || dedans(cadre, p),
      `« ${o.s} » est peint à y=${o.y}, sous la fenêtre qui s’arrête à ${cadre.y + cadre.h}`,
    )
  }
})

// --- Le bilan --------------------------------------------------------------------------

const SECTIONS = ['PROMOTIONS ET NIVEAUX', 'RAMASSÉS SUR LE TERRAIN', 'NE SONT PAS RENTRÉS']

/**
 * Le cas courant d'une victoire : des promotions, du butin ramassé, et des
 * disparus. `parSection` monte jusqu'aux six lignes que le bilan accepte.
 */
function bilanTroisSections(format, parSection = 1) {
  const j = fauxJeu(front, { graine: 31, neuve: true, format })
  tape(j, 'nouvelle')
  const c = j.e.c
  assert.ok(c.troupes.length >= 3, 'la compagnie de départ n’a pas trois troupes')
  const prend = (k) => Array.from({ length: parSection }, (_, i) => c.troupes[(i + k) % c.troupes.length])
  const r = {
    gagne: true,
    rompu: false,
    titre: 'LE GUÉ DE BAZAS',
    or: 120,
    renom: 8,
    niveaux: 0,
    montees: prend(0).map((u) => ({ u, niveaux: 1, grade: null })),
    lignes: prend(1).map((u) => ({ u, texte: 'RAMASSÉ' })),
    perdus: prend(2),
  }
  const ctx = fauxCtx()
  ctx.zones = VM.bilan(ctx, j, c, r)
  return ctx
}

const titresDeSection = (ctx) => ctx.ops.filter((o) => o.type === 'texte' && SECTIONS.includes(o.s))

test('debout, les sections du bilan se suivent au lieu de s’empiler', () => {
  const ctx = bilanTroisSections('portrait')
  const titres = titresDeSection(ctx)
  assert.equal(titres.length, 3, 'les trois sections ne sont pas toutes écrites')
  assert.deepEqual([...new Set(titres.map((o) => o.x))], [20], 'debout, une section quitte la colonne unique')
  const y = titres.map((o) => o.y)
  assert.equal(new Set(y).size, 3, `les sections s’écrivent l’une sur l’autre : ${y.join(', ')}`)
  assert.ok(y[0] < y[1] && y[1] < y[2], `les sections ne descendent pas dans l’ordre : ${y.join(', ')}`)
})

test('couché, chaque section du bilan tient sa colonne', () => {
  const ctx = bilanTroisSections('paysage')
  const titres = titresDeSection(ctx)
  assert.equal(titres.length, 3)
  assert.equal(new Set(titres.map((o) => o.x)).size, 3, 'deux sections partagent la même colonne')
  assert.equal(new Set(titres.map((o) => o.y)).size, 1, 'les colonnes ne démarrent pas à la même hauteur')
})

for (const format of ['portrait', 'paysage']) {
  test(`${format} : un bilan chargé ne s’écrit ni sur lui-même ni sur le bouton`, () => {
    // Six lignes par section : le plus que le bilan accepte de montrer.
    const ctx = bilanTroisSections(format, 6)
    const ops = ctx.ops.filter((o) => o.type === 'texte')
    for (let i = 0; i < ops.length; i++) {
      for (let k = i + 1; k < ops.length; k++) {
        assert.ok(!seChevauchent(ops[i], ops[k]), `« ${ops[i].s} » et « ${ops[k].s} » se recouvrent à y=${ops[i].y}`)
      }
    }
    const suite = ctx.zones[0]
    for (const o of ops) {
      const p = peint(o)
      if (!p || o.s === 'AU VILLAGE') continue
      assert.ok(p.y + p.h <= suite.y || p.y >= suite.y + suite.h, `« ${o.s} » descend sur le bouton AU VILLAGE`)
    }
  })
}

// --- Le panneau d'ordres, couché --------------------------------------------------------

function seChevauchent(a, b) {
  const pa = peint(a)
  const pb = peint(b)
  return !!pa && !!pb && pa.x < pb.x + pb.w && pb.x < pa.x + pa.w && pa.y < pb.y + pb.h && pb.y < pa.y + pa.h
}

/**
 * Les textes du panneau d'ordres — ceux écrits **après** son fond opaque, sans
 * quoi on compterait les étiquettes du champ qu'il vient de recouvrir.
 */
function textesDuPanneau(ctx, d) {
  const fond = ctx.ops.findIndex(
    (o) => o.type === 'rect' && o.x === d.panneau.x && o.y === d.panneau.y && o.w === d.panneau.w,
  )
  assert.ok(fond >= 0, 'le fond du panneau n’a pas été trouvé')
  return ctx.ops.slice(fond).filter((o) => o.type === 'texte' && o.gauche >= d.panneau.x)
}

test('couché, deux textes du panneau d’ordres ne se recouvrent jamais', () => {
  const d = VD.bataille({ W: 640, H: 360 })
  for (const [nom, ctx] of tousLesEcrans('paysage')) {
    if (!nom.startsWith('bataille')) continue
    const ops = textesDuPanneau(ctx, d)
    for (let i = 0; i < ops.length; i++) {
      for (let k = i + 1; k < ops.length; k++) {
        assert.ok(
          !seChevauchent(ops[i], ops[k]),
          `${nom} : « ${ops[i].s} » et « ${ops[k].s} » se recouvrent dans le panneau`,
        )
      }
    }
  }
})

test('couché, une fiche de troupe bavarde ne mord pas sur ses compteurs', () => {
  const j = jusquAuFeu(37, 'paysage')
  const u = B.vivantes(j.e.bat, 0)[0]
  tape(j, 'troupe', (z) => z.ref === u.ref)
  // Le pire cas que la campagne puisse produire : le grade et la classe les
  // plus longs, sur une case qui a un nom.
  u.cl = 'hallebardier'
  u.grade = 5
  u.niv = 20
  const d = VD.bataille(j)
  const ops = textesDuPanneau(dessine(j), d)
  for (let i = 0; i < ops.length; i++) {
    for (let k = i + 1; k < ops.length; k++) {
      assert.ok(!seChevauchent(ops[i], ops[k]), `« ${ops[i].s} » et « ${ops[k].s} » se recouvrent dans le panneau`)
    }
  }
})

test('couché, le compte des troupes et celui des tours ne se marchent pas dessus', () => {
  const j = compagnieFournie('paysage', 12)
  const c = j.e.c
  c.niveau = 12
  while (c.escouades.length < Cie.escouadesMax(c.niveau)) Cie.creeEscouade(c)
  for (const u of c.troupes) if (!Cie.escouadeDe(c, u.id)) Cie.enrole(c, u.id)
  assert.ok(Cie.alignees(c).length >= 10, `seulement ${Cie.alignees(c).length} troupes en ligne`)
  Cie.planifie(c)
  const bat = Cie.prepare(c, 0)
  const d = VD.bataille({ W: 640, H: 360 })

  for (const fini of [false, true]) {
    // Fin de tour : la ligne de droite devient « TOUT A JOUÉ », la plus longue.
    if (fini) {
      for (const u of bat.unites) {
        if (u.camp !== 0) continue
        u.aAgi = true
        u.aBouge = true
        u.pm = 0
      }
    }
    const ctx = fauxCtx()
    VB.panneauBas(ctx, d, bat, {})
    const gauche = ctx.ops.find((o) => o.type === 'texte' && o.s.includes('EN LIGNE'))
    const droite = ctx.ops.find((o) => o.type === 'texte' && (o.s.includes('JOUER') || o.s.includes('JOUÉ')))
    assert.ok(gauche && droite)
    assert.ok(
      !seChevauchent(gauche, droite),
      `« ${gauche.s} » [${gauche.gauche}..${gauche.gauche + gauche.larg}] recouvre « ${droite.s} » [${droite.gauche}..${droite.gauche + droite.larg}]`,
    )
    assert.ok(gauche.gauche + gauche.larg <= d.px + d.pw, 'le compte des troupes sort du panneau')
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
  assert.ok(j.e.vue === 'village' || j.fini)
})

test('couché, tous les écrans du village s’ouvrent et se referment', () => {
  const j = fauxJeu(front, { graine: 61, neuve: true, format: 'paysage' })
  tape(j, 'nouvelle')
  for (const ecran of ['campagne', 'caserne', 'uniques', 'compagnie']) {
    tape(j, ecran)
    assert.equal(j.e.vue, ecran, `${ecran} ne s’ouvre pas couché`)
    tape(j, 'retour')
    assert.equal(j.e.vue, 'village', `${ecran} ne se referme pas couché`)
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
