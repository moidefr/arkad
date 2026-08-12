/**
 * Ce qui est dessiné doit tenir dans l'écran, et sous le bandeau du moteur.
 *
 * C'est le seul test qui regarde l'image, et il n'a pas besoin de navigateur :
 * le faux contexte enregistre les rectangles et les textes, on les relit. Il
 * attrape la classe de bugs « invisible ou intouchable sur un téléphone », qui
 * ne se voit autrement qu'à l'œil, jeu par jeu.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TOUS } from '../src/catalogue.js'
import { fauxJeu, fauxCtx, PAS, W, H, HUD } from './faux.js'

/** Quelques instants d'une partie, pris à des moments différents. */
function instantanes(jeu, { images = 300, tousLes = 20 } = {}) {
  const j = fauxJeu(jeu, { graine: 3 })
  const ctx = fauxCtx()
  const prises = []

  for (let i = 0; i < images; i++) {
    if (j.fini) {
      j.fini = false
      ;(jeu.reprend ?? jeu.init)?.(j)
    }
    if (i % 4 === 0) {
      j.pointer.x = 40 + ((i * 37) % 280)
      j.pointer.y = 120 + ((i * 53) % 460)
      jeu.appui?.(j, j.pointer)
      jeu.relache?.(j, j.pointer)
    }
    jeu.maj?.(j, PAS)
    j.t += PAS

    if (i % tousLes === 0) {
      ctx.ops.length = 0
      jeu.dessine(j, ctx)
      prises.push({ t: j.t, ops: ctx.ops.slice() })
    }
  }
  return prises
}

test('aucun élément d’interface n’est caché sous le bandeau du moteur', () => {
  // Un objet de jeu qui traverse la zone du bandeau ne pose pas de problème :
  // il passe. Ce qui est grave, c'est un bouton, un panneau ou une légende
  // *immobile* posé là — le joueur ne le verra jamais et ne pourra pas le
  // toucher, le bouton pause occupe le coin.
  for (const jeu of TOUS) {
    const prises = instantanes(jeu)
    const compte = new Map()
    for (const prise of prises) {
      const vus = new Set()
      for (const op of prise.ops) {
        if (op.alpha === 0) continue
        const bas = op.type === 'rect' ? op.y + op.h : op.y
        if (bas >= HUD - 2) continue
        vus.add(`${op.type} ${Math.round(op.x)},${Math.round(op.y)} ${op.w ?? ''}×${op.h ?? ''}`)
      }
      for (const cle of vus) compte.set(cle, (compte.get(cle) ?? 0) + 1)
    }
    for (const [cle, n] of compte) {
      assert.ok(n < prises.length, `${jeu.id} : « ${cle} » est immobile sous le bandeau (${HUD}), donc invisible`)
    }
  }
})

test('rien ne sort de l’écran', () => {
  // Une marge : les effets et les objets qui entrent par le bord débordent
  // volontairement, et c'est très bien. On cherche ce qui est *hors sujet*.
  const MARGE = 200
  for (const jeu of TOUS) {
    for (const prise of instantanes(jeu)) {
      for (const op of prise.ops) {
        assert.ok(Number.isFinite(op.x) && Number.isFinite(op.y), `${jeu.id} : ${op.type} en (${op.x}, ${op.y})`)
        assert.ok(
          op.x > -MARGE && op.x < W + MARGE && op.y > -MARGE && op.y < H + MARGE,
          `${jeu.id} : ${op.type} très loin de l'écran, en (${Math.round(op.x)}, ${Math.round(op.y)})`,
        )
        if (op.type === 'rect') {
          assert.ok(op.w >= 0 && op.h >= 0, `${jeu.id} : rectangle de taille négative (${op.w} × ${op.h})`)
          assert.ok(op.w < 4000 && op.h < 4000, `${jeu.id} : rectangle démesuré (${op.w} × ${op.h})`)
        }
      }
    }
  }
})

test('chaque jeu dessine vraiment quelque chose, à chaque image', () => {
  for (const jeu of TOUS) {
    for (const prise of instantanes(jeu)) {
      assert.ok(prise.ops.length > 2, `${jeu.id} : écran quasi vide à t=${prise.t.toFixed(1)} s`)
    }
  }
})

test('aucune couleur invalide n’est envoyée au canvas', () => {
  for (const jeu of TOUS) {
    for (const prise of instantanes(jeu, { images: 120, tousLes: 15 })) {
      for (const op of prise.ops) {
        if (op.type === 'image') continue
        assert.match(op.couleur ?? '', /^(#[0-9a-f]{3,8}|rgba?\(|hsla?\()/i, `${jeu.id} : couleur « ${op.couleur} »`)
      }
    }
  }
})
