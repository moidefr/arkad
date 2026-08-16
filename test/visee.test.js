/**
 * VISÉE : la jauge dessinée et la jauge que `relache` gèle doivent être la
 * même valeur au même instant, jamais deux calculs qui peuvent diverger —
 * c'est exactement la faute documentée dans corde.test.js. Ces tests décident
 * quand lâcher en lisant les voyants **dessinés**, comme un joueur, jamais
 * `j.e.charge` directement — sauf dans le test de régression dédié, qui lit
 * la position du repère à l'écran pour vérifier l'accord dessin/règle.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import visee from '../src/court/visee.js'
import { C, ton } from '../src/palette.js'
import { fauxJeu, fauxCtx, PAS } from './faux.js'

// Géométrie dupliquée depuis la source, comme corde.test.js duplique SOL :
// un test qui lit l'écran doit savoir où regarder.
const PISTE_X = 150
const PISTE_HAUT = 130
const PISTE_BAS = 480
const PISTE_L = 60
const PISTE_H = PISTE_BAS - PISTE_HAUT
const seuilDe = (score) => Math.min(0.95, 0.6 + score * 0.018)

/** Ce qu'un joueur voit : les deux voyants, et la largeur des fenêtres. */
function regarde(ops) {
  const vTouche = ops.find((o) => o.type === 'rect' && o.w === 90 && o.h === 6)
  const vPlein = ops.find((o) => o.type === 'rect' && o.w === 40 && o.h === 6)
  const zoneTouche = ops.find(
    (o) => o.type === 'rect' && o.w === PISTE_L && o.x === PISTE_X && o.y === PISTE_HAUT && o.couleur === ton(C.rouge, -0.5),
  )
  const zonePlein = ops.find(
    (o) => o.type === 'rect' && o.w === PISTE_L && o.x === PISTE_X && o.y === PISTE_HAUT && o.couleur === ton(C.accent, -0.35),
  )
  // Le repère de charge courante : seul rectangle de 68 × 4 à l'écran.
  const marque = ops.find((o) => o.type === 'rect' && o.w === 68 && o.h === 4)
  return {
    toucheOuverte: vTouche?.couleur === C.accent,
    pleinOuvert: vPlein?.couleur === C.accent,
    zoneToucheH: zoneTouche?.h,
    zonePleinH: zonePlein?.h,
    charge: marque ? (PISTE_BAS - (marque.y + 2)) / PISTE_H : null,
  }
}

/** Maintient, image par image, jusqu'à ce que `attend(vu)` dise de lâcher. */
function tireAuSignal(j, ctx, attend, duree = 10) {
  visee.appui(j, j.pointer)
  j.maintenu = true
  const scoreAvant = j.score
  let t = 0
  while (t < duree) {
    visee.maj(j, PAS)
    ctx.ops.length = 0
    visee.dessine(j, ctx)
    const vu = regarde(ctx.ops)
    if (attend(vu)) {
      j.maintenu = false
      visee.relache(j, j.pointer)
      return { vu, scoreAvant, scoreApres: j.score, fini: j.fini }
    }
    t += PAS
  }
  throw new Error('le signal attendu ne s’est jamais allumé')
}

test('lâcher pendant que le voyant de touche est allumé compte toujours comme une touche', () => {
  for (const graine of [1, 2, 3, 4, 5]) {
    const j = fauxJeu(visee, { graine })
    const ctx = fauxCtx()
    const r = tireAuSignal(j, ctx, (vu) => vu.toucheOuverte)
    assert.equal(r.fini, false, `vie perdue alors que le voyant de touche était allumé (graine ${graine})`)
    assert.ok(r.scoreApres > r.scoreAvant, `le score n’a pas augmenté alors que le voyant était allumé (graine ${graine})`)
  }
})

test('lâcher pendant que le voyant plein est allumé rapporte deux points', () => {
  for (const graine of [1, 2, 3]) {
    const j = fauxJeu(visee, { graine })
    const ctx = fauxCtx()
    const r = tireAuSignal(j, ctx, (vu) => vu.pleinOuvert)
    assert.equal(r.fini, false, `vie perdue alors que le voyant plein était allumé (graine ${graine})`)
    assert.equal(r.scoreApres - r.scoreAvant, 2, `le point plein ne rapporte pas deux points (graine ${graine})`)
  }
})

