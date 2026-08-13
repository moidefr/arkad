/**
 * La bataille, au point près.
 *
 * Tout est déterministe : chaque scénario est monté à la main, joué, et le
 * résultat est comparé à un nombre exact. C'est la seule façon d'oser un jeu
 * à trente-cinq classes — mesurer, pas espérer.
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import * as B from '../src/massif/front/bataille.js'
import * as IA from '../src/massif/front/ia.js'
import * as U from '../src/massif/front/unites.js'
import * as C from '../src/massif/front/compagnie.js'
import { INDICE, TERRAINS } from '../src/massif/front/terrain.js'
import { APTITUDES, APT } from '../src/massif/front/donnees/aptitudes.js'
import { CLASSES } from '../src/massif/front/donnees/classes.js'
import { versAxial, distance, cle } from '../src/massif/front/hex.js'
import { indice } from '../src/massif/front/carte.js'

// --- Le banc d'essai ----------------------------------------------------------

const plat = (cols, rows, fond = 'plaine') => ({
  cols,
  rows,
  biome: 'plaine',
  cases: new Array(cols * rows).fill(INDICE[fond]),
})

const met = (carte, col, lig, id) => (carte.cases[indice(carte, col, lig)] = INDICE[id])

function troupe(clId, camp, col, lig, niv = 1, options = {}) {
  const u = U.creeGenerique(clId, niv, 'TEST', 'X')
  if (options.apt) u.apt = options.apt
  if (options.grade != null) u.grade = options.grade
  u.pv = U.fiche(u).pvMax
  const a = versAxial(col, lig)
  const e = B.engage(u, camp, a.q, a.r)
  if (options.pv != null) e.pv = options.pv
  if (options.moral != null) e.moral = options.moral
  return e
}

const monte = (carte, mien, sien, objectif = { id: 'annihilation' }, opts = {}) =>
  B.commence(carte, objectif, mien, sien, opts)

const enCol = (bat, u) => {
  const o = { q: u.q, r: u.r }
  return o
}

// --- Déplacement ---------------------------------------------------------------

test('le coût d’entrée est celui du terrain', () => {
  const carte = plat(9, 7)
  met(carte, 3, 3, 'foret')
  met(carte, 4, 3, 'route')
  met(carte, 5, 3, 'montagne')
  const u = troupe('fantassin', 0, 2, 3)
  const bat = monte(carte, [u], [troupe('milicien', 1, 8, 0)])
  const a = versAxial(3, 3)
  const r = versAxial(4, 3)
  const m = versAxial(5, 3)
  assert.equal(B.coutEntree(bat, u, a.q, a.r), 2)
  assert.equal(B.coutEntree(bat, u, r.q, r.r), 0.5)
  assert.equal(B.coutEntree(bat, u, m.q, m.r), Infinity)
})

test('la route porte plus loin qu’un chemin droit dans la boue', () => {
  const boue = plat(11, 5, 'boue')
  for (let col = 0; col < 11; col++) met(boue, col, 2, 'route')
  const u = troupe('fantassin', 0, 0, 2)
  const bat = monte(boue, [u], [troupe('milicien', 1, 10, 0)])
  const loin = B.destinations(bat, u).filter((d) => d.r === versAxial(0, 2).r)
  // 4 points de mouvement à 0,5 le pas : huit cases de route.
  assert.equal(Math.max(...loin.map((d) => d.cout)), 4)
  assert.ok(loin.some((d) => Math.abs(d.cout - 4) < 1e-9))
})

test('une montagne n’est jamais atteignable', () => {
  const carte = plat(9, 7)
  met(carte, 3, 3, 'montagne')
  const u = troupe('eclaireur', 0, 2, 3)
  const bat = monte(carte, [u], [troupe('milicien', 1, 8, 0)])
  const m = versAxial(3, 3)
  assert.ok(!B.destinations(bat, u).some((d) => d.q === m.q && d.r === m.r))
})

test('la zone de contrôle arrête net une troupe qui la traverse', () => {
  const carte = plat(11, 5)
  const u = troupe('eclaireur', 0, 1, 2)
  const garde = troupe('fantassin', 1, 4, 2)
  const bat = monte(carte, [u], [garde])
  const dests = B.destinations(bat, u)
  // Six points de mouvement : sans zone de contrôle, la case 7,2 serait à portée.
  const loin = versAxial(7, 2)
  assert.ok(!dests.some((d) => d.q === loin.q && d.r === loin.r), 'la zone de contrôle ne retient rien')
  const collee = versAxial(3, 2)
  assert.ok(dests.some((d) => d.q === collee.q && d.r === collee.r))
})

test('« insaisissable » traverse les zones de contrôle', () => {
  const carte = plat(11, 5)
  const libre = troupe('eclaireur', 0, 1, 2, 1, { apt: ['insaisissable'] })
  const lent = troupe('eclaireur', 0, 1, 2, 1, { apt: [] })
  const garde = troupe('fantassin', 1, 4, 2)
  const bat = monte(carte, [libre], [garde])
  const avec = B.destinations(bat, libre).length
  const bat2 = monte(carte, [lent], [troupe('fantassin', 1, 4, 2)])
  assert.ok(avec > B.destinations(bat2, lent).length, 'la passive ne sert à rien')
})

test('« montagnard » et « pontonnier » aplanissent le terrain', () => {
  const carte = plat(9, 7)
  met(carte, 3, 3, 'rocaille')
  met(carte, 4, 3, 'riviere')
  const m = troupe('eclaireur', 0, 2, 3, 1, { apt: ['montagnard'] })
  const p = troupe('eclaireur', 0, 2, 3, 1, { apt: ['pontonnier'] })
  const bat = monte(carte, [m], [troupe('milicien', 1, 8, 0)])
  const roc = versAxial(3, 3)
  const riv = versAxial(4, 3)
  assert.equal(B.coutEntree(bat, m, roc.q, roc.r), 1)
  assert.equal(B.coutEntree(bat, p, riv.q, riv.r), 1)
})

test('annuler un déplacement remet tout exactement en place', () => {
  const carte = plat(9, 7)
  const u = troupe('fantassin', 0, 2, 3)
  const bat = monte(carte, [u], [troupe('milicien', 1, 8, 0)])
  const avant = { q: u.q, r: u.r, pm: u.pm }
  const d = versAxial(4, 3)
  assert.ok(B.deplace(bat, u, d.q, d.r))
  assert.notEqual(u.q, avant.q)
  assert.ok(B.annuleDeplacement(bat, u))
  assert.deepEqual({ q: u.q, r: u.r, pm: u.pm }, avant)
})

test('on ne peut pas s’arrêter sur un allié, mais on le traverse', () => {
  const carte = plat(11, 5)
  const u = troupe('eclaireur', 0, 1, 2)
  const ami = troupe('fantassin', 0, 2, 2)
  const bat = monte(carte, [u, ami], [troupe('milicien', 1, 10, 0)])
  const sur = versAxial(2, 2)
  const apres = versAxial(3, 2)
  const dests = B.destinations(bat, u)
  assert.ok(!dests.some((d) => d.q === sur.q && d.r === sur.r), 'on se pose sur un allié')
  assert.ok(
    dests.some((d) => d.q === apres.q && d.r === apres.r),
    'on ne traverse pas un allié',
  )
  assert.equal(B.deplace(bat, u, sur.q, sur.r), null)
})

// --- Vue ------------------------------------------------------------------------

test('une forêt coupe la vue, une colline la donne', () => {
  const carte = plat(11, 5)
  for (let lig = 0; lig < 5; lig++) met(carte, 3, lig, 'foret')
  const bas = troupe('archer', 0, 1, 2)
  const bat = monte(carte, [bas], [troupe('milicien', 1, 10, 2)])
  const loin = versAxial(6, 2)
  assert.equal(B.voitCase(bat, bas, loin.q, loin.r), false)
  met(carte, 1, 2, 'colline')
  assert.equal(B.voitCase(bat, bas, loin.q, loin.r), true, 'la hauteur ne sert à rien')
})

test('une troupe en forêt ne se voit qu’à un pas', () => {
  const carte = plat(11, 5)
  met(carte, 6, 2, 'foret')
  const oeil = troupe('eclaireur', 0, 1, 2)
  const cachee = troupe('traqueur', 1, 6, 2)
  const bat = monte(carte, [oeil], [cachee])
  assert.equal(B.voitUnite(bat, 0, cachee), false)
  const pres = versAxial(5, 2)
  oeil.q = pres.q
  oeil.r = pres.r
  assert.equal(B.voitUnite(bat, 0, cachee), true)
})

test('un fumigène aveugle, puis se dissipe', () => {
  const carte = plat(11, 5)
  const tireur = troupe('archer', 0, 1, 2)
  const sapeur = troupe('eclaireur', 0, 2, 2, 1, { apt: ['fumigene'] })
  const cible = troupe('milicien', 1, 4, 2)
  const bat = monte(carte, [tireur, sapeur], [cible])
  assert.ok(B.peutAttaquer(bat, tireur, cible))
  B.lanceOrdre(bat, sapeur, APT.fumigene, { q: cible.q, r: cible.r })
  assert.equal(B.voitCase(bat, tireur, cible.q, cible.r), false)
  B.finTour(bat)
  B.finTour(bat)
  assert.equal(bat.fumees.length, 0, 'la fumée ne se dissipe pas')
})

// --- Dégâts ---------------------------------------------------------------------

test('la prévision est exactement ce qui tombe', () => {
  for (const cl of CLASSES) {
    const carte = plat(11, 5)
    const u = troupe(cl.id, 0, 4, 2, 3)
    const c = troupe('fantassin', 1, 5, 2, 3)
    const bat = monte(carte, [u], [c])
    if (!B.peutAttaquer(bat, u, c)) continue
    const p = B.prevision(bat, u, c)
    const pvAvant = c.pv
    const miensAvant = u.pv
    const r = B.attaque(bat, u, c)
    assert.equal(r.degats, p.final, `${cl.id} : dégâts annoncés ${p.final}, subis ${r.degats}`)
    assert.equal(c.pv, Math.max(0, pvAvant - p.final), cl.id)
    assert.equal(miensAvant - u.pv, p.riposte, `${cl.id} : riposte annoncée ${p.riposte}`)
  }
})

test('le couvert réduit vraiment, et « perce-armure » l’annule à moitié', () => {
  const nu = () => {
    const carte = plat(11, 5)
    const u = troupe('archer', 0, 2, 2, 3)
    const c = troupe('fantassin', 1, 4, 2, 3)
    return B.prevision(B.commence(carte, { id: 'annihilation' }, [u], [c]), u, c).final
  }
  const abrite = () => {
    const carte = plat(11, 5)
    met(carte, 4, 2, 'tranchee')
    const u = troupe('archer', 0, 2, 2, 3)
    const c = troupe('fantassin', 1, 4, 2, 3)
    return B.prevision(B.commence(carte, { id: 'annihilation' }, [u], [c]), u, c).final
  }
  const perce = () => {
    const carte = plat(11, 5)
    met(carte, 4, 2, 'tranchee')
    const u = troupe('archer', 0, 2, 2, 3, { apt: ['perce_armure'] })
    const c = troupe('fantassin', 1, 4, 2, 3)
    return B.prevision(B.commence(carte, { id: 'annihilation' }, [u], [c]), u, c).final
  }
  assert.ok(abrite() < nu(), `tranchée sans effet : ${abrite()} contre ${nu()}`)
  assert.ok(perce() > abrite() && perce() < nu(), `${nu()} / ${abrite()} / ${perce()}`)
})

test('le triangle des types se voit dans les dégâts', () => {
  const contre = (clA, clB) => {
    const carte = plat(11, 5)
    const u = troupe(clA, 0, 4, 2, 5)
    const c = troupe(clB, 1, 5, 2, 5)
    return B.prevision(B.commence(carte, { id: 'annihilation' }, [u], [c]), u, c).final
  }
  assert.ok(contre('cavalier', 'archer') > contre('cavalier', 'fantassin'), 'la cavalerie ne craint pas les piques')
  assert.ok(contre('piquier', 'cavalier') > contre('piquier', 'fantassin'), 'les piques ne servent à rien')
})

test('la hauteur, le revers et la charge s’additionnent au bon endroit', () => {
  const base = () => {
    const carte = plat(11, 5)
    const u = troupe('fantassin', 0, 4, 2, 4)
    const c = troupe('fantassin', 1, 5, 2, 4)
    return B.prevision(B.commence(carte, { id: 'annihilation' }, [u], [c]), u, c)
  }
  const haut = () => {
    const carte = plat(11, 5)
    met(carte, 4, 2, 'colline')
    const u = troupe('fantassin', 0, 4, 2, 4)
    const c = troupe('fantassin', 1, 5, 2, 4)
    return B.prevision(B.commence(carte, { id: 'annihilation' }, [u], [c]), u, c)
  }
  const revers = () => {
    const carte = plat(11, 5)
    const u = troupe('fantassin', 0, 4, 2, 4)
    const ami = troupe('fantassin', 0, 5, 1, 4)
    const c = troupe('fantassin', 1, 5, 2, 4)
    return B.prevision(B.commence(carte, { id: 'annihilation' }, [u, ami], [c]), u, c)
  }
  assert.ok(haut().final > base().final, 'la hauteur ne rapporte rien')
  assert.ok(revers().final > base().final, 'prendre à revers ne rapporte rien')
  assert.ok(revers().detail.some((d) => d.nom === 'PRIS À REVERS'))
})

test('la charge récompense l’élan, et seulement au contact', () => {
  const carte = plat(15, 5)
  const cav = troupe('cavalier', 0, 1, 2, 4)
  const cible = troupe('archer', 1, 6, 2, 4)
  const bat = monte(carte, [cav], [cible])
  const surPlaceAvant = { ...cav }
  const d = versAxial(5, 2)
  B.deplace(bat, cav, d.q, d.r)
  assert.ok(cav.parcouru >= 4)
  const p = B.prevision(bat, cav, cible)
  assert.ok(
    p.detail.some((x) => x.nom === 'CHARGE'),
    'aucune charge après quatre hexagones',
  )
  assert.equal(surPlaceAvant.parcouru, 0)
})

test('la riposte n’a lieu qu’à portée, et jamais d’un mort', () => {
  const carte = plat(11, 5)
  const arc = troupe('archer', 0, 2, 2, 4)
  const loin = troupe('fantassin', 1, 5, 2, 4)
  const bat = monte(carte, [arc], [loin])
  assert.equal(B.prevision(bat, arc, loin).riposte, 0, 'un fantassin riposte à trois cases')

  const carte2 = plat(11, 5)
  const cogneur = troupe('brise_ligne', 0, 4, 2, 12)
  const faible = troupe('frondeur', 1, 5, 2, 1)
  const bat2 = monte(carte2, [cogneur], [faible])
  const p = B.prevision(bat2, cogneur, faible)
  assert.ok(p.mortelle)
  assert.equal(p.riposte, 0, 'un mort riposte')
})

test('« tenace » sauve une fois, et une seule', () => {
  const carte = plat(11, 5)
  const dur = troupe('milicien', 1, 5, 2, 1, { apt: ['tenace'], pv: 20 })
  const gros = troupe('brise_ligne', 0, 4, 2, 14)
  const bat = monte(carte, [gros], [dur])
  B.attaque(bat, gros, dur)
  assert.equal(dur.pv, 1, 'tenace n’a pas retenu le coup')
  gros.aAgi = false
  B.attaque(bat, gros, dur)
  assert.equal(dur.pv, 0, 'tenace a servi deux fois')
})

test('une volée éclabousse les voisins de la cible', () => {
  const carte = plat(11, 7)
  const eng = troupe('baliste', 0, 2, 3, 5)
  const a = troupe('milicien', 1, 5, 3, 3)
  const b = troupe('milicien', 1, 5, 2, 3)
  const bat = monte(carte, [eng], [a, b])
  const avant = b.pv
  const r = B.attaque(bat, eng, a)
  assert.ok(r.eclats.length >= 1, 'la volée n’éclabousse personne')
  assert.ok(b.pv < avant)
})

// --- Moral et commandement --------------------------------------------------------

test('l’aura d’un gradé renforce ses voisins, et ne s’empile pas', () => {
  const carte = plat(11, 5)
  const seul = troupe('fantassin', 0, 4, 2, 4)
  const bat1 = monte(carte, [seul], [troupe('fantassin', 1, 5, 2, 4)])
  const attSeul = B.fiche(bat1, seul).att

  const commande = troupe('fantassin', 0, 4, 2, 4)
  const chef = troupe('fantassin', 0, 4, 1, 8, { grade: 3 })
  const chef2 = troupe('fantassin', 0, 3, 2, 8, { grade: 3 })
  const bat2 = monte(carte, [commande, chef, chef2], [troupe('fantassin', 1, 5, 2, 4)])
  const attCommande = B.fiche(bat2, commande).att
  assert.ok(attCommande > attSeul, 'l’aura ne fait rien')

  const bat3 = monte(
    carte,
    [troupe('fantassin', 0, 4, 2, 4), troupe('fantassin', 0, 4, 1, 8, { grade: 3 })],
    [troupe('fantassin', 1, 5, 2, 4)],
  )
  assert.equal(B.fiche(bat3, bat3.unites[0]).att.toFixed(6), attCommande.toFixed(6), 'deux gradés s’empilent')
})

test('abattre un gradé casse le moral de tout ce qu’il commandait', () => {
  const carte = plat(11, 5)
  const chef = troupe('fantassin', 1, 5, 2, 8, { grade: 3, pv: 1 })
  const suivant = troupe('milicien', 1, 5, 1, 3)
  const tueur = troupe('brise_ligne', 0, 4, 2, 14)
  const bat = monte(carte, [tueur], [chef, suivant])
  const avant = suivant.moral
  B.attaque(bat, tueur, chef)
  assert.equal(chef.pv, 0)
  assert.ok(suivant.moral < avant - 15, `moral ${avant} → ${suivant.moral}`)
})

test('une troupe ébranlée frappe moins fort, une troupe en déroute ne fait rien', () => {
  const carte = plat(11, 5)
  const sain = troupe('fantassin', 0, 4, 2, 4)
  const bat1 = monte(carte, [sain], [troupe('fantassin', 1, 5, 2, 4)])
  const plein = B.prevision(bat1, sain, bat1.unites[1]).final

  const casse = troupe('fantassin', 0, 4, 2, 4, { moral: 10 })
  const bat2 = monte(carte, [casse], [troupe('fantassin', 1, 5, 2, 4)])
  assert.ok(B.prevision(bat2, casse, bat2.unites[1]).final < plein)

  const rompu = troupe('fantassin', 0, 4, 2, 4, { moral: 0 })
  const bat3 = monte(carte, [rompu], [troupe('fantassin', 1, 5, 2, 4)])
  assert.equal(B.peutAttaquer(bat3, rompu, bat3.unites[1]), false)
  assert.equal(B.destinations(bat3, rompu).length, 0)
})

test('le moral remonte à la fin de chaque tour', () => {
  const carte = plat(11, 5)
  const u = troupe('fantassin', 0, 2, 2, 4, { moral: 20 })
  const bat = monte(carte, [u], [troupe('fantassin', 1, 9, 2, 4)])
  const avant = u.moral
  B.finTour(bat)
  assert.ok(u.moral > avant)
})

// --- Ordres -----------------------------------------------------------------------

test('chaque ordre change réellement quelque chose', () => {
  for (const a of APTITUDES.filter((x) => x.ordre)) {
    const carte = plat(13, 7)
    met(carte, 6, 3, 'riviere')
    // Le lanceur est écorné : un ordre qui soigne doit avoir de quoi soigner,
    // sinon le test ne mesure que la chance d'avoir choisi le bon décor.
    const u = troupe('fantassin', 0, 5, 3, 6, { apt: [a.id], grade: 2, pv: 30 })
    const ami = troupe('milicien', 0, 5, 2, 3, { pv: 5, moral: 40 })
    const ennemi = troupe('milicien', 1, 6, 3, 3)
    const ennemi2 = troupe('milicien', 1, 7, 3, 3)
    const bat = monte(carte, [u, ami], [ennemi, ennemi2])
    const avant = JSON.stringify([
      bat.unites.map((x) => [x.pv, x.moral, x.etats.length, x.pm]),
      bat.fumees,
      bat.pieges,
      bat.carte.cases,
    ])
    const cibles = B.ciblesOrdre(bat, u, a)
    assert.ok(cibles.length, `${a.id} : aucune cible légale dans un cas pourtant favorable`)
    // On vise la case la plus intéressante : un ennemi s'il y en a un à portée.
    const cible =
      cibles.find((h) => B.uniteA(bat, h.q, h.r) && B.uniteA(bat, h.q, h.r).camp !== 0) ??
      cibles.find((h) => B.uniteA(bat, h.q, h.r)) ??
      cibles[0]
    const r = B.lanceOrdre(bat, u, a, cible)
    assert.ok(r, `${a.id} : refusé`)
    const apres = JSON.stringify([
      bat.unites.map((x) => [x.pv, x.moral, x.etats.length, x.pm]),
      bat.fumees,
      bat.pieges,
      bat.carte.cases,
    ])
    assert.notEqual(apres, avant, `${a.id} : l’ordre ne change rien`)
    assert.ok(B.froidDe(u, a.id) > 0, `${a.id} : pas de refroidissement`)
  }
})

test('un ordre en refroidissement n’est pas jouable, et se recharge au fil des tours', () => {
  const carte = plat(11, 5)
  const u = troupe('fantassin', 0, 2, 2, 4, { apt: ['retranchement'] })
  const bat = monte(carte, [u], [troupe('fantassin', 1, 9, 2, 4)])
  assert.ok(B.ordresJouables(bat, u).length)
  B.lanceOrdre(bat, u, APT.retranchement, { q: u.q, r: u.r })
  const froid = B.froidDe(u, 'retranchement')
  assert.ok(froid > 0)
  for (let i = 0; i < froid; i++) {
    B.finTour(bat)
    B.finTour(bat)
  }
  assert.equal(B.froidDe(u, 'retranchement'), 0)
  assert.ok(B.ordresJouables(bat, u).length)
})

test('une mine blesse celui qui marche dessus, une fois', () => {
  const carte = plat(11, 5)
  const sap = troupe('sapeur', 0, 2, 2, 4)
  const ennemi = troupe('fantassin', 1, 6, 2, 4)
  const bat = monte(carte, [sap], [ennemi])
  const trou = versAxial(3, 2)
  B.lanceOrdre(bat, sap, APT.mine, trou)
  assert.equal(bat.pieges.length, 1)
  B.finTour(bat)
  const avant = ennemi.pv
  B.deplace(bat, ennemi, trou.q, trou.r)
  assert.ok(ennemi.pv < avant, 'la mine n’explose pas')
  assert.equal(bat.pieges.length, 0)
})

test('jeter un pont ouvre une rivière', () => {
  const carte = plat(11, 5)
  met(carte, 3, 2, 'riviere')
  const ing = troupe('ingenieur', 0, 2, 2, 6)
  const bat = monte(carte, [ing], [troupe('fantassin', 1, 9, 2, 4)])
  const riv = versAxial(3, 2)
  assert.equal(B.coutEntree(bat, ing, riv.q, riv.r), 1, 'un ingénieur est pontonnier')
  B.lanceOrdre(bat, ing, APT.ponton, riv)
  const autre = troupe('fantassin', 0, 2, 3, 4)
  bat.unites.push(autre)
  assert.equal(B.coutEntree(bat, autre, riv.q, riv.r), 1)
})

// --- Objectifs --------------------------------------------------------------------

test('anéantir : la bataille s’arrête quand un camp tombe', () => {
  const carte = plat(11, 5)
  const gros = troupe('brise_ligne', 0, 4, 2, 14)
  const petit = troupe('milicien', 1, 5, 2, 1, { pv: 8 })
  const bat = monte(carte, [gros], [petit])
  assert.equal(B.fini(bat), null)
  B.attaque(bat, gros, petit)
  assert.equal(B.fini(bat), 'gagne')
})

test('percer : deux troupes au bord adverse suffisent', () => {
  const carte = plat(9, 5)
  const a = troupe('eclaireur', 0, 7, 2)
  const b = troupe('eclaireur', 0, 7, 3)
  const bat = monte(carte, [a, b], [troupe('fantassin', 1, 0, 0)], { id: 'percee', besoin: 2 })
  B.deplace(bat, a, versAxial(8, 2).q, versAxial(8, 2).r)
  B.deplace(bat, b, versAxial(8, 3).q, versAxial(8, 3).r)
  B.finTour(bat)
  assert.equal(B.fini(bat), 'gagne')
})

test('décapiter : abattre l’officier gagne la bataille', () => {
  const carte = plat(11, 5)
  const chef = troupe('milicien', 1, 5, 2, 1, { grade: 3, pv: 8 })
  const garde = troupe('fantassin', 1, 8, 2, 4)
  const tueur = troupe('brise_ligne', 0, 4, 2, 14)
  const bat = monte(carte, [tueur], [chef, garde], { id: 'decapitation', chef: chef.ref })
  B.attaque(bat, tueur, chef)
  assert.equal(B.fini(bat), 'gagne')
})

test('tenir le choc : arriver au bout du compte à rebours est une victoire', () => {
  const carte = plat(11, 5)
  const u = troupe('fantassin', 0, 1, 2, 6)
  const bat = monte(carte, [u], [troupe('fantassin', 1, 9, 2, 1)], { id: 'survie' }, { toursMax: 3 })
  for (let i = 0; i < 8 && !B.fini(bat); i++) B.finTour(bat)
  assert.equal(B.fini(bat), 'gagne')
})

test('tenir les points : il faut les occuper trois tours de suite', () => {
  const carte = plat(11, 5)
  const points = [versAxial(4, 1), versAxial(4, 3)]
  const a = troupe('fantassin', 0, 4, 1, 4)
  const b = troupe('fantassin', 0, 4, 3, 4)
  const bat = monte(carte, [a, b], [troupe('fantassin', 1, 10, 0, 1)], { id: 'capture', points, besoin: 3 })
  for (let i = 0; i < 6 && !B.fini(bat); i++) B.finTour(bat)
  assert.equal(B.fini(bat), 'gagne')
  assert.ok(bat.tour <= 5, `gagné au tour ${bat.tour}`)
})

test('le temps qui s’épuise fait perdre, sauf quand l’objectif est de durer', () => {
  const carte = plat(11, 5)
  const bat = monte(
    carte,
    [troupe('fantassin', 0, 1, 2, 4)],
    [troupe('fantassin', 1, 9, 2, 4)],
    { id: 'annihilation' },
    { toursMax: 2 },
  )
  for (let i = 0; i < 8 && !B.fini(bat); i++) B.finTour(bat)
  assert.equal(B.fini(bat), 'perdu')
})

// --- Le tour et ses invariants ------------------------------------------------------

test('agir consomme l’action, et un tireur mobile garde son mouvement', () => {
  const carte = plat(11, 5)
  const lourd = troupe('archer', 0, 4, 2, 4)
  const mobile = troupe('tirailleur', 0, 4, 3, 6)
  const cible = troupe('fantassin', 1, 5, 2, 4)
  const bat = monte(carte, [lourd, mobile], [cible])
  B.attaque(bat, lourd, cible)
  assert.equal(lourd.pm, 0, 'un archer garde son mouvement')
  assert.ok(lourd.aAgi)
  B.attaque(bat, mobile, cible)
  assert.ok(mobile.pm > 0, 'le tirailleur ne peut pas décrocher')
  assert.ok(B.destinations(bat, mobile).length > 0)
})

test('un nouveau tour rend le mouvement et l’action', () => {
  const carte = plat(11, 5)
  const u = troupe('fantassin', 0, 4, 2, 4)
  const cible = troupe('fantassin', 1, 5, 2, 4)
  const bat = monte(carte, [u], [cible])
  B.attaque(bat, u, cible)
  assert.ok(B.aFini(u))
  B.finTour(bat)
  B.finTour(bat)
  assert.equal(u.aAgi, false)
  assert.equal(u.pm, B.fiche(bat, u).mvt)
  assert.equal(bat.tour, 2)
})

// --- Parties entières ----------------------------------------------------------------

test('cent batailles complètes se terminent, sans jamais casser un invariant', () => {
  let gagnees = 0
  let tours = 0
  for (let n = 0; n < 100; n++) {
    const c = C.nouvelle(1000 + n)
    // On monte la compagnie de quelques niveaux pour couvrir les grandes cartes.
    c.niveau = 1 + (n % 16)
    c.troupes = U.recrues(
      () => ((n * 9301 + 49297) % 233280) / 233280,
      CLASSES.filter((x) => x.rang <= c.niveau),
      c.niveau,
      C.places(c.niveau),
    )
    c.escouades = [{ nom: 'PREMIÈRE', chef: c.troupes[0].id, membres: c.troupes.map((t) => t.id) }]
    C.planifie(c)
    const bat = C.prepare(c, n % c.plan.length)
    assert.ok(bat, 'aucune bataille montée')

    let garde = 0
    while (!B.fini(bat) && garde++ < 400) {
      IA.joueCamp(bat, bat.camp)
      if (B.fini(bat)) break
      B.finTour(bat)
      for (const u of bat.unites) {
        assert.ok(u.pv <= u.pvMax, 'vie au-dessus du maximum')
        assert.ok(u.pv >= 0 && u.pm >= 0, 'valeur négative')
        assert.ok(u.moral >= 0 && u.moral <= B.MORAL_PLEIN, `moral ${u.moral}`)
        assert.ok(B.terrainSous(bat, u), 'une troupe est sortie de la carte')
      }
    }
    assert.ok(B.fini(bat), `bataille ${n} sans fin après ${garde} tours`)
    assert.ok(bat.tour <= bat.toursMax + 1, `bataille ${n} : ${bat.tour} tours`)
    tours += bat.tour
    if (B.fini(bat) === 'gagne') gagnees++
  }
  // Les deux camps jouent la même IA : sur cent batailles, ni l'un ni l'autre
  // ne doit gagner systématiquement — sinon c'est un défaut de règle, pas de
  // stratégie. Le camp 0 joue en premier, il garde un léger avantage.
  assert.ok(gagnees >= 25 && gagnees <= 80, `${gagnees} victoires sur 100`)
  assert.ok(tours / 100 > 3, `batailles trop courtes : ${(tours / 100).toFixed(1)} tours`)
})

test('la bataille se sérialise et se relit à l’identique', () => {
  const c = C.nouvelle(4242)
  const bat = C.prepare(c, 0)
  IA.joueCamp(bat, 0)
  B.finTour(bat)
  const copie = JSON.parse(JSON.stringify(bat))
  assert.equal(copie.tour, bat.tour)
  assert.deepEqual(
    copie.unites.map((u) => [u.ref, u.pv, u.q, u.r]),
    bat.unites.map((u) => [u.ref, u.pv, u.q, u.r]),
  )
  // Et on peut continuer à jouer dessus : c'est tout l'intérêt.
  IA.joueCamp(copie, copie.camp)
  assert.ok(copie.journal.length >= bat.journal.length)
})
