/**
 * Le village vivant (lot 6) — même discipline que partout ailleurs : aucune
 * scène ne peint quelque chose que l'état réel ne justifie pas. Ces tests
 * portent sur `village.js` seul (pas sur le routage, déjà couvert par
 * `front-ecran.test.js`) : la pureté de `phaseJour`, la forme de `PLOTS`, et
 * la réaction de chaque emplacement à la compagnie et à la ville qu'on lui
 * passe.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import * as VV from '../src/massif/front/vue/village.js'
import * as Cie from '../src/massif/front/compagnie.js'
import * as V from '../src/massif/front/ville.js'
import { fauxCtx } from './faux.js'

const j = { W: 360, H: 640, t: 0 }

const compte = (c, t = 0) => {
  const ctx = fauxCtx()
  VV.village(ctx, { ...j, t }, c)
  return ctx.ops.length
}

// --- phaseJour : pure, déterministe, bornée --------------------------------------------

test('phaseJour ne dépend que de ses arguments, jamais d’une horloge cachée', () => {
  const c = Cie.nouvelle(1)
  const a = VV.phaseJour(c, 12)
  const b = VV.phaseJour(c, 12)
  assert.equal(a, b, 'le même jour, à la même seconde de jeu, ne donne pas la même heure')
})

test('phaseJour reste dans [0, 1), et un autre jour à la même seconde ne montre pas la même heure', () => {
  const c = Cie.nouvelle(1)
  for (const t of [0, 1, 43, 90, 900, 12345]) {
    const p = VV.phaseJour(c, t)
    assert.ok(p >= 0 && p < 1, `phaseJour(${t}) = ${p}, hors de [0,1)`)
  }
  const jour1 = VV.phaseJour({ ville: { jour: 1 } }, 30)
  const jour2 = VV.phaseJour({ ville: { jour: 2 } }, 30)
  assert.notEqual(jour1, jour2, 'un autre jour à la même seconde montre la même heure')
})

// --- PLOTS : huit emplacements fixes, un routage connu ----------------------------------

test('PLOTS compte exactement huit emplacements, chacun avec un routage', () => {
  assert.equal(VV.PLOTS.length, 8)
  const ids = VV.PLOTS.map((p) => p.id)
  assert.equal(new Set(ids).size, 8, 'deux emplacements partagent le même id')
  for (const p of VV.PLOTS) {
    assert.ok(p.nom && p.quoi, `${p.id} n’a ni nom ni routage`)
    if (p.quoi === 'batiment') assert.ok(V.BAT[p.bat], `${p.id} route vers un bâtiment qui n’existe pas`)
  }
})

test('village() rend huit zones tactiles, une par emplacement, dans le même ordre', () => {
  const c = Cie.nouvelle(3)
  const ctx = fauxCtx()
  const zones = VV.village(ctx, j, c)
  assert.equal(zones.length, 8)
  zones.forEach((z, i) => {
    const p = VV.PLOTS[i]
    assert.equal(z.quoi, p.quoi)
    if (p.quoi === 'batiment') assert.equal(z.id, p.bat, 'la zone ne porte pas le même id que le bâtiment visé')
    assert.ok(z.w >= 44 && z.h >= 30, `${p.id} fait ${z.w}×${z.h}, trop petit pour un doigt`)
  })
})

// --- Rien n'est décoratif : chaque emplacement réagit à un état réel --------------------

test('la caserne montre plus de recrues à mesure qu’elle est construite, plafonné', () => {
  const niveaux = [0, 1, 2, 5].map((n) => {
    const c = Cie.nouvelle(7)
    c.ville.bat.caserne = n
    return compte(c)
  })
  assert.ok(niveaux[1] > niveaux[0], 'niveau 1 ne montre pas plus de monde que niveau 0')
  assert.ok(niveaux[2] > niveaux[1], 'niveau 2 ne montre pas plus de monde que niveau 1')
  assert.equal(niveaux[3], niveaux[2], 'le plafond de trois recrues n’est pas respecté')
})

test('le campement suit le nombre de troupes réellement alignées', () => {
  const pleine = Cie.nouvelle(7)
  const vide = Cie.nouvelle(7)
  vide.escouades.forEach((e) => (e.membres = []))
  assert.ok(Cie.alignees(pleine).length > 0)
  assert.equal(Cie.alignees(vide).length, 0)
  assert.ok(compte(pleine) > compte(vide), 'aucune troupe alignée ne change pourtant le dessin du campement')
})

test('un blessé fait apparaître un brancardier, un blessé de moins le fait disparaître', () => {
  const sain = Cie.nouvelle(7)
  const blesse = Cie.nouvelle(7)
  blesse.troupes[0].pv = 1
  assert.ok(compte(blesse) > compte(sain), 'la troupe blessée ne change rien à l’infirmerie')
})

test('le silo du grenier grandit avec son niveau, d’une hauteur fixe par niveau', () => {
  const hauteurs = [0, 1, 2, 3].map((n) => {
    const c = Cie.nouvelle(7)
    c.ville.bat.grenier = n
    const ctx = fauxCtx()
    VV.village(ctx, j, c)
    const silo = ctx.ops.find((o) => o.type === 'rect' && o.w === 28)
    return silo.h
  })
  assert.deepEqual(hauteurs, [14, 26, 38, 50], 'le silo ne suit plus la formule 14 + niveau × 12')
})

test('la taverne n’allume ses fenêtres que construite et de nuit', () => {
  const NUIT = 50
  const JOUR = 0
  assert.ok(VV.phaseJour(Cie.nouvelle(7), JOUR) < 0.85, 'le repère « jour » choisi pour ce test est en fait la nuit')
  assert.ok(VV.phaseJour(Cie.nouvelle(7), NUIT) > 0.85, 'le repère « nuit » choisi pour ce test est en fait le jour')

  const base = (t, niveau) => {
    const c = Cie.nouvelle(7)
    c.ville.bat.taverne = niveau
    return compte(c, t)
  }
  assert.equal(base(JOUR, 1), base(JOUR, 0), 'la taverne construite change le dessin en plein jour')
  assert.equal(base(NUIT, 0), base(JOUR, 0), 'une taverne non construite s’allume la nuit')
  assert.ok(base(NUIT, 1) > base(NUIT, 0), 'une taverne construite ne s’allume pas la nuit')
})

test('les échoppes montrent la forge, ou le marché, ou un terrain vague', () => {
  const rien = Cie.nouvelle(7)
  const avecForge = Cie.nouvelle(7)
  avecForge.ville.bat.forge = 1
  const avecMarche = Cie.nouvelle(7)
  avecMarche.ville.bat.marche = 1

  assert.ok(compte(avecForge) !== compte(rien), 'la forge ne change rien aux échoppes')
  assert.ok(compte(avecMarche) !== compte(rien), 'le marché ne change rien aux échoppes (perd « terrain vague »)')

  const texteVague = (c) => {
    const ctx = fauxCtx()
    VV.village(ctx, j, c)
    return ctx.ops.some((o) => o.type === 'texte' && o.s === 'TERRAIN VAGUE')
  }
  assert.ok(texteVague(rien), '« terrain vague » ne s’affiche pas quand rien n’est construit')
  assert.ok(!texteVague(avecForge), '« terrain vague » reste affiché malgré la forge construite')
  assert.ok(!texteVague(avecMarche), '« terrain vague » reste affiché malgré le marché construit')
})

test('la porte respire quand il y a un engagement à choisir, pas sinon', () => {
  const avecOffre = Cie.nouvelle(7)
  assert.ok(avecOffre.plan.length > 0, 'une compagnie neuve n’a aucun engagement proposé')
  const sansOffre = Cie.nouvelle(7)
  sansOffre.plan = []
  assert.ok(compte(avecOffre) > compte(sansOffre), 'la route ne réagit pas à l’absence d’engagement proposé')
})

test('l’état-major s’éclaire quand un dossier d’unique attend', () => {
  const avecDossier = Cie.nouvelle(7)
  assert.ok(avecDossier.offre.uniques.length > 0, 'une compagnie neuve n’a aucun dossier d’unique')
  const sansDossier = Cie.nouvelle(7)
  sansDossier.offre.uniques = []
  assert.ok(compte(avecDossier) > compte(sansDossier), 'l’état-major ne réagit pas à l’absence de dossier')
})
