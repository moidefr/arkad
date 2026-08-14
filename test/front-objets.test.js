/**
 * Les objets de FRONT — même discipline que les aptitudes : vocabulaire
 * fermé, une clé qui n'est pas lue par le moteur est un fardeau inerte.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  OBJETS,
  OBJ,
  EMPLACEMENTS,
  EFFETS_OBJET,
  TIERS,
  TIER_MAX,
  prixAmelioration,
} from '../src/massif/front/donnees/objets.js'
import { PASSIFS } from '../src/massif/front/donnees/aptitudes.js'
import * as U from '../src/massif/front/unites.js'
import * as C from '../src/massif/front/compagnie.js'
import * as B from '../src/massif/front/bataille.js'
import * as A from '../src/massif/front/adversaire.js'

/**
 * Les mêmes fichiers que `front-regles.test.js lisSources()` : un passif
 * n'est pas forcément lu dans `unites.js` lui-même (c'est souvent
 * `bataille.js` qui applique son effet, `unites.js` ne fait que le porter).
 */
async function lisSource() {
  const fichiers = ['bataille.js', 'unites.js', 'ia.js', 'compagnie.js']
  const parts = await Promise.all(
    fichiers.map((f) => readFile(new URL('../src/massif/front/' + f, import.meta.url), 'utf8')),
  )
  return parts.join('\n')
}

// --- Le vocabulaire fermé ------------------------------------------------------------

test('chaque objet parle un vocabulaire fermé, consommé par unites.js', async () => {
  const src = await lisSource()
  const vus = new Set()
  for (const o of OBJETS) {
    assert.ok(!vus.has(o.id), 'objet en double : ' + o.id)
    vus.add(o.id)
    assert.ok(EMPLACEMENTS.includes(o.emplacement), `${o.id} : emplacement inconnu (${o.emplacement})`)
    assert.ok(o.nom.length >= 3 && o.prix > 0 && o.rang >= 1, o.id)

    // Un objet porte un bonus, un passif, ou les deux — jamais rien.
    assert.ok(o.bonus || o.passif, `${o.id} ne fait rien`)

    if (o.bonus) {
      for (const cle of Object.keys(o.bonus)) {
        assert.ok(EFFETS_OBJET.includes(cle), `${o.id} : effet hors vocabulaire (${cle})`)
      }
    }
    if (o.passif) {
      assert.ok(PASSIFS.includes(o.passif), `${o.id} : passif hors vocabulaire (${o.passif})`)
      // Un objet ne fait qu'ajouter une SOURCE à un passif déjà interprété —
      // donc sa clé doit déjà être lue quelque part par les règles.
      assert.ok(src.includes(`'${o.passif}'`), `${o.id} : le passif « ${o.passif} » n’est lu nulle part`)
    }
  }
})

test('un objet ne porte jamais d’ordre — règle dure du plafond de 3 boutons', () => {
  for (const o of OBJETS) assert.ok(!('ordre' in o), `${o.id} porte un ordre, c’est interdit`)
})

test('chaque effet du vocabulaire est réellement utilisé par au moins un objet', () => {
  for (const cle of EFFETS_OBJET) {
    assert.ok(
      OBJETS.some((o) => o.bonus?.[cle]),
      `effet orphelin : ${cle}`,
    )
  }
})

test('les trois emplacements ont chacun plusieurs objets, à plusieurs rangs', () => {
  for (const emp of EMPLACEMENTS) {
    const ceux = OBJETS.filter((o) => o.emplacement === emp)
    assert.ok(ceux.length >= 5, `${emp} : seulement ${ceux.length} objets`)
    assert.ok(
      ceux.some((o) => o.rang === 1),
      `${emp} : rien au rang 1`,
    )
  }
})

// --- Le round-trip ---------------------------------------------------------------------

test('équiper puis déséquiper ne duplique ni ne perd l’instance', () => {
  const c = C.nouvelle(11)
  const u = c.troupes[0]
  c.objets.push({ id: 'lame_courte', tier: 1 })
  assert.ok(C.equipeObjet(c, u.id, 'arme', 0))
  assert.equal(c.objets.length, 0)
  assert.deepEqual(u.equip.arme, { id: 'lame_courte', tier: 1 })

  assert.ok(C.deposeObjet(c, u.id, 'arme'))
  assert.equal(c.objets.length, 1)
  assert.equal(u.equip.arme, null)
  assert.deepEqual(c.objets[0], { id: 'lame_courte', tier: 1 })
})

test('équiper sur un emplacement occupé rend l’ancien occupant au dépôt', () => {
  const c = C.nouvelle(12)
  const u = c.troupes[0]
  c.objets.push({ id: 'lame_courte', tier: 1 }, { id: 'lame_longue', tier: 1 })
  assert.ok(C.equipeObjet(c, u.id, 'arme', 0))
  assert.ok(C.equipeObjet(c, u.id, 'arme', 0)) // le seul objet restant au dépôt après le premier équipement
  assert.deepEqual(u.equip.arme, { id: 'lame_longue', tier: 1 })
  assert.deepEqual(c.objets, [{ id: 'lame_courte', tier: 1 }])
})

test('on ne peut pas équiper un objet dans le mauvais emplacement', () => {
  const c = C.nouvelle(13)
  const u = c.troupes[0]
  c.objets.push({ id: 'lame_courte', tier: 1 })
  assert.equal(C.equipeObjet(c, u.id, 'armure', 0), false)
  assert.equal(c.objets.length, 1, 'l’objet a été retiré du dépôt malgré le refus')
})

