/**
 * Les suggestions retenues du lot 7 — babillard de contrats, cicatrices de
 * vétéran, saisons cosmétiques, compteur par classe, carnet de guerre.
 * Aucune n'ajoute de mécanique neuve : chacune recompose une donnée déjà
 * tenue par ailleurs, et c'est précisément ce que ces tests vérifient — pas
 * une case de plus à cocher, un texte ou un chiffre qui réagit vraiment.
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import * as C from '../src/massif/front/compagnie.js'
import * as V from '../src/massif/front/ville.js'
import * as B from '../src/massif/front/bataille.js'
import * as U from '../src/massif/front/unites.js'

const neuve = (g = 7) => C.nouvelle(g)

// --- Le babillard du poste de guet --------------------------------------------------

test('un contrat du guet a une échéance, les offres ordinaires n’en ont pas', () => {
  const c = neuve(9)
  c.ville.bat.guet = 3
  C.planifie(c)
  const veille = c.plan.filter((e) => e.expire != null)
  assert.ok(veille.length > 0, 'aucune offre du guet n’a d’échéance')
  assert.equal(veille.length, 3, 'le guet de niveau 3 ne pose pas trois offres à échéance')
  for (const e of veille) assert.equal(e.expire, c.ville.jour + V.DELAI_GUET)
  assert.ok(
    c.plan.some((e) => e.expire == null),
    'les offres ordinaires ont hérité d’une échéance',
  )
})

test('un contrat du guet retombe passé son échéance, pas avant', () => {
  const c = neuve(9)
  c.ville.bat.guet = 1
  C.planifie(c)
  const veille = c.plan.find((e) => e.expire != null)
  assert.ok(veille)

  V.passeJours(c, V.DELAI_GUET)
  assert.ok(
    c.plan.some((e) => e.k === veille.k),
    'le contrat a disparu avant son échéance',
  )

  V.passeJours(c, 1)
  assert.ok(!c.plan.some((e) => e.k === veille.k), 'le contrat n’a pas disparu passé son échéance')
})

// --- Les cicatrices de vétéran -----------------------------------------------------

test('cicatriceGagnee ne rend rien avant le seuil, puis une cicatrice jamais répétée', () => {
  const u = U.creeGenerique('piquier', 1, 'TEST', 'T')
  const rng = () => 0 // toujours le premier disponible : déterministe pour le test
  u.ramasse = 1
  assert.equal(V.cicatriceGagnee(u, rng), null, 'une cicatrice tombe hors du seuil')
  u.ramasse = V.SEUIL_CICATRICE
  const premiere = V.cicatriceGagnee(u, rng)
  assert.ok(V.CICATRICES.includes(premiere))
  u.ramasse = V.SEUIL_CICATRICE * 2
  const deuxieme = V.cicatriceGagnee(u, rng)
  assert.notEqual(deuxieme, premiere, 'la même cicatrice est retombée deux fois')
})

test('le pool de cicatrices s’épuise, jamais plus que ce qu’il contient', () => {
  const u = U.creeGenerique('piquier', 1, 'TEST', 'T')
  const rng = () => 0
  for (let i = 1; i <= V.CICATRICES.length; i++) {
    u.ramasse = V.SEUIL_CICATRICE * i
    assert.ok(V.cicatriceGagnee(u, rng), `la cicatrice ${i} n’a pas été gagnée`)
  }
  u.ramasse = V.SEUIL_CICATRICE * (V.CICATRICES.length + 1)
  assert.equal(V.cicatriceGagnee(u, rng), null, 'une cicatrice est sortie d’un pool déjà complet')
  assert.equal(u.cicatrices.length, V.CICATRICES.length)
})

test('une cicatrice se comporte comme si la classe elle-même la portait', () => {
  const u = U.creeGenerique('piquier', 1, 'TEST', 'T')
  const avant = U.passif(u, 'tenace')
  u.cicatrices = ['tenace']
  assert.ok(U.aptEffectives(u).includes('tenace'))
  assert.ok(U.passif(u, 'tenace') > avant, 'la cicatrice ne change rien à la passive')
})

test('ramassée assez de fois de suite, une troupe gagne réellement une cicatrice', () => {
  const c = neuve(5)
  const ref = c.troupes[0].id
  for (let i = 0; i < V.SEUIL_CICATRICE; i++) {
    const bat = C.prepare(c, 0)
    const cible = B.unitesDe(bat, 0).find((x) => x.ref === ref)
    cible.pv = 0
    bat.fini = 'gagne'
    C.bilan(c, bat)
  }
  const troupe = C.trouve(c, ref)
  assert.equal(troupe.ramasse, V.SEUIL_CICATRICE)
  assert.equal(troupe.cicatrices.length, 1, 'la cicatrice n’est pas arrivée au seuil')
})

// --- Les saisons cosmétiques --------------------------------------------------------

test('les saisons se succèdent et bouclent, sans rien stocker de plus que le jour', () => {
  const c = neuve(3)
  assert.equal(V.saison(c).id, 'printemps')
  c.ville.jour = 1 + V.JOURS_PAR_SAISON * 3
  assert.equal(V.saison(c).id, 'hiver')
  c.ville.jour = 1 + V.JOURS_PAR_SAISON * V.SAISONS.length
  assert.equal(V.saison(c).id, 'printemps', 'un cycle complet ne revient pas au printemps')
})

test('l’hiver coûte plus cher, à compagnie et bâtiments égaux', () => {
  const c = neuve(3)
  c.ville.jour = 1
  const coutPrintemps = V.coutJour(c)
  c.ville.jour = 1 + V.JOURS_PAR_SAISON * 3
  const coutHiver = V.coutJour(c)
  assert.ok(coutHiver > coutPrintemps, 'l’hiver ne coûte pas plus cher que le printemps')
})

// --- Le compteur cosmétique par classe ----------------------------------------------

test('le compteur par classe suit les recrues et les tombées, jamais l’inverse', () => {
  const c = neuve(7)
  const clDepart = c.troupes[0].cl
  assert.equal(c.historique[clDepart].recrutees, 1)
  assert.equal(c.historique[clDepart].tombees, 0)

  c.or = 999999
  C.rafraichit(c)
  const clRecrue = c.offre.caserne[0].cl
  const avant = c.historique[clRecrue]?.recrutees ?? 0
  C.recruteGenerique(c, clRecrue)
  assert.equal(c.historique[clRecrue].recrutees, avant + 1)

  const bat = C.prepare(c, 0)
  const cible = B.unitesDe(bat, 0)[0]
  const clCible = cible.cl
  for (const u of B.unitesDe(bat, 0)) u.pv = 0
  bat.fini = 'perdu'
  C.bilan(c, bat)
  assert.equal(c.historique[clCible].tombees, 1, 'la tombée n’a pas été comptée')
})

// --- Le carnet de guerre --------------------------------------------------------------

test('le carnet de guerre salue une victoire sans perte, à défaut de mieux à raconter', () => {
  const c = neuve(5)
  const bat = C.prepare(c, 0)
  bat.fini = 'gagne'
  const r = C.bilan(c, bat)
  assert.equal(r.montees.length, 0, 'une promotion fausse ce test — il lui faut un gain nul')
  assert.equal(r.cicatrices.length, 0)
  assert.equal(r.carnet, 'victoire sans perte')
})

test('le carnet de guerre nomme la troupe qui progresse, en priorité sur le reste', () => {
  const c = neuve(21)
  const bat = C.prepare(c, 0)
  const cible = B.unitesDe(bat, 0)[0]
  cible.tues = 50
  bat.fini = 'gagne'
  const r = C.bilan(c, bat)
  assert.ok(r.montees.length > 0, 'aucune promotion — le test ne prouve rien')
  const troupe = C.trouve(c, cible.ref)
  assert.ok(r.carnet && r.carnet.includes(U.nomComplet(troupe)), `carnet inattendu : ${r.carnet}`)
})

test('le carnet de guerre compte une série de victoires, à défaut de mieux à raconter', () => {
  const c = neuve(5)
  c.serie = 2
  const bat = C.prepare(c, 0)
  bat.fini = 'gagne'
  const r = C.bilan(c, bat)
  assert.equal(r.montees.length, 0, 'une promotion fausse ce test de série')
  assert.equal(r.cicatrices.length, 0)
  assert.equal(c.serie, 3)
  assert.equal(r.carnet, '3e victoire consécutive')
})

test('la série de victoires retombe à zéro après une défaite', () => {
  const c = neuve(6)
  c.serie = 4
  const bat = C.prepare(c, 0)
  for (const u of B.unitesDe(bat, 0)) u.pv = 0
  bat.fini = 'perdu'
  C.bilan(c, bat)
  assert.equal(c.serie, 0)
})

// --- La sauvegarde ---------------------------------------------------------------------

test('une sauvegarde d’avant le lot 7 migre proprement', () => {
  const c = C.nouvelle(20)
  const brut = JSON.parse(JSON.stringify(C.sauvegarde(c)))
  delete brut.c.serie
  delete brut.c.historique
  for (const u of brut.c.troupes) {
    delete u.cicatrices
    delete u.ramasse
  }
  const relu = C.migre(brut)
  assert.equal(relu.c.serie, 0)
  assert.ok(relu.c.historique && Object.keys(relu.c.historique).length > 0, 'l’historique n’est pas repeuplé du vivant')
  for (const u of relu.c.troupes) {
    assert.deepEqual(u.cicatrices, [])
    assert.equal(u.ramasse, 0)
  }
})