test('lâcher après un sommet, une fois la jauge redescendue près de zéro, fait perdre une vie', () => {
  const j = fauxJeu(visee, { graine: 1 })
  const ctx = fauxCtx()
  // On attend que la jauge ait vraiment grimpé avant de guetter son retour en
  // bas : sinon on ne teste que l'instant de départ, déjà couvert ailleurs.
  let monte = false
  const r = tireAuSignal(
    j,
    ctx,
    (vu) => {
      if (vu.charge >= 0.6) monte = true
      return monte && vu.charge !== null && vu.charge < 0.05 && !vu.toucheOuverte
    },
    6,
  )
  assert.equal(r.fini, true, 'la partie continue alors que la jauge était retombée près de zéro au lâcher')
  assert.equal(r.scoreApres, r.scoreAvant, 'le score a bougé sur un tir manqué')
})

test('lâcher aussitôt après avoir appuyé, jauge encore à zéro, fait perdre une vie', () => {
  const j = fauxJeu(visee, { graine: 1 })
  visee.appui(j, j.pointer)
  j.maintenu = true
  visee.relache(j, j.pointer)
  assert.equal(j.fini, true, 'une jauge à zéro ne devrait jamais compter comme une touche')
  assert.equal(j.score, 0)
})

test('la fenêtre de touche dessinée se resserre quand le score augmente', () => {
  const bas = fauxJeu(visee, { graine: 1 })
  const ctxBas = fauxCtx()
  visee.dessine(bas, ctxBas)
  const vuBas = regarde(ctxBas.ops)

  const haut = fauxJeu(visee, { graine: 1 })
  haut.score = 60
  const ctxHaut = fauxCtx()
  visee.dessine(haut, ctxHaut)
  const vuHaut = regarde(ctxHaut.ops)

  assert.ok(vuBas.zoneToucheH > 0 && vuHaut.zoneToucheH > 0, 'fenêtre de touche introuvable à l’écran')
  assert.ok(
    vuBas.zoneToucheH > vuHaut.zoneToucheH,
    `la fenêtre ne s’est pas resserrée avec le score : ${vuBas.zoneToucheH} → ${vuHaut.zoneToucheH}`,
  )
  assert.ok(
    vuBas.zonePleinH > vuHaut.zonePleinH,
    `la fenêtre plein ne s’est pas resserrée avec le score : ${vuBas.zonePleinH} → ${vuHaut.zonePleinH}`,
  )
})

// Le régression exact de corde.test.js : le dessin et la règle de calcul
// doivent lire *la même* valeur de j.e.charge au même instant. On lit la
// puissance depuis le repère affiché, on prédit le verdict avec le même seuil
// que la règle, puis on vérifie que relache() donne exactement ce verdict.
test('la puissance gelée au lâcher est exactement celle qui était dessinée juste avant', () => {
  for (const graine of [1, 2, 3, 4, 6, 9]) {
    const j = fauxJeu(visee, { graine })
    const ctx = fauxCtx()
    visee.appui(j, j.pointer)
    j.maintenu = true
    const pas = 4 + graine * 23 // instant différent de l'oscillation par graine
    for (let i = 0; i < pas; i++) visee.maj(j, PAS)
    ctx.ops.length = 0
    visee.dessine(j, ctx)
    const vu = regarde(ctx.ops)
    assert.ok(vu.charge !== null, 'repère de charge introuvable à l’écran')
    const attendu = vu.charge >= seuilDe(j.score)

    j.maintenu = false
    visee.relache(j, j.pointer)

    assert.equal(
      !j.fini,
      attendu,
      `dessin annonçait ${attendu ? 'une touche' : 'un raté'} (charge affichée ${vu.charge.toFixed(3)}) mais le résultat dit le contraire (graine ${graine})`,
    )
  }
})

test('appuyer puis relâcher n’importe où sur l’écran, en boucle, ne plante jamais et ne produit aucun NaN', () => {
  for (let essai = 0; essai < 25; essai++) {
    const j = fauxJeu(visee, { graine: essai + 1 })
    const ctx = fauxCtx()
    let t = 0
    while (t < 3) {
      const p = { x: j.hasard() * j.W - 40, y: j.hasard() * j.H - 40 }
      j.pointer = p
      if (j.hasard() < 0.5) {
        j.maintenu = true
        visee.appui(j, p)
      } else {
        j.maintenu = false
        visee.relache(j, p)
      }
      visee.maj(j, PAS)
      ctx.ops.length = 0
      visee.dessine(j, ctx)
      assert.ok(Number.isFinite(j.e.charge), `j.e.charge n’est plus fini (${j.e.charge})`)
      assert.ok(Number.isFinite(j.score), `j.score n’est plus fini (${j.score})`)
      assert.ok(!Number.isNaN(j.e.d), 'j.e.d est devenu NaN')
      t += PAS
      if (j.fini) break
    }
  }
})
