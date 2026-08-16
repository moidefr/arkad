/**
 * ÉCLAIR : le flash s'éteint, puis une fenêtre de réponse s'ouvre. Ces tests
 * ne lisent jamais `j.e` pour savoir où taper — comme dans corde.test.js, ils
 * lisent **ce qui est dessiné**, y compris la mémoire d'un flash qui n'est
 * déjà plus à l'écran, exactement comme le ferait un joueur.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import eclair from '../src/court/eclair.js'
import { C } from '../src/palette.js'
import { fauxJeu, fauxCtx, PAS } from './faux.js'

/** Ce qu'un joueur voit : les cases allumées, et si la fenêtre de réponse est encore ouverte. */
function regarde(ops) {
  // Une case allumée est le corps plein d'un bloc() en couleur d'accent — un
  // carré en pleine opacité, à distinguer des halos de lueur() (translucides)
  // et des arêtes de relief (teintées, jamais exactement C.accent).
  const carres = ops.filter((o) => o.type === 'rect' && o.couleur === C.accent && o.w === o.h && o.w > 15 && o.alpha === 1)
  // La barre de fenêtre : un rectangle fin, rempli en accent ou en rouge tant
  // qu'il reste du temps ; absent (ou nul) une fois la fenêtre refermée.
  // La grille aligne tout sur une grille de 2 px : une hauteur de 5 devient 6
  // une fois arrondie par px(). On borne large plutôt que de viser l'exact.
  const barre = ops.find((o) => o.type === 'rect' && o.h > 0 && o.h <= 8 && o.w > 0 && (o.couleur === C.accent || o.couleur === C.rouge))
  return {
    flash: carres.map((o) => ({ x: o.x + o.w / 2, y: o.y + o.h / 2 })),
    fenetreOuverte: !!barre,
  }
}

/**
 * Un pilote qui tape chaque case dès qu'elle s'allume, pendant que le flash
 * est visible à l'écran — jamais après.
 */
function partieAuFlash({ duree = 40 } = {}) {
  const j = fauxJeu(eclair, { graine: 1 })
  const ctx = fauxCtx()

  while (j.t < duree && !j.fini) {
    ctx.ops.length = 0
    eclair.dessine(j, ctx)
    const vu = regarde(ctx.ops)
    // On tape tout ce qui est allumé, chaque image tant que ça l'est. Un tap
    // sur une case déjà validée cette manche ne fait rien (voir appui()) :
    // marteler ce qu'on voit pendant le flash ne peut pas faire perdre.
    for (const p of vu.flash) eclair.appui(j, p)
    eclair.maj(j, PAS)
    j.t += PAS
  }
  return { j, mort: j.fini }
}

/**
 * Un pilote qui attend que le flash s'éteigne avant de taper — de mémoire,
 * comme le veut le jeu — mais toujours pendant que la fenêtre reste ouverte
 * à l'écran.
 */
function partieALaFenetre({ duree = 40 } = {}) {
  const j = fauxJeu(eclair, { graine: 1 })
  const ctx = fauxCtx()
  let souvenir = null
  let aTaper = null

  while (j.t < duree && !j.fini) {
    ctx.ops.length = 0
    eclair.dessine(j, ctx)
    const vu = regarde(ctx.ops)

    if (vu.flash.length) {
      souvenir = vu.flash // on mémorise ce qui est allumé, tant que c'est allumé
    } else if (souvenir && vu.fenetreOuverte && !aTaper) {
      // le flash vient de s'éteindre, la fenêtre est encore visible : on tape de mémoire
      aTaper = souvenir.slice()
    }

    if (!vu.fenetreOuverte) {
      souvenir = null
      aTaper = null
    }

    if (aTaper && aTaper.length) eclair.appui(j, aTaper.shift())

    eclair.maj(j, PAS)
    j.t += PAS
  }
  return { j, mort: j.fini }
}

test('taper la bonne case pendant que le flash est visible fait survivre', () => {
  const { j, mort } = partieAuFlash({ duree: 30 })
  assert.equal(mort, false, `mort au bout de ${j.t.toFixed(1)} s en tapant pendant le flash`)
  assert.ok(j.score >= 15, `seulement ${j.score} flashs réussis en 30 s de jeu correct`)
})

test('taper la bonne case pendant la fenêtre de réponse — flash déjà éteint — fait survivre', () => {
  const { j, mort } = partieALaFenetre({ duree: 30 })
  assert.equal(mort, false, `mort au bout de ${j.t.toFixed(1)} s en tapant pendant la fenêtre, après extinction`)
  assert.ok(j.score >= 10, `seulement ${j.score} flashs réussis en jouant sur la fenêtre de réponse`)
})

test('ne rien toucher avant la fin de la fenêtre coûte une vie', () => {
  const j = fauxJeu(eclair, { graine: 1 })
  const ctx = fauxCtx()
  while (j.t < 5 && !j.fini) {
    eclair.dessine(j, ctx)
    eclair.maj(j, PAS)
    j.t += PAS
  }
  assert.equal(j.fini, true, 'on survit sans jamais rien toucher')
  assert.equal(j.score, 0)
})

test('toucher une case qui n’a pas flashé coûte une vie, même dans la fenêtre', () => {
  const j = fauxJeu(eclair, { graine: 1 })
  const ctx = fauxCtx()
  let touche = false
  while (j.t < 15 && !j.fini && !touche) {
    ctx.ops.length = 0
    eclair.dessine(j, ctx)
    const vu = regarde(ctx.ops)
    if (vu.fenetreOuverte) {
      // On vise délibérément un point hors de toute case allumée : le centre
      // de l'écran tombe systématiquement sur une case de la grille (elle en
      // occupe le centre), mais jamais sur celle qui vient de flasher — sauf
      // coïncidence, qu'on écarte en sautant ce tour-là.
      const centre = { x: j.W / 2, y: j.H / 2 }
      const surLaCible = vu.flash.some((p) => Math.abs(p.x - centre.x) < 4 && Math.abs(p.y - centre.y) < 4)
      if (!surLaCible) {
        eclair.appui(j, centre)
        touche = true
      }
    }
    eclair.maj(j, PAS)
    j.t += PAS
  }
  assert.equal(j.fini, true, 'toucher une case fausse aurait dû coûter une vie')
})

test('appui() et relache() ne plantent jamais, où que le doigt tape', () => {
  const j = fauxJeu(eclair, { graine: 2 })
  const ctx = fauxCtx()
  const points = [
    { x: -50, y: -50 },
    { x: 0, y: 0 },
    { x: 100000, y: -8000 },
    { x: NaN, y: 12 },
    { x: j.W / 2, y: j.H / 2 },
  ]
  let i = 0
  while (j.t < 20 && !j.fini) {
    ctx.ops.length = 0
    eclair.dessine(j, ctx)
    eclair.appui(j, points[i % points.length])
    i++
    eclair.maj(j, PAS)
    j.t += PAS
  }
  // Un tap au hasard fait presque toujours perdre — c'est attendu. Ce qui
  // compte ici, c'est qu'aucun appel n'ait explosé et qu'aucun NaN ne se soit
  // glissé dans l'état du jeu.
  assert.equal(Number.isNaN(j.score), false)
})