test('réformer une troupe rend son équipement au dépôt', () => {
  const c = C.nouvelle(14)
  const u = c.troupes[0]
  c.objets.push({ id: 'lame_courte', tier: 1 })
  C.equipeObjet(c, u.id, 'arme', 0)
  C.reforme(c, u.id)
  assert.deepEqual(c.objets, [{ id: 'lame_courte', tier: 1 }])
})

// --- L'effet réel -------------------------------------------------------------------

test('équiper change réellement la fiche — sinon l’objet est décoratif', () => {
  const c = C.nouvelle(15)
  const u = c.troupes[0]
  const avant = U.fiche(u)
  c.objets.push({ id: 'plastron_grave', tier: 1 })
  C.equipeObjet(c, u.id, 'armure', 0)
  const apres = U.fiche(u)
  assert.ok(apres.def > avant.def, 'la défense n’a pas bougé')
  assert.ok(apres.pvMax > avant.pvMax, 'les points de vie n’ont pas bougé')
})

test('un objet à passif se comporte exactement comme si la classe le portait', () => {
  const c = C.nouvelle(16)
  const u = c.troupes[0]
  assert.equal(U.passif(u, 'cuirasse'), 0)
  c.objets.push({ id: 'plastron_grave', tier: 1 })
  C.equipeObjet(c, u.id, 'armure', 0)
  assert.ok(U.passif(u, 'cuirasse') > 0)
  assert.ok(U.aptEffectives(u).includes('cuirasse'))
  // Mais u.apt lui-même — la donnée de la classe — n’a pas été modifiée : la
  // fusion vit à la lecture, pas en écrivant dans l’état persistant.
  assert.ok(!u.apt.includes('cuirasse'))
})

test('les tiers d’amélioration multiplient le bonus, jamais le passif', () => {
  const c = C.nouvelle(17)
  const u = c.troupes[0]
  c.objets.push({ id: 'lame_courte', tier: 1 })
  C.equipeObjet(c, u.id, 'arme', 0)
  const att1 = U.fiche(u).att
  u.equip.arme.tier = 2
  const att2 = U.fiche(u).att
  assert.ok(att2 > att1, 'le tier 2 ne change rien')
  assert.equal(att2 - (att1 - OBJ.lame_courte.bonus.att), OBJ.lame_courte.bonus.att * TIERS[1].mult)
})

test('la forge plafonne au niveau du bâtiment, et coûte de l’or', () => {
  const c = C.nouvelle(18)
  c.niveau = 12
  c.or = 1000000
  const u = c.troupes[0]
  c.objets.push({ id: 'lame_courte', tier: 1 })
  C.equipeObjet(c, u.id, 'arme', 0)
  assert.ok(C.ameliore(c, u.id, 'arme', 2))
  assert.equal(u.equip.arme.tier, 2)
  assert.equal(C.ameliore(c, u.id, 'arme', 2), false, 'la forge de niveau 2 ne devrait pas monter au tier 3')
  assert.ok(C.ameliore(c, u.id, 'arme', TIER_MAX))
  assert.equal(u.equip.arme.tier, TIER_MAX)
  assert.equal(C.ameliore(c, u.id, 'arme', TIER_MAX), false, 'au-delà du tier maximum')
})

test('l’adversaire réagit à l’équipement, puisqu’il passe par fiche()', () => {
  const c = C.nouvelle(19)
  const u = c.troupes[0]
  const avant = A.valeur(u)
  c.objets.push({ id: 'lame_longue', tier: 1 })
  C.equipeObjet(c, u.id, 'arme', 0)
  assert.ok(A.valeur(u) > avant)
})

// --- Le butin ------------------------------------------------------------------------

test('le butin ne tombe que sur une victoire, et jamais sur une défaite ou une retraite', () => {
  for (let n = 0; n < 30; n++) {
    const c = C.nouvelle(2000 + n)
    c.niveau = 8
    const bat = C.prepare(c, 0)
    for (const u of B.unitesDe(bat, 0)) u.pv = 0
    bat.fini = 'perdu'
    const r = C.bilan(c, bat)
    assert.equal(r.butin, undefined, 'du butin sur une défaite')
  }
})

test('le butin tombe à un taux qui monte avec le niveau', () => {
  const tauxA = tauxButin(3, 300)
  const tauxB = tauxButin(15, 300)
  assert.ok(tauxB > tauxA, `le taux ne monte pas avec le niveau : ${tauxA} contre ${tauxB}`)
  assert.ok(tauxA > 0.15 && tauxA < 0.5, `taux improbable au niveau 3 : ${tauxA}`)
})

function tauxButin(niveau, essais) {
  let butins = 0
  for (let n = 0; n < essais; n++) {
    const c = C.nouvelle(5000 + n)
    c.niveau = niveau
    const bat = C.prepare(c, 0)
    for (const u of B.unitesDe(bat, 1)) u.pv = 0
    bat.fini = 'gagne'
    const r = C.bilan(c, bat)
    if (r.butin) butins++
  }
  return butins / essais
}

// --- La sauvegarde ---------------------------------------------------------------------

test('une sauvegarde d’avant les objets migre proprement', () => {
  const c = C.nouvelle(20)
  const brut = JSON.parse(JSON.stringify(C.sauvegarde(c)))
  delete brut.c.objets
  for (const u of brut.c.troupes) delete u.equip
  const relu = C.migre(brut)
  assert.ok(Array.isArray(relu.c.objets))
  for (const u of relu.c.troupes) assert.deepEqual(u.equip, { arme: null, armure: null, accessoire: null })
})
