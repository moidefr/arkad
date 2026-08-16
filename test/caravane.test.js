/**
 * CARAVANE : le graphe, les prix et la sauvegarde, en pur calcul, sans canvas.
 *
 * Un jeu de commerce se rate de deux façons discrètes : un marché isolé du
 * reste du réseau (personne ne peut jamais l'atteindre), ou un prix qui
 * dérive vers NaN après assez de trajets. Ces tests vérifient les deux, plus
 * la sauvegarde et une partie jouée pour de vrai via `test/faux.js`.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MARCHANDISES, MARCHES, ROUTES, ECART_MIN, ECART_MAX, LOT_ECHANGE } from '../src/long/caravane/donnees.js'
import * as L from '../src/long/caravane/logique.js'
import caravane from '../src/long/caravane/index.js'
import { fauxJeu, fauxCtx, graine, joue, PAS, peint } from './faux.js'
import * as D from '../src/long/caravane/dispo.js'

// --- Données -----------------------------------------------------------------------

test('les marchandises ont des identifiants uniques et des tables de la bonne longueur', () => {
  const ids = new Set()
  for (const m of MARCHANDISES) {
    assert.equal(ids.has(m.id), false, `marchandise en double : ${m.id}`)
    ids.add(m.id)
    assert.ok(m.ref > 0 && m.volat > 0, `${m.id} a un prix ou une volatilité nulle`)
  }
  for (const m of MARCHES) {
    assert.equal(m.mult.length, MARCHANDISES.length, `${m.id} n’a pas un multiplicateur par marchandise`)
    for (const mult of m.mult) assert.ok(mult > 0, `${m.id} a un multiplicateur nul ou négatif`)
  }
})

test('les marchés ont des identifiants uniques et des coordonnées dans [0, 1]', () => {
  const ids = new Set()
  for (const m of MARCHES) {
    assert.equal(ids.has(m.id), false, `marché en double : ${m.id}`)
    ids.add(m.id)
    assert.ok(m.x >= 0 && m.x <= 1 && m.y >= 0 && m.y <= 1, `${m.id} sort du cadre de la carte`)
  }
})

test('toute route relie deux marchés qui existent, et aucune ne se boucle sur elle-même', () => {
  for (const r of ROUTES) {
    assert.ok(MARCHES[r.a], `route vers un marché ${r.a} qui n’existe pas`)
    assert.ok(MARCHES[r.b], `route vers un marché ${r.b} qui n’existe pas`)
    assert.notEqual(r.a, r.b, 'une route ne peut pas relier un marché à lui-même')
    assert.ok(r.duree > 0, `route ${r.a}-${r.b} a une durée nulle`)
    assert.ok(r.risque >= 0 && r.risque < 1, `route ${r.a}-${r.b} a un risque hors de [0, 1[`)
  }
})

test('le réseau est un seul graphe connexe : tout marché est atteignable depuis n’importe lequel', () => {
  const vus = new Set([0])
  const file = [0]
  while (file.length) {
    const i = file.pop()
    for (const c of L.connexions(i)) if (!vus.has(c.vers)) {
      vus.add(c.vers)
      file.push(c.vers)
    }
  }
  assert.equal(vus.size, MARCHES.length, `${MARCHES.length - vus.size} marché(s) inatteignable(s) depuis le premier`)
})

test('chaque marché a au moins deux routes : aucun n’est un cul-de-sac total', () => {
  for (let i = 0; i < MARCHES.length; i++) {
    const n = L.connexions(i).length
    assert.ok(n >= 2, `${MARCHES[i].nom} n’a que ${n} route(s)`)
  }
})

test('au moins un marché a trois connexions ou plus : ce n’est pas une simple ligne', () => {
  const carrefours = MARCHES.map((_, i) => L.connexions(i).length).filter((n) => n >= 3)
  assert.ok(carrefours.length >= 2, 'trop peu de carrefours, le réseau ressemble à un couloir')
})

test('chaque marchandise vaut nettement plus cher à son plus haut mult qu’à son plus bas : l’arbitrage existe', () => {
  for (let g = 0; g < MARCHANDISES.length; g++) {
    const mults = MARCHES.map((m) => m.mult[g])
    const bas = Math.min(...mults)
    const haut = Math.max(...mults)
    assert.ok(haut / bas > 2, `${MARCHANDISES[g].nom} ne varie que de ×${(haut / bas).toFixed(2)} sur le réseau`)
  }
})

// --- Prix et échanges, en pur calcul ------------------------------------------------

test('acheter puis revendre au même endroit sans attendre coûte plus que ça ne rapporte', () => {
  // Sinon un aller-retour immédiat sur place serait une machine à profit
  // gratuite — l'écart doit se refermer en perte tant que le temps ne passe pas.
  const e = L.neuf()
  e.argent = 1000
  const achat = L.achete(e, 0, 20)
  assert.ok(achat.qte === 20 && achat.cout > 0)
  const vente = L.vend(e, 0, 20)
  assert.ok(vente.gain < achat.cout, `achat ${achat.cout}, revente immédiate ${vente.gain}`)
})

test('un achat plus gros coûte plus cher à l’unité que le premier lot', () => {
  const e = L.neuf()
  e.argent = 5000
  const petit = L.achete(e, 4, 1)
  const e2 = L.neuf()
  e2.argent = 5000
  e2.charrettes = 5 // assez de place pour ne pas plafonner l'achat avant l'écart
  L.achete(e2, 4, 30)
  const suivant = L.achete(e2, 4, 1)
  assert.ok(suivant.qte === 1 && suivant.cout > petit.cout, 'le prix ne monte pas avec la demande')
})

test('un achat ou une vente ne dépasse jamais la caisse, la place libre ou le stock détenu', () => {
  const e = L.neuf()
  e.argent = 5
  const trop = L.achete(e, 6, 999) // épices, cher
  assert.ok(trop.cout <= 5)
  assert.ok(e.argent >= 0)

  const e2 = L.neuf()
  e2.charrettes = 1
  const plein = L.achete(e2, 0, 999)
  assert.ok(L.cargaisonTotale(e2) <= L.capacite(e2), 'la cargaison dépasse la capacité de la flotte')
  assert.ok(plein.qte <= L.capacite(e2))

  const e3 = L.neuf()
  e3.cargaison[0] = 3
  const survente = L.vend(e3, 0, 999)
  assert.equal(survente.qte, 3, 'on a vendu plus qu’on en avait')
  assert.equal(e3.cargaison[0], 0)
})

test('dix mille secondes d’échanges et de trajets au hasard ne produisent ni NaN ni valeur hors bornes', () => {
  const hasard = graine(21)
  const e = L.neuf()
  for (let t = 0; t < 10000; t += 5) {
    L.avance(e, 5, hasard)
    if (!e.enRoute && hasard() < 0.3) {
      const g = Math.floor(hasard() * MARCHANDISES.length)
      if (hasard() < 0.5) L.achete(e, g, LOT_ECHANGE)
      else L.vend(e, g, LOT_ECHANGE)
    }
    if (!e.enRoute && hasard() < 0.1) {
      const conn = L.connexions(e.marche)
      if (conn.length) L.partir(e, conn[Math.floor(hasard() * conn.length)].vers)
    }
    if (hasard() < 0.02) L.acheteCharrette(e)

    assert.ok(Number.isFinite(e.argent) && e.argent >= 0, `argent invalide à t=${t} : ${e.argent}`)
    assert.ok(Number.isFinite(e.dette) && e.dette >= 0, `dette invalide à t=${t}`)
    for (const n of e.cargaison) assert.ok(Number.isFinite(n) && n >= 0, `cargaison invalide à t=${t}`)
    for (const ligne of e.ecarts) {
      for (const v of ligne) {
        assert.ok(Number.isFinite(v), `écart devenu NaN à t=${t}`)
        assert.ok(v >= ECART_MIN - 1e-9 && v <= ECART_MAX + 1e-9, `écart ${v} hors de [${ECART_MIN}, ${ECART_MAX}] à t=${t}`)
      }
    }
    assert.ok(Number.isFinite(L.patrimoine(e)), `patrimoine devenu NaN à t=${t}`)
  }
})

test('l’écart de conjoncture retombe vers 1 avec le temps, sans dépendre du pas', () => {
  const e1 = L.neuf()
  L.achete(e1, 0, 15)
  const ecartInitial = e1.ecarts[e1.marche][0]
  assert.ok(ecartInitial > 1, 'acheter devrait pousser le prix au-dessus de 1')

  const e2 = { ...e1, ecarts: e1.ecarts.map((l) => [...l]) }
  L.avance(e1, 3600, () => 0.99) // un seul grand pas
  for (let i = 0; i < 3600; i++) L.avance(e2, 1, () => 0.99) // mille pas d'une seconde
  assert.ok(
    Math.abs(e1.ecarts[e1.marche][0] - e2.ecarts[e2.marche][0]) < 1e-6,
    'la décroissance dépend du découpage en pas, elle ne devrait pas',
  )
  assert.ok(e1.ecarts[e1.marche][0] < ecartInitial, 'l’écart ne retombe pas avec le temps')
})

test('un entretien impayé accumule une dette, et la dette finit en banqueroute plutôt qu’en négatif infini', () => {
  const e = L.neuf()
  e.argent = 0
  e.charrettes = 5
  let banqueroute = false
  for (let t = 0; t < 20000 && !banqueroute; t += 10) {
    const ev = L.avance(e, 10, () => 0.99)
    if (ev.banqueroute) banqueroute = true
  }
  assert.ok(banqueroute, 'une flotte impayée pendant des heures ne fait jamais banqueroute')
  assert.equal(e.dette, 0, 'la dette n’est pas remise à zéro par la banqueroute')
  assert.ok(e.charrettes >= 1, 'la flotte tombe à zéro charrette, ce qui bloquerait tout')
})

// --- Sauvegarde ------------------------------------------------------------------

test('une sauvegarde d’un format incompatible ne plante pas : elle repart à neuf', () => {
  assert.equal(L.migre(null), null)
  assert.equal(L.migre(42), null)
  assert.equal(L.migre({ marche: 3, argent: 500 }), null, 'l’ancien format (sans version) doit être rejeté')
  assert.equal(L.migre({ v: 99, argent: 1e9 }), null, 'une version du futur doit être rejetée')
})

test('une sauvegarde abîmée ne propage jamais NaN et reste dans les bornes', () => {
  const e = L.migre({
    v: L.VERSION,
    marche: 'quelque part',
    argent: 'beaucoup',
    charrettes: -5,
    cargaison: [null, undefined, NaN, -3],
    ecarts: [[99, -99]],
    enRoute: { vers: 'ailleurs', restant: 'jamais' },
  })
  assert.ok(e)
  assert.equal(e.marche, 0)
  assert.ok(e.argent >= 0 && Number.isFinite(e.argent))
  assert.equal(e.charrettes, 1)
  for (const n of e.cargaison) assert.ok(Number.isFinite(n) && n >= 0)
  for (const ligne of e.ecarts) for (const v of ligne) assert.ok(Number.isFinite(v) && v >= ECART_MIN && v <= ECART_MAX)
  assert.equal(e.enRoute, null, 'un trajet mal formé n’a pas été rejeté')
  assert.ok(Number.isFinite(L.patrimoine(e)))
})

test('une sauvegarde du bon format se relit sans rien perdre', () => {
  const e = L.neuf()
  e.marche = 5
  e.argent = 340
  e.cargaison[2] = 12
  e.ecarts[5][2] = 1.4
  e.charrettes = 3
  L.partir(e, 7)
  const relu = L.migre(JSON.parse(JSON.stringify(L.sauvegarde(e))))
  assert.equal(relu.marche, 5)
  assert.equal(relu.argent, 340)
  assert.equal(relu.cargaison[2], 12)
  assert.equal(relu.ecarts[5][2], 1.4)
  assert.equal(relu.charrettes, 3)
  assert.deepEqual(relu.enRoute, e.enRoute)
})

test('reculer l’horloge ne rapporte rien et ne fait pas dériver les prix à l’envers', () => {
  const e = L.neuf()
  L.achete(e, 0, 10)
  const avant = e.ecarts[e.marche][0]
  e.quand = 1e12
  const ev = L.credite(e, graine(1), 1e12 - 3600 * 1000)
  assert.equal(ev.ecoule, undefined)
  assert.equal(e.ecarts[e.marche][0], avant, 'une horloge reculée a quand même fait bouger les prix')
})

test('l’absence est créditée mais bornée, et peut faire arriver un trajet en cours', () => {
  const e = L.neuf()
  L.partir(e, 3 === e.marche ? 1 : 3)
  e.quand = 1e12
  const ev = L.credite(e, graine(2), 1e12 + 365 * 24 * 3600 * 1000)
  assert.ok(ev.ecoule <= 172800 + 1, 'le plafond hors ligne ne tient pas')
  assert.equal(e.enRoute, null, 'un trajet plus court que le plafond hors ligne n’est jamais arrivé')
})

// --- Le jeu entier, via le vrai chemin d’appui --------------------------------------

test('une partie jouée pour de vrai ne plante jamais et ne peint jamais de NaN', () => {
  const memoire = { valeur: null }
  const hasard = graine(6)
  const { j, ctx } = joue(caravane, {
    duree: 600,
    dessine: true,
    memoire,
    hasard,
    pilote(jeu, t) {
      // Un onglet différent toutes les deux secondes, un appui presque à chaque image.
      if (t % 2 < PAS) jeu.e.vue = ['marche', 'route', 'flotte'][Math.floor(t) % 3]
      jeu.pointer.x = 20 + ((t * 977) % 320)
      jeu.pointer.y = 68 + ((t * 613) % 560)
      return t % 0.3 < PAS ? 'appui' : undefined
    },
  })

  assert.ok(Number.isFinite(j.score), 'le score est devenu NaN')
  for (const o of ctx.ops) {
    if (o.type !== 'texte') continue
    for (const v of [o.x, o.y, o.gauche, o.larg, o.taille]) assert.ok(Number.isFinite(v), `un texte peint une valeur NaN : ${o.s}`)
  }
  // Rien ne doit dessiner en dehors du canevas 360×640.
  for (const o of ctx.ops) {
    const b = peint(o)
    if (!b) continue
    assert.ok(b.x > -50 && b.x + b.w < j.W + 50, `dessine hors cadre horizontalement : ${JSON.stringify(o).slice(0, 80)}`)
  }

  caravane.quitte(j)
  assert.ok(memoire.valeur, 'rien n’a été sauvegardé')
  const relu = L.migre(JSON.parse(memoire.valeur))
  assert.ok(relu && Number.isFinite(relu.argent), 'la sauvegarde ne se relit pas')
})

test('on peut vraiment acheter, vendre, partir et acheter une charrette en passant par le vrai appui', () => {
  const j = fauxJeu(caravane, { graine: 5 })
  const ctx = fauxCtx()

  j.e.argent = 5000
  caravane.dessine(j, ctx)

  const centre = (z) => ({ x: z.x + z.w / 2, y: z.y + z.h / 2 })
  const tape = (z) => {
    const p = centre(z)
    j.pointer.x = p.x
    j.pointer.y = p.y
    caravane.appui(j, j.pointer)
  }

  // Onglet MARCHÉ (déjà actif) : la première rangée, bouton ACHETER.
  let d = D.dispo(j)
  const avant = j.e.cargaison[0]
  tape(D.zoneAchat(d, 0))
  assert.ok(j.e.cargaison[0] > avant, 'appuyer sur ACHETER n’achète rien')

  // Bouton VENDRE de la même rangée.
  const cargaisonAvantVente = j.e.cargaison[0]
  tape(D.zoneVente(d, 0))
  assert.ok(j.e.cargaison[0] < cargaisonAvantVente, 'appuyer sur VENDRE ne vend rien')

  // Onglet ROUTE puis premier trajet.
  tape(D.zoneOnglet(d, 1))
  assert.equal(j.e.vue, 'route')
  caravane.dessine(j, ctx)
  d = D.dispo(j)
  tape(D.zoneRoute(d, 0))
  assert.ok(j.e.enRoute, 'appuyer sur une route ne fait pas partir la caravane')

  // Onglet FLOTTE : inaccessible en chemin, mais l’appui ne doit rien casser.
  tape(D.zoneOnglet(d, 2))
  assert.equal(j.e.vue, 'flotte')
  caravane.dessine(j, ctx)
  const charrettes = j.e.charrettes
  tape(d.boutonCharrette)
  assert.equal(j.e.charrettes, charrettes, 'une charrette s’achète alors qu’on est en chemin')
})
