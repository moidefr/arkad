/**
 * La compagnie : le recrutement, les escouades, et surtout **la persistance**.
 *
 * C'est le point où un jeu de ce genre se casse en silence : une sauvegarde
 * qui perd une troupe, un unique qu'on peut acheter deux fois, un dépôt qui
 * grossit sans fin. On le vérifie ici, campagne entière comprise.
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import * as C from '../src/massif/front/compagnie.js'
import * as B from '../src/massif/front/bataille.js'
import * as IA from '../src/massif/front/ia.js'
import * as U from '../src/massif/front/unites.js'
import { UNIQUES } from '../src/massif/front/donnees/uniques.js'
import { CLASSES } from '../src/massif/front/donnees/classes.js'

const neuve = (g = 7) => C.nouvelle(g)

test('une compagnie neuve est jouable telle quelle', () => {
  const c = neuve()
  assert.equal(c.niveau, 1)
  assert.ok(c.or > 0)
  assert.equal(c.troupes.length, 3)
  assert.equal(c.escouades.length, 1)
  assert.equal(C.alignees(c).length, 3)
  assert.ok(c.plan.length >= 2, 'aucun engagement proposé')
  assert.ok(c.offre.caserne.length > 0 && c.offre.uniques.length > 0)
})

test('deux recrues ne portent jamais le même identifiant', () => {
  const c = neuve()
  const ids = new Set(c.troupes.map((t) => t.id))
  assert.equal(ids.size, c.troupes.length)
})

test('recruter coûte, ajoute, et retire l’offre de l’étal', () => {
  const c = neuve()
  c.or = 5000
  const ligne = c.offre.caserne[0]
  const avant = c.or
  const u = C.recruteGenerique(c, ligne.cl)
  assert.ok(u)
  assert.equal(c.or, avant - ligne.prix)
  assert.equal(c.troupes.length, 4)
  assert.ok(!c.offre.caserne.some((x) => x.cl === ligne.cl), 'la ligne reste achetable')
})

test('on ne recrute pas sans or', () => {
  const c = neuve()
  c.or = 0
  assert.equal(C.recruteGenerique(c, c.offre.caserne[0].cl), null)
  assert.equal(c.troupes.length, 3)
})

test('le dépôt a un plafond', () => {
  const c = neuve()
  c.or = 999999
  for (let i = 0; i < 40; i++) {
    if (!c.offre.caserne.length) C.rafraichit(c)
    C.recruteGenerique(c, c.offre.caserne[0].cl)
  }
  assert.ok(c.troupes.length <= C.depotMax(c.niveau), `${c.troupes.length} pour un plafond de ${C.depotMax(c.niveau)}`)
})

test('un unique se recrute une fois et ne repasse plus jamais', () => {
  const c = neuve()
  c.niveau = 6
  C.rafraichit(c)
  c.or = 999999
  const ligne = c.offre.uniques[0]
  const u = C.recruteUnique(c, ligne.uq)
  assert.ok(u)
  assert.ok(c.uniquesVus.includes(ligne.uq))
  for (let e = 0; e < 40; e++) {
    c.engagements = e
    C.rafraichit(c)
    assert.ok(!c.offre.uniques.some((x) => x.uq === ligne.uq), `réapparu à l’engagement ${e}`)
  }
})

test('l’offre d’état-major affiche un vrai taux, cohérent avec le tirage', () => {
  const c = neuve()
  c.niveau = 12
  C.rafraichit(c)
  for (const o of c.offre.uniques) {
    assert.ok(o.taux > 0 && o.taux < 1, `taux ${o.taux}`)
    assert.ok(o.prix > 0)
    assert.ok(o.niv >= 1)
  }
  assert.equal(new Set(c.offre.uniques.map((o) => o.uq)).size, c.offre.uniques.length, 'un doublon dans l’offre')
})

test('réformer rend de l’or et retire la troupe de son escouade', () => {
  const c = neuve()
  const u = c.troupes[2]
  const avant = c.or
  const rendu = C.reforme(c, u.id)
  assert.ok(rendu > 0)
  assert.equal(c.or, avant + rendu)
  assert.equal(C.trouve(c, u.id), null)
  assert.ok(!c.escouades[0].membres.includes(u.id))
})

// --- Escouades --------------------------------------------------------------------

test('une troupe n’est jamais dans deux escouades', () => {
  const c = neuve()
  c.niveau = 12
  const b = C.creeEscouade(c)
  assert.ok(b)
  const id = c.troupes[0].id
  C.affecte(c, b, id)
  assert.equal(c.escouades.filter((e) => e.membres.includes(id)).length, 1)
})

test('une escouade ne dépasse pas sa taille', () => {
  const c = neuve()
  c.or = 999999
  for (let i = 0; i < 8; i++) {
    if (!c.offre.caserne.length) C.rafraichit(c)
    C.recruteGenerique(c, c.offre.caserne[0].cl)
  }
  const e = c.escouades[0]
  for (const t of c.troupes) C.affecte(c, e, t.id)
  assert.ok(e.membres.length <= C.tailleEscouade(c.niveau), `${e.membres.length}`)
})

test('un chef d’escouade est au moins caporal', () => {
  const c = neuve()
  const e = c.escouades[0]
  const soldat = c.troupes.find((t) => t.grade === 0)
  assert.equal(C.nommeChef(c, e, soldat.id), false)
  // Un grade se gagne au feu : le niveau ne suffit plus, il faut avoir servi.
  soldat.niv = 6
  soldat.batailles = 8
  soldat.grade = U.gradeAtteint(soldat)
  assert.ok(soldat.grade >= 1)
  assert.equal(C.nommeChef(c, e, soldat.id), true)
})

test('le nombre de places au front suit le niveau, et plafonne', () => {
  let prec = 0
  for (let n = 1; n <= 30; n++) {
    const p = C.places(n)
    assert.ok(p >= prec, `niveau ${n}`)
    prec = p
  }
  assert.equal(C.places(30), 12)
  assert.ok(C.escouadesMax(1) === 1 && C.escouadesMax(20) === 3)
})

test('on n’aligne jamais plus de troupes qu’il n’y a de places', () => {
  const c = neuve()
  c.or = 999999
  for (let i = 0; i < 12; i++) {
    if (!c.offre.caserne.length) C.rafraichit(c)
    C.recruteGenerique(c, c.offre.caserne[0].cl)
  }
  for (const t of c.troupes) C.affecte(c, c.escouades[0], t.id)
  assert.ok(C.alignees(c).length <= C.places(c.niveau))
})

// --- Les engagements ----------------------------------------------------------------

test('les engagements proposés grandissent avec le niveau', () => {
  const petit = C.dimensions(1)
  const grand = C.dimensions(18)
  assert.ok(grand.cols > petit.cols && grand.rows > petit.rows)
  assert.ok(C.toursMaxDe(18) > C.toursMaxDe(1))
})

test('un engagement se monte avec les deux armées et un objectif tenable', () => {
  for (let n = 1; n <= 18; n += 3) {
    const c = neuve(100 + n)
    c.niveau = n
    C.planifie(c)
    const bat = C.prepare(c, 0)
    assert.ok(bat, `niveau ${n} : pas de bataille`)
    assert.ok(B.vivantes(bat, 0).length > 0 && B.vivantes(bat, 1).length > 0, `niveau ${n}`)
    assert.equal(B.fini(bat), null, `niveau ${n} : finie avant de commencer`)
    // Deux troupes ne se marchent jamais dessus.
    const places = bat.unites.map((u) => u.q + ':' + u.r)
    assert.equal(new Set(places).size, places.length, `niveau ${n} : deux troupes sur la même case`)
  }
})

test('l’ennemi grossit avec la compagnie, sans jamais devenir une foule', () => {
  const complete = (niveau) => {
    const c = neuve(3)
    c.niveau = niveau
    c.or = 999999
    while (c.troupes.length < C.places(niveau)) {
      if (!c.offre.caserne.length) {
        c.engagements++
        C.rafraichit(c)
      }
      if (!C.recruteGenerique(c, c.offre.caserne[0].cl)) break
    }
    while (c.escouades.length < C.escouadesMax(niveau)) C.creeEscouade(c)
    for (const e of c.escouades) e.membres = []
    for (const t of c.troupes) for (const e of c.escouades) C.affecte(c, e, t.id)
    C.planifie(c)
    return C.prepare(c, 0)
  }
  const petits = complete(1)
  const gros = complete(16)
  assert.ok(
    B.vivantes(gros, 1).length > B.vivantes(petits, 1).length,
    `${B.vivantes(gros, 1).length} contre ${B.vivantes(petits, 1).length}`,
  )
  assert.ok(B.vivantes(gros, 1).length <= 16)
  // L'ennemi se règle sur ce qu'on aligne : jamais plus d'une troupe d'écart.
  assert.ok(B.vivantes(gros, 1).length <= B.vivantes(gros, 0).length + 1)
})

// --- Le bilan --------------------------------------------------------------------------

test('une victoire paie, fait monter, et ramasse les tombés', () => {
  const c = neuve(11)
  const bat = C.prepare(c, 0)
  const tombe = B.unitesDe(bat, 0)[0]
  tombe.pv = 0
  tombe.degats = 40
  for (const u of B.unitesDe(bat, 1)) u.pv = 0
  bat.fini = 'gagne'
  const orAvant = c.or
  const combien = c.troupes.length
  const r = C.bilan(c, bat)
  assert.ok(r.gagne && r.or > 0 && r.renom > 0)
  assert.equal(c.or, orAvant + r.or)
  assert.equal(c.troupes.length, combien, 'une troupe a disparu après une victoire')
  assert.ok(C.trouve(c, tombe.ref).pv > 0, 'le ramassé n’est pas rentré')
  assert.equal(C.trouve(c, tombe.ref).blesse, 1)
  assert.equal(c.engagements, 1)
})

test('une défaite coûte les tombés — sauf ceux qui ont un nom', () => {
  const c = neuve(12)
  c.niveau = 8
  C.rafraichit(c)
  c.or = 999999
  const uq = C.recruteUnique(c, c.offre.uniques[0].uq)
  C.affecte(c, c.escouades[0], uq.id)
  C.planifie(c)
  const bat = C.prepare(c, 0)
  for (const u of B.unitesDe(bat, 0)) u.pv = 0
  bat.fini = 'perdu'
  const alignes = B.unitesDe(bat, 0).map((u) => u.ref)
  C.bilan(c, bat)
  assert.ok(c.troupes.length < alignes.length + 1 || alignes.length === 0)
  assert.ok(C.trouve(c, uq.id), 'un unique a été perdu')
  assert.ok(C.trouve(c, uq.id).pv > 0)
  for (const ref of alignes) {
    const u = C.trouve(c, ref)
    if (u) assert.ok(u.uq, `un générique tombé a survécu à une défaite : ${ref}`)
  }
})

test('soigner coûte, et rend exactement la santé', () => {
  const c = neuve()
  const u = c.troupes[0]
  u.pv = 3
  const prix = C.coutSoin(c, u)
  assert.ok(prix > 0)
  c.or = prix
  assert.ok(C.soigne(c, u.id))
  assert.equal(u.pv, U.fiche(u).pvMax)
  assert.equal(c.or, 0)
  assert.equal(C.coutSoin(c, u), 0)
  assert.equal(C.soigne(c, u.id), false, 'on paie pour rien')
})

// --- Persistance -----------------------------------------------------------------------

test('la sauvegarde se relit à l’identique, bataille en cours comprise', () => {
  const c = neuve(31)
  const bat = C.prepare(c, 0)
  IA.joueCamp(bat, 0)
  B.finTour(bat)
  const brut = JSON.parse(JSON.stringify(C.sauvegarde(c, bat)))
  const relu = C.migre(brut)
  assert.ok(relu)
  assert.equal(relu.c.troupes.length, c.troupes.length)
  assert.equal(relu.bat.tour, bat.tour)
  // On reprend la bataille là où elle en était, et elle se termine.
  let garde = 0
  while (!B.fini(relu.bat) && garde++ < 400) {
    IA.joueCamp(relu.bat, relu.bat.camp)
    if (!B.fini(relu.bat)) B.finTour(relu.bat)
  }
  assert.ok(B.fini(relu.bat))
})

test('une sauvegarde d’une autre version est refusée, pas devinée', () => {
  const c = neuve()
  const brut = JSON.parse(JSON.stringify(C.sauvegarde(c, null)))
  brut.v = 999
  assert.equal(C.migre(brut), null)
  assert.equal(C.migre(null), null)
  assert.equal(C.migre({ v: C.VERSION }), null)
})

test('une sauvegarde reste petite, même à quinze batailles', () => {
  const c = neuve(52)
  c.niveau = 15
  c.or = 999999
  for (let i = 0; i < 20; i++) {
    if (!c.offre.caserne.length) C.rafraichit(c)
    C.recruteGenerique(c, c.offre.caserne[0].cl)
  }
  C.planifie(c)
  const bat = C.prepare(c, 0)
  const taille = JSON.stringify(C.sauvegarde(c, bat)).length
  assert.ok(taille < 24000, `${taille} octets`)
})

// --- Une campagne entière ----------------------------------------------------------------

test('trente engagements enchaînés : la compagnie monte, sans jamais dérailler', () => {
  const c = C.nouvelle(20260813)
  const vus = []
  for (let n = 0; n < 30 && !C.aneantie(c); n++) {
    // Un joueur passe à la caserne entre deux engagements : la campagne se
    // mesure avec ce réflexe, pas sans lui.
    while (c.troupes.length < C.places(c.niveau) && c.offre.caserne.length) {
      const abordable = c.offre.caserne.filter((l) => l.prix <= c.or).sort((a, b) => b.prix - a.prix)[0]
      if (!abordable) break
      C.recruteGenerique(c, abordable.cl)
    }
    for (const t of c.troupes) if (C.coutSoin(c, t) <= c.or * 0.3) C.soigne(c, t.id)

    // On garnit l'escouade avec ce qu'on a de mieux, comme le ferait un joueur.
    for (const e of c.escouades) e.membres = []
    const meilleurs = [...c.troupes].sort((a, b) => U.fiche(b).att - U.fiche(a).att)
    for (const t of meilleurs) for (const e of c.escouades) C.affecte(c, e, t.id)

    const bat = C.prepare(c, n % c.plan.length)
    if (!bat) break
    let garde = 0
    while (!B.fini(bat) && garde++ < 400) {
      IA.joueCamp(bat, bat.camp)
      if (!B.fini(bat)) B.finTour(bat)
    }
    assert.ok(B.fini(bat), `engagement ${n} sans fin`)
    const r = C.bilan(c, bat)
    vus.push(r.gagne)

    assert.ok(c.or >= 0, `or négatif à l’engagement ${n}`)
    assert.ok(c.niveau >= 1 && c.niveau < 40, `niveau ${c.niveau}`)
    assert.equal(new Set(c.troupes.map((t) => t.id)).size, c.troupes.length, 'doublon dans le dépôt')
    for (const t of c.troupes) {
      assert.ok(t.pv > 0 && t.pv <= U.fiche(t).pvMax, `${t.nom} : ${t.pv}/${U.fiche(t).pvMax}`)
      assert.ok(t.niv >= 1 && t.niv <= c.niveau + 3, `${t.nom} niveau ${t.niv} pour une compagnie ${c.niveau}`)
      assert.equal(t.grade, U.gradeAtteint(t), `${t.nom} : grade incohérent`)
    }
    while (c.escouades.length < C.escouadesMax(c.niveau)) C.creeEscouade(c)
  }
  assert.ok(vus.length >= 10, `campagne interrompue après ${vus.length} engagements`)
  assert.ok(
    vus.some((v) => v) && vus.some((v) => !v),
    'une campagne entière sans une seule victoire ou sans une seule défaite',
  )
})

test('les uniques croisés au fil d’une campagne restent variés', () => {
  const c = C.nouvelle(4711)
  const vus = new Set()
  for (let n = 0; n < 25; n++) {
    c.engagements = n
    c.niveau = 1 + Math.floor(n * 0.7)
    C.rafraichit(c)
    for (const o of c.offre.uniques) vus.add(o.uq)
  }
  assert.ok(vus.size >= 12, `seulement ${vus.size} uniques différents proposés en 25 offres`)
  assert.ok(vus.size < UNIQUES.length, 'toute la table passe : plus rien à découvrir')
})

// --- Ce que le banc a trouvé --------------------------------------------------------

test('le repos entre deux engagements sort de la spirale, sans tout rendre', () => {
  const c = neuve(77)
  const u = c.troupes[0]
  const max = U.fiche(u).pvMax
  u.pv = 4
  C.repos(c)
  assert.ok(u.pv > 4, 'le repos ne rend rien')
  assert.ok(u.pv <= Math.round(max * C.PLAFOND_REPOS), 'le repos rend trop')
  // Deux repos de suite plafonnent : le dernier tiers se paie à l’infirmerie.
  C.repos(c)
  C.repos(c)
  assert.ok(u.pv <= Math.round(max * C.PLAFOND_REPOS))
  assert.ok(C.coutSoin(c, u) > 0, 'l’infirmerie n’a plus rien à vendre')
})

test('une compagnie qui enchaîne les engagements ne s’étiole pas', () => {
  const c = C.nouvelle(31415)
  const sante = []
  for (let n = 0; n < 8; n++) {
    for (const t of c.troupes) if (C.coutSoin(c, t) <= c.or * 0.3) C.soigne(c, t.id)
    const bat = C.prepare(c, n % c.plan.length)
    if (!bat) break
    let garde = 0
    while (!B.fini(bat) && garde++ < 400) {
      IA.joueCamp(bat, bat.camp)
      if (!B.fini(bat)) B.finTour(bat)
    }
    C.bilan(c, bat)
    if (c.troupes.length) sante.push(c.troupes.reduce((s, t) => s + t.pv / U.fiche(t).pvMax, 0) / c.troupes.length)
  }
  // Sans le repos gratuit, cette moyenne s'effondrait d'engagement en
  // engagement et la campagne mourait de ses pansements impayables.
  const fin = sante.slice(-4).reduce((s, x) => s + x, 0) / Math.max(1, sante.slice(-4).length)
  assert.ok(fin > 0.5, `la compagnie finit à ${(fin * 100).toFixed(0)} % de sa santé`)
})

test('tenir le choc se joue plus vite qu’une bataille ordinaire', () => {
  const c = neuve(99)
  c.niveau = 12
  c.or = 999999
  while (c.troupes.length < C.places(c.niveau)) {
    if (!c.offre.caserne.length) {
      c.engagements++
      C.rafraichit(c)
    }
    const u = C.recruteGenerique(c, c.offre.caserne[0].cl)
    if (!u) break
    C.enrole(c, u.id)
  }
  C.planifie(c)
  c.plan[0].objectif = 'survie'
  const bat = C.prepare(c, 0)
  assert.ok(bat.toursMax < C.toursMaxDe(c.niveau), 'le compte à rebours n’est pas raccourci')
  // Et l'ennemi est en force, sinon ce n'est qu'une bataille avec un compteur.
  assert.ok(
    B.forceRestante(bat, 1) > B.forceRestante(bat, 0) * 1.1,
    `l’ennemi n’est pas en force : ${B.forceRestante(bat, 1)} contre ${B.forceRestante(bat, 0)}`,
  )
})
