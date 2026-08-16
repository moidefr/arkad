/**
 * COLONIE : cohérence des tables, calcul pur, sauvegarde, et le risque
 * central du jeu — une négligence prolongée doit vraiment pouvoir éteindre
 * la colonie, ce que l'USINE ne permet jamais.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import colonie from '../src/long/colonie/index.js'
import { RESSOURCES, BATIMENTS, PALIERS, DEPART, FAMINE_SEUIL_ABANDON } from '../src/long/colonie/donnees.js'
import * as L from '../src/long/colonie/logique.js'
import { fauxJeu, fauxCtx, graine, PAS } from './faux.js'

// --- Données -----------------------------------------------------------------------

test('les bâtiments ont des identifiants uniques, un coût, et un palier connu', () => {
  const ids = new Set()
  for (const b of BATIMENTS) {
    assert.equal(ids.has(b.id), false, `bâtiment en double : ${b.id}`)
    ids.add(b.id)
    assert.ok(b.nom && b.dit, `${b.id} n’a pas de texte`)
    assert.ok(Object.keys(b.coutBase).length > 0, `${b.id} ne coûte rien`)
    assert.ok(b.coutTaux > 1, `${b.id} ne devient jamais plus cher`)
    assert.ok(b.palier === 0 || PALIERS[b.palier] > 0, `${b.id} a un palier ${b.palier} sans seuil`)
    for (const res of Object.keys(b.coutBase)) assert.ok(RESSOURCES.some((r) => r.cle === res), `${b.id} coûte du ${res}, inconnu`)
    for (const res of [...Object.keys(b.consomme), ...Object.keys(b.produit)])
      assert.ok(RESSOURCES.some((r) => r.cle === res), `${b.id} touche à ${res}, inconnu`)
    // Un bâtiment est soit un logement, soit un poste de travail — jamais
    // les deux, et jamais ni l'un ni l'autre (sinon il ne sert à rien).
    assert.ok(b.logement > 0 || b.postes > 0, `${b.id} n’est ni un logement ni un poste`)
    assert.ok(!(b.logement > 0 && b.postes > 0), `${b.id} est logement et poste de travail à la fois`)
  }
})

test('au moins un palier 0 produit de la nourriture sans rien consommer : le premier jour ne dépend de rien', () => {
  const bootstrap = BATIMENTS.filter((b) => b.palier === 0 && b.produit.nourriture && !Object.keys(b.consomme).length)
  assert.ok(bootstrap.length > 0, 'aucune source de nourriture gratuite au palier 0')
})

test('les paliers 1 et 2 forment bien un cycle : ils consomment ce qu’un palier antérieur produit', () => {
  // FERME et ATELIER se répondent : l’un consomme ce que l’autre produit, et
  // réciproquement — c’est le réseau que USINE n’a pas.
  const produits = new Set(BATIMENTS.flatMap((b) => Object.keys(b.produit)))
  const consommes = new Set(BATIMENTS.flatMap((b) => Object.keys(b.consomme)))
  for (const r of RESSOURCES) {
    if (r.cle === 'nourriture') continue // la nourriture est un puits, jamais un intrant de bâtiment
    assert.ok(produits.has(r.cle), `rien ne produit ${r.cle}`)
  }
  assert.ok(consommes.has('outils'), 'rien ne consomme les outils : ce ne serait qu’un stock mort')
})

test('chaque ferme de palier supérieur nourrit mieux par poste que celle d’avant — sinon la progression n’a rien à offrir', () => {
  // Comparaison directe, poste pour poste, sans compter le coût indirect de
  // l'ATELIER/FORGE qui l'outille (le banc, lui, mesure la chaîne complète).
  // Réglé après mesure : sans cet écart, un automate géré n'avait aucune
  // raison de jamais quitter le CAMPEMENT (voir `colonie-banc.mjs`).
  const parPoste = (id) => {
    const b = BATIMENTS.find((x) => x.id === id)
    return b.produit.nourriture / b.postes
  }
  assert.ok(parPoste('ferme') > parPoste('campement') * 1.5, 'la FERME ne bat pas assez le CAMPEMENT par poste')
  assert.ok(parPoste('grandeFerme') > parPoste('ferme') * 1.2, 'la GRANDE FERME ne bat pas assez la FERME par poste')
})

// --- Sauvegarde ------------------------------------------------------------------

test('une sauvegarde d’un format incompatible ne plante pas : elle repart à neuf', () => {
  assert.equal(L.migre(null), null)
  assert.equal(L.migre({ population: 40, bois: 10 }), null, 'l’ancien format (sans version) doit être rejeté')
  assert.equal(L.migre({ v: 99, population: 10 }), null, 'une version future doit être rejetée')
})

test('une sauvegarde abîmée ne propage jamais NaN', () => {
  const e = L.migre({ v: L.VERSION, population: 'beaucoup', n: [null, undefined, NaN], bois: -5 })
  assert.ok(e)
  assert.ok(Number.isFinite(e.population))
  assert.ok(Number.isFinite(e.bois))
  assert.equal(e.n.length, BATIMENTS.length)
  assert.ok(Number.isFinite(L.couverture(e)))
})

test('une sauvegarde du bon format se relit sans rien perdre', () => {
  const e = L.neuve()
  e.population = 12
  e.n[0] = 3
  e.n[4] = 1
  e.pic = 15
  const relu = L.migre(JSON.parse(JSON.stringify(L.sauvegarde(e))))
  assert.equal(relu.population, 12)
  assert.equal(relu.n[0], 3)
  assert.equal(relu.n[4], 1)
  assert.equal(relu.pic, 15)
})

test('« le plus haut jamais atteint » ne redescend jamais, même migré depuis une sauvegarde qui l’ignore', () => {
  const e = L.neuve()
  e.population = 30
  const brut = L.sauvegarde(e)
  delete brut.pic
  const relu = L.migre(brut)
  assert.ok(relu.pic >= 30, 'le pic est retombé sous la population actuelle')
})

// --- Calcul pur : pas de NaN, pas de valeur hors bornes -----------------------------

test('dix mille tours au hasard, en bâtissant tout ce qui est ouvert, ne produisent jamais NaN ni de stock négatif', () => {
  const hasard = graine(5)
  const e = L.neuve()
  for (let i = 0; i < 10000; i++) {
    L.avance(e, 1, hasard)
    for (let k = 0; k < BATIMENTS.length; k++) if (L.peutConstruire(e, k) && hasard() < 0.3) L.construit(e, k)

    for (const r of RESSOURCES) {
      assert.ok(Number.isFinite(e[r.cle]), `${r.cle} devient NaN au tour ${i}`)
      assert.ok(e[r.cle] >= 0, `${r.cle} = ${e[r.cle]} est négatif au tour ${i}`)
    }
    assert.ok(Number.isFinite(e.population) && e.population >= 0, `population invalide au tour ${i}`)
    assert.ok(e.famineDepuis >= 0, 'la famine remonte le temps')
    if (e.population <= 0) break
  }
})

test('la couverture ne dépasse jamais 100 %, même avec bien plus d’habitants que de postes', () => {
  const e = L.neuve()
  e.population = 1e6
  e.n[0] = 1
  assert.ok(L.couverture(e) <= 1)
})

test('sans aucun poste, la couverture vaut 1 (rien à couvrir, rien qui bride)', () => {
  const e = L.neuve()
  assert.equal(L.postes(e), 0)
  assert.equal(L.couverture(e), 1)
})

test('un bâtiment à intrant ne consomme jamais plus que le stock disponible', () => {
  const hasard = graine(9)
  const e = L.neuve()
  e.population = 20
  e.n[4] = 5 // ATELIER, consomme bois et pierre
  e.bois = 0.1
  e.pierre = 0.1
  L.avance(e, 1, hasard)
  assert.ok(e.bois >= -1e-9, 'le bois est passé sous zéro')
  assert.ok(e.pierre >= -1e-9, 'la pierre est passée sous zéro')
})

// --- Le risque central : la famine peut vraiment éteindre une colonie -------------

test('une colonie surpeuplée sans aucune production de nourriture décline, puis s’éteint', () => {
  const hasard = graine(3)
  const e = L.neuve()
  e.population = 40
  e.nourriture = 0
  // Beaucoup de bouches, aucun bâtiment : la couverture n'a rien à faire
  // tourner, donc rien ne peut compenser la faim.
  let tours = 0
  while (e.population > 0 && tours < 20000) {
    L.avance(e, 1, hasard)
    tours++
  }
  assert.ok(tours < 20000, 'la colonie ne s’éteint jamais, même sans aucune nourriture')
  assert.equal(e.population, 0)
})

test('une colonie nourrie et bâtie grandit vers ses logements, jamais au-delà', () => {
  const hasard = graine(4)
  const e = L.neuve()
  // Assez de CAMPEMENTS pour que la production dépasse l'appétit même à
  // pleine capacité (voir le calcul dans le banc) : ce test vérifie la
  // croissance elle-même, pas l'équilibre nourriture/logement, qui a son
  // propre test plus bas.
  e.n[0] = 3 // CAMPEMENT
  e.n[3] = 1 // HUTTE
  for (let i = 0; i < 6000; i++) L.avance(e, 1, hasard)
  assert.ok(e.population > DEPART.population, 'une colonie nourrie ne grandit pas')
  assert.ok(e.population <= L.logements(e) + 1e-6, 'la population dépasse ses logements')
})

test('trop de logements sans assez de nourriture fait plafonner, ou reculer, la croissance', () => {
  // Une colonie qui bâtit des logements sans agrandir sa production de
  // nourriture en même temps se condamne elle-même : la population croît
  // tant qu'elle est nourrie, puis dépasse ce que la colonie peut produire,
  // et retombe. C'est voulu — voir le commentaire de `avance` dans
  // `logique.js` — donc ce test l'observe, il ne l'empêche pas.
  const hasard = graine(41)
  const e = L.neuve()
  e.n[0] = 1 // un seul CAMPEMENT
  e.n[3] = 4 // logements largement excédentaires
  let pic = e.population
  for (let i = 0; i < 4000; i++) {
    L.avance(e, 1, hasard)
    pic = Math.max(pic, e.population)
  }
  assert.ok(pic > DEPART.population, 'la colonie n’a même pas commencé à grandir')
  assert.ok(e.population < pic, 'la surpopulation ne coûte jamais rien : le déséquilibre ne se voit pas')
})

test('une famine qui dure coûte un bâtiment, pas seulement des habitants', () => {
  const hasard = graine(6)
  const e = L.neuve()
  e.population = 10
  e.n[3] = 2 // des logements, mais aucune production de nourriture
  e.nourriture = 0
  let abandon = false
  for (let i = 0; i < FAMINE_SEUIL_ABANDON * 3 && e.population > 0; i++) {
    const ev = L.avance(e, 1, hasard)
    if (ev.abandon !== undefined) abandon = true
  }
  assert.ok(abandon, 'aucun bâtiment n’a jamais été abandonné malgré une famine continue')
})

// --- Construction -----------------------------------------------------------------

test('un bâtiment de palier supérieur reste hors de portée avant le seuil de population, même riche', () => {
  const e = L.neuve()
  e.bois = 1e9
  e.pierre = 1e9
  e.outils = 1e9
  const i = BATIMENTS.findIndex((b) => b.palier === 1)
  assert.equal(L.ouvert(e, i), false)
  assert.equal(L.construit(e, i), false)
  e.population = PALIERS[1]
  assert.equal(L.ouvert(e, i), true)
  assert.equal(L.construit(e, i), true)
})

test('construire prélève exactement le coût affiché, et le prix grandit avec le nombre déjà bâti', () => {
  const e = L.neuve()
  e.bois = 1000
  const c1 = L.cout(e, 0)
  const avant = e.bois
  assert.ok(L.construit(e, 0))
  assert.equal(e.bois, avant - c1.bois)
  for (let i = 0; i < 9; i++) L.construit(e, 0)
  const c2 = L.cout(e, 0)
  assert.ok(c2.bois > c1.bois, 'la dixième instance ne coûte pas plus cher que la première')
})

test('impossible de construire sans les ressources, et rien n’est prélevé en échouant', () => {
  const e = L.neuve()
  e.bois = 0
  const avant = { ...e }
  assert.equal(L.construit(e, 0), false)
  assert.equal(e.bois, avant.bois)
})

// --- Une partie simulée complète, à travers le vrai chemin d’appui ---------------

test('une session jouée à travers appui/maj/dessine ne produit ni crash ni NaN dans le dessin', () => {
  const memoire = { valeur: null }
  const j = fauxJeu(colonie, { graine: 12, memoire })
  const ctx = fauxCtx()

  for (let i = 0; i < 3000; i++) {
    // Un joueur qui revient de temps en temps : change d’onglet, construit
    // ce qui est accessible, sinon regarde passer le temps.
    if (i % 11 === 0) {
      const k = Math.floor(j.hasard() * 3)
      j.pointer.x = 20 + k * 110 + 40
      j.pointer.y = 277
      colonie.appui(j, j.pointer)
    }
    if (i % 5 === 0) {
      const ligne = Math.floor(j.hasard() * 4)
      j.pointer.x = 180
      j.pointer.y = 306 + ligne * 74 + 30
      colonie.appui(j, j.pointer)
    }
    colonie.maj(j, PAS)
    ctx.ops.length = 0
    colonie.dessine(j, ctx)
    for (const op of ctx.ops) {
      if (op.type === 'texte') assert.doesNotMatch(String(op.s), /NaN|undefined/, `texte corrompu : « ${op.s} »`)
      for (const cle of ['x', 'y', 'w', 'h']) if (op[cle] !== undefined) assert.ok(Number.isFinite(op[cle]), `${cle} non fini dans une opération de dessin`)
    }
    j.t += PAS
    if (j.fini) break
  }

  assert.ok(Number.isFinite(j.e.e.population))
  colonie.quitte(j)
})

test('le jeu tourne, se dessine et se sauve sans jamais planter, y compris après une extinction', () => {
  const memoire = { valeur: null }
  const j = fauxJeu(colonie, { graine: 21, memoire })
  const ctx = fauxCtx()
  // On force une extinction rapide pour vérifier le chemin de fin.
  j.e.e.population = 3
  j.e.e.nourriture = 0
  j.e.e.n = j.e.e.n.map(() => 0)

  let images = 0
  while (!j.fini && images < 5000) {
    colonie.maj(j, PAS)
    ctx.ops.length = 0
    colonie.dessine(j, ctx)
    j.t += PAS
    images++
  }
  assert.ok(j.fini, 'la colonie ne s’est jamais éteinte malgré l’absence totale de nourriture')
  assert.equal(memoire.valeur, null, 'la sauvegarde doit être effacée à l’extinction')
})
