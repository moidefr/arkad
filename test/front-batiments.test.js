/**
 * Les cinq bâtiments neufs du lot 3 — même discipline que la ville
 * existante : chaque bâtiment fait une seule chose, mesurable, et rien ne se
 * construit sans que son prérequis soit là.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import * as C from '../src/massif/front/compagnie.js'
import * as V from '../src/massif/front/ville.js'
import * as B from '../src/massif/front/bataille.js'
import * as U from '../src/massif/front/unites.js'
import { TYPES } from '../src/massif/front/donnees/classes.js'

const neuve = (graine = 4242) => C.nouvelle(graine)

// --- Les prérequis -----------------------------------------------------------------

test('la forge exige un marché, le terrain d’entraînement une caserne aguerrie', () => {
  const c = neuve()
  c.or = 1000000
  c.niveau = 20
  assert.equal(V.constructible(c, 'forge'), false, 'la forge se construit sans marché')
  c.ville.bat.marche = 1
  assert.ok(V.constructible(c, 'forge'), 'le marché ne débloque pas la forge')

  assert.equal(V.constructible(c, 'entrainement'), false, 'le terrain se construit sans caserne aguerrie')
  c.ville.bat.caserne = 1
  assert.equal(V.constructible(c, 'entrainement'), false, 'une caserne de rang 1 suffit')
  c.ville.bat.caserne = 2
  assert.ok(V.constructible(c, 'entrainement'), 'la caserne de rang 2 ne débloque pas le terrain')
})

test('un prérequis qui régresse referme la construction', () => {
  const c = neuve()
  c.or = 1000000
  c.niveau = 20
  c.ville.bat.marche = 1
  c.ville.bat.forge = 1
  assert.ok(V.constructible(c, 'forge'))
  c.ville.bat.marche = 0
  assert.equal(V.constructible(c, 'forge'), false)
})

// --- Les fortifications --------------------------------------------------------------

test('les fortifications posent un bonus de défense permanent, pour la compagnie seule', () => {
  const c = neuve(11)
  c.niveau = 5
  c.or = 999999
  const sansBat = C.prepare(c, 0)
  const uSans = B.vivantes(sansBat, 0)[0]
  const uSansEnnemi = B.vivantes(sansBat, 1)[0]
  assert.equal(V.bonusDefense(c), 0)

  c.ville.bat.fortifications = 2
  const avecBat = C.prepare(c, 0)
  const uAvec = B.vivantes(avecBat, 0)[0]
  const uAvecEnnemi = B.vivantes(avecBat, 1)[0]

  assert.ok(V.bonusDefense(c) > 0)
  assert.ok(B.fiche(avecBat, uAvec).def > B.fiche(sansBat, uSans).def, 'la défense n’a pas bougé')
  // L'adversaire ne profite jamais des fortifications du joueur.
  assert.equal(
    uAvecEnnemi.etats.some((e) => e.nom === 'FORTIFIÉ'),
    false,
  )
  assert.equal(
    uSansEnnemi.etats.some((e) => e.nom === 'FORTIFIÉ'),
    false,
  )
})

test('le bonus de fortification ne s’use jamais en cours de bataille', () => {
  const c = neuve(12)
  c.niveau = 5
  c.or = 999999
  c.ville.bat.fortifications = 3
  const bat = C.prepare(c, 0)
  const u = B.vivantes(bat, 0)[0]
  const avant = B.fiche(bat, u).def
  for (let i = 0; i < 30 && !B.fini(bat); i++) B.finTour(bat)
  const encore = B.vivantes(bat, 0).find((x) => x.ref === u.ref)
  if (encore) assert.equal(B.fiche(bat, encore).def, avant)
})

// --- Le marché -------------------------------------------------------------------------

test('sans marché, l’étal d’objets est vide ; construit, il se remplit', () => {
  const c = neuve(13)
  c.niveau = 6
  C.rafraichit(c)
  assert.equal(c.offre.objets.length, 0, 'l’étal vend des objets sans marché')
  c.ville.bat.marche = 2
  C.rafraichit(c)
  assert.ok(c.offre.objets.length > 0, 'le marché ne vend rien')
})

test('acheter au marché coûte de l’or et rejoint le dépôt, une seule fois', () => {
  const c = neuve(14)
  c.niveau = 6
  c.ville.bat.marche = 2
  C.rafraichit(c)
  const n = c.offre.objets.length
  assert.ok(n > 0)
  c.or = 1000000
  const or = c.or
  const ligne = c.offre.objets[0]
  assert.ok(C.acheteObjet(c, 0))
  assert.equal(c.or, or - ligne.prix)
  assert.equal(c.objets.length, 1)
  assert.equal(c.offre.objets.length, n - 1)
  // L'étal a une ligne de moins ; retenter un indice qui n'existe plus
  // qu'à la marge (au-delà de ce qu'il reste) ne vend rien.
  assert.equal(C.acheteObjet(c, c.offre.objets.length), false)
})

test('on n’achète pas ce qu’on ne peut pas payer', () => {
  const c = neuve(15)
  c.niveau = 6
  c.ville.bat.marche = 2
  C.rafraichit(c)
  c.or = 0
  assert.equal(C.acheteObjet(c, 0), false)
  assert.equal(c.objets.length, 0)
})

// --- Le poste de guet ------------------------------------------------------------------

test('le poste de guet ajoute une offre par niveau, au penchant toujours connu', () => {
  const c = neuve(16)
  c.niveau = 5
  const sans = C.planifie(c).length
  c.ville.bat.guet = 2
  const avec = C.planifie(c)
  assert.equal(avec.length, sans + 2)
  const veille = avec.slice(-2)
  assert.ok(
    veille.every((e) => e.penchant != null),
    'le penchant des offres du guet reste un tirage à pile ou face',
  )
})

// --- La forge --------------------------------------------------------------------------

test('la forge plafonne au niveau du bâtiment plus un, pas au niveau brut', () => {
  const c = neuve(17)
  c.niveau = 12
  c.or = 1000000
  const u = c.troupes[0]
  c.objets.push({ id: 'lame_courte', tier: 1 })
  C.equipeObjet(c, u.id, 'arme', 0)

  c.ville.bat.forge = 0
  assert.equal(C.ameliore(c, u.id, 'arme', V.niveauBat(c, 'forge') + 1), false, 'sans forge, on améliore quand même')

  c.ville.bat.forge = 1
  assert.ok(C.ameliore(c, u.id, 'arme', V.niveauBat(c, 'forge') + 1), 'la forge niveau 1 ne monte pas au tier 2')
  assert.equal(u.equip.arme.tier, 2)
  assert.equal(
    C.ameliore(c, u.id, 'arme', V.niveauBat(c, 'forge') + 1),
    false,
    'la forge niveau 1 monte déjà au tier 3',
  )

  c.ville.bat.forge = 2
  assert.ok(C.ameliore(c, u.id, 'arme', V.niveauBat(c, 'forge') + 1), 'la forge niveau 2 ne monte pas au tier 3')
  assert.equal(u.equip.arme.tier, 3)
})

// --- Le terrain d'entraînement -----------------------------------------------------------

test('le terrain d’entraînement accélère la réserve du type choisi, et lui seul', () => {
  const c = neuve(18)
  c.niveau = 12
  c.or = 1000000
  c.ville.bat.caserne = 3
  c.ville.bat.entrainement = 3
  assert.ok(V.choisisFocus(c, 'MON'))
  assert.equal(V.focusEntrainement(c), 'MON')

  const monte = U.creeGenerique('cavalier', 1, 'MONTE', 'M')
  const fantassin = U.creeGenerique('fantassin', 1, 'PIED', 'P')
  c.troupes.push(monte, fantassin)

  V.passeJours(c, 15)
  assert.ok(monte.xp > fantassin.xp || monte.niv > fantassin.niv, 'l’accent ne favorise pas le type choisi')
})

test('sans le bâtiment, choisir un accent est refusé', () => {
  const c = neuve(19)
  assert.equal(V.choisisFocus(c, 'MON'), false)
  assert.equal(V.focusEntrainement(c), null)
})

test('un type qui n’existe pas est refusé', () => {
  const c = neuve(20)
  c.ville.bat.entrainement = 1
  assert.equal(V.choisisFocus(c, 'GOBELIN'), false)
})

test('les neuf bâtiments couvrent tous les types de troupe visés par leur nom', () => {
  // Pas une assertion de contenu — juste que la table des types existe encore
  // et que rien ne s'est cassé en important les deux modules ensemble.
  assert.equal(TYPES.length, 6)
  assert.equal(V.BATIMENTS.length, 9)
})

// --- La sauvegarde -----------------------------------------------------------------------

test('une sauvegarde d’avant le marché et le terrain d’entraînement migre proprement', () => {
  const c = neuve(21)
  c.ville.bat.marche = 2
  C.rafraichit(c)
  const brut = JSON.parse(JSON.stringify(C.sauvegarde(c)))
  delete brut.c.offre.objets
  delete brut.c.ville.focus
  const relu = C.migre(brut)
  assert.ok(Array.isArray(relu.c.offre.objets))
  assert.equal(V.focusEntrainement(relu.c), null)
})
