/**
 * CORDE, et la faute qu'il ne faut plus jamais commettre.
 *
 * Le jeu sanctionnait au moment où la corde était dessinée *en haut*, à
 * 129 px au-dessus de la tête, alors que son pitch disait de sauter quand elle
 * passe sous les pieds. Dessin et règle étaient en opposition de phase exacte :
 * obéir à l'écran était mathématiquement mortel pendant les vingt premiers
 * points.
 *
 * Ces tests ne lisent pas l'état interne du jeu pour décider quand appuyer :
 * ils lisent **ce qui est dessiné**, comme le ferait un joueur. C'est la seule
 * façon d'attraper un mensonge entre l'image et la règle.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import corde from '../src/court/corde.js'
import { C } from '../src/palette.js'
import { fauxJeu, fauxCtx, PAS } from './faux.js'

const SOL = 470

/** Ce qu'un joueur voit : la corde, et si le sol est allumé. */
function regarde(ops) {
  // Le repère de la corde est le seul carré de 10 px en pleine couleur d'accent.
  const marque = ops.find((o) => o.type === 'rect' && o.couleur === C.accent && o.w === 10 && o.h === 10)
  // La fenêtre d'appui est la barre de 68 px posée sous le sol.
  const barre = ops.find((o) => o.type === 'rect' && o.w === 68 && Math.abs(o.y - (SOL + 8)) < 3)
  return {
    corde: marque ? { x: marque.x + 5, y: marque.y + 5 } : null,
    fenetre: barre?.couleur === C.accent,
  }
}

/** Joue une partie en n'obéissant qu'à l'écran. */
function partie({ duree = 60, decide }) {
  const j = fauxJeu(corde, { graine: 1 })
  const ctx = fauxCtx()
  let vu = { corde: null, fenetre: false }
  let precedent = vu
  const passages = []

  while (j.t < duree && !j.fini) {
    if (decide(vu, precedent, j.t)) corde.appui(j, j.pointer)

    const rang = Math.floor(j.e.phase)
    corde.maj(j, PAS)
    if (Math.floor(j.e.phase) > rang) {
      ctx.ops.length = 0
      corde.dessine(j, ctx)
      passages.push({ ...regarde(ctx.ops), mort: j.fini })
    }

    ctx.ops.length = 0
    corde.dessine(j, ctx)
    precedent = vu
    vu = regarde(ctx.ops)
    j.t += PAS
  }

  return { j, passages, mort: j.fini }
}

test('au moment sanctionné, la corde est dessinée au sol, sur les pieds', () => {
  // C'est la régression. Avant correction, elle était dessinée à y = 310.
  const { passages } = partie({ duree: 8, decide: (vu, avant) => vu.fenetre && !avant.fenetre })
  assert.ok(passages.length >= 3, 'pas assez de passages observés')
  for (const p of passages) {
    assert.ok(p.corde, 'repère de corde introuvable à l’écran')
    assert.ok(
      Math.abs(p.corde.y - SOL) <= 4,
      `la corde est dessinée en y=${Math.round(p.corde.y)} au moment du verdict, au lieu du sol (${SOL})`,
    )
    // À l'aplomb du personnage, à une image près : le verdict tombe sur la
    // première image après le passage, la corde a déjà repris sa course.
    assert.ok(Math.abs(p.corde.x - 180) <= 12, `la corde passe en x=${Math.round(p.corde.x)}, pas sur le personnage`)
  }
})

test('à mi-période, la corde est en haut et il ne se passe rien', () => {
  const j = fauxJeu(corde, { graine: 1 })
  const ctx = fauxCtx()
  while (j.e.phase < 0.5) corde.maj(j, PAS)
  corde.dessine(j, ctx)
  const vu = regarde(ctx.ops)
  assert.ok(vu.corde.y < 330, `la corde devrait être en haut, elle est en y=${Math.round(vu.corde.y)}`)
  assert.equal(j.fini, false, 'le jeu tue alors que la corde est au-dessus de la tête')
})

test('obéir à l’écran fait survivre — une minute entière', () => {
  // Le pilote n'appuie que sur le front montant du repère au sol. Il ne
  // connaît rien de l'état interne du jeu.
  const { j, mort } = partie({ duree: 60, decide: (vu, avant) => vu.fenetre && !avant.fenetre })
  assert.equal(mort, false, `mort au bout de ${j.t.toFixed(1)} s en suivant le repère affiché`)
  assert.ok(j.score >= 40, `seulement ${j.score} sauts en 60 s alors que le jeu était joué correctement`)
})

test('appuyer n’importe où dans la fenêtre allumée passe toujours', () => {
  // Pas seulement au front montant : tout instant où le sol est allumé.
  for (const retard of [0, 3, 6, 9, 12]) {
    let compte = -1
    const { j, mort } = partie({
      duree: 25,
      decide: (vu) => {
        if (!vu.fenetre) return ((compte = -1), false)
        compte++
        return compte === retard
      },
    })
    assert.equal(mort, false, `mort en appuyant ${retard} images après l’allumage (score ${j.score})`)
  }
})

test('ne rien faire tue au premier passage', () => {
  const { j, mort } = partie({ duree: 10, decide: () => false })
  assert.equal(mort, true, 'on survit sans jamais sauter')
  assert.equal(j.score, 0)
})

test('marteler le bouton ne suffit pas', () => {
  // Avant correction, un joueur qui martelait était littéralement invincible :
  // la règle ne regardait que « suis-je en l'air ». Elle regarde maintenant la
  // hauteur réelle des pieds.
  const { j, mort } = partie({ duree: 60, decide: () => true })
  assert.equal(mort, true, 'marteler le bouton survit une minute entière')
  assert.ok(j.score < 20, `marteler rapporte ${j.score} points, c'est une stratégie`)
})

test('un appui juste avant l’atterrissage est gardé, pas avalé', () => {
  const j = fauxJeu(corde, { graine: 1 })
  corde.appui(j, j.pointer)

  // On laisse le saut s'achever presque entièrement.
  while (j.e.saut > 0.1) corde.maj(j, PAS)
  corde.appui(j, j.pointer) // en plein vol : l'ancien code l'avalait sans bruit
  assert.ok(j.e.tampon > 0, 'l’appui n’a pas été mis en mémoire')

  let releve = false
  for (let i = 0; i < 20; i++) {
    const avant = j.e.saut
    corde.maj(j, PAS)
    if (j.e.saut > avant) releve = true
  }
  assert.ok(releve, 'l’appui gardé n’a pas relancé le saut à l’atterrissage')
})

test('un appui trop tôt dans le saut n’est pas gardé indéfiniment', () => {
  // Le tampon est une tolérance, pas un pilote automatique : il expire.
  const j = fauxJeu(corde, { graine: 1 })
  corde.appui(j, j.pointer)
  corde.maj(j, PAS)
  corde.appui(j, j.pointer)
  while (j.e.saut > 0) corde.maj(j, PAS)
  assert.equal(j.e.saut, 0, 'un appui du début du saut a relancé un saut à l’atterrissage')
})

test('une vie perdue ne renvoie pas au point de départ', () => {
  const j = fauxJeu(corde, { graine: 1 })
  j.e.cadence = 1.5
  j.e.phase = 12.4
  corde.reprend(j)
  assert.ok(j.e.cadence > 1.3, `la cadence est retombée à ${j.e.cadence}, quarante secondes de jeu effacées`)
  assert.ok(j.e.cadence < 1.5, 'une mort doit quand même coûter quelque chose')
  assert.equal(j.e.phase, 0)
  assert.equal(j.e.saut, 0)
})
