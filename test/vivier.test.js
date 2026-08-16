/**
 * VIVIER : les tables, le croisement, la sauvegarde, et une partie jouée.
 *
 * Ce jeu n'a ni victoire ni défaite — rien à mesurer côté survie, comme pour
 * EXPÉDITION. Ce qui remplace la question « meurt-on trop souvent ? » ici,
 * c'est « toutes les combinaisons de la collection sont-elles vraiment
 * atteignables, ou certaines sont-elles piégées derrière un allèle qu'aucune
 * fondatrice ne porte ? » — exactement le genre de défaut qu'aucun coup
 * d'œil ne révèle et qu'une simulation révèle en une seconde.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import vivier from '../src/long/vivier/index.js'
import { TRAITS, FONDATEURS, CAPACITE, NOURRITURE_MAX, CREDIT_MAX, CYCLE_LENT } from '../src/long/vivier/donnees.js'
import * as L from '../src/long/vivier/logique.js'
import { dispo, zoneCase } from '../src/long/vivier/dispo.js'
import { fauxCtx, graine, joue, peint } from './faux.js'

// --- Données -----------------------------------------------------------------------

test('chaque gène a au moins deux allèles, sans id en double', () => {
  for (const t of TRAITS) {
    assert.ok(t.valeurs.length >= 2, `${t.cle} n’a qu’un allèle, la dominance ne veut rien dire`)
    const ids = new Set(t.valeurs.map((v) => v.id))
    assert.equal(ids.size, t.valeurs.length, `${t.cle} a des id en double`)
    for (const v of t.valeurs) assert.ok(v.nom, `un allèle de ${t.cle} n’a pas de nom`)
  }
})

test('chaque allèle de chaque gène est porté par au moins une fondatrice', () => {
  // Condition nécessaire à l'atteignabilité : un allèle qu'aucune fondatrice
  // ne porte ne peut jamais apparaître dans aucune descendance, quel que
  // soit le nombre de générations.
  for (const t of TRAITS) {
    const portes = new Set()
    for (const f of FONDATEURS) for (const a of f[t.cle]) portes.add(a)
    assert.equal(portes.size, t.valeurs.length, `${t.cle} : un allèle n’est porté par aucune fondatrice`)
  }
})

test('le bassin laisse de la place à la rotation au-delà des fondatrices', () => {
  assert.ok(CAPACITE > FONDATEURS.length, 'CAPACITE devrait dépasser le nombre de fondatrices')
})

test('comboDeIndex couvre tout l’espace des combinaisons, sans répétition', () => {
  const vus = new Set()
  for (let i = 0; i < L.TOTAL_COMBOS; i++) {
    const phen = L.comboDeIndex(i)
    assert.equal(phen.length, TRAITS.length)
    const id = L.comboId(phen)
    assert.equal(vus.has(id), false, `combinaison ${id} obtenue deux fois`)
    vus.add(id)
  }
  assert.equal(vus.size, L.TOTAL_COMBOS)
})

test('neuf() enregistre déjà les phénotypes visibles des fondatrices', () => {
  const e = L.neuf()
  const attendus = new Set(
    FONDATEURS.map((f) => L.comboId(L.phenotype({ couleur: f.couleur, forme: f.forme, motif: f.motif, taille: f.taille }))),
  )
  assert.equal(e.decouvertes.length, attendus.size)
  assert.equal(e.bassin.length, FONDATEURS.length)
})

// --- Atteignabilité par croisement ---------------------------------------------------

test('toutes les combinaisons du pool sont atteignables par croisement', () => {
  const hasard = graine(2024)
  const e = L.neuf()
  const LIMITE = 50000 // mesuré au banc : la collection tombe entière en moins de 4000 pontes
  let i = 0
  for (; i < LIMITE && e.decouvertes.length < L.TOTAL_COMBOS; i++) L.ponte(e, hasard)
  assert.equal(
    e.decouvertes.length,
    L.TOTAL_COMBOS,
    `seulement ${e.decouvertes.length}/${L.TOTAL_COMBOS} combinaisons atteintes en ${LIMITE} pontes`,
  )
})

// --- Calcul pur : pas de NaN, pas de valeur hors bornes -------------------------------

test('dix mille avancées, à grands pas, ne produisent ni NaN ni valeur hors bornes', () => {
  const hasard = graine(5)
  const e = L.neuf()
  for (let i = 0; i < 10000; i++) {
    L.avance(e, 15 + hasard() * 45, hasard)
    assert.ok(Number.isFinite(e.temps), `temps devient NaN au tour ${i}`)
    assert.ok(Number.isFinite(e.minuterie) && e.minuterie <= CYCLE_LENT, `minuterie = ${e.minuterie} au tour ${i}`)
    assert.ok(e.nourriture >= 0 && e.nourriture <= NOURRITURE_MAX, `nourriture = ${e.nourriture} au tour ${i}`)
    assert.ok(e.bassin.length >= FONDATEURS.length && e.bassin.length <= CAPACITE, `bassin de taille ${e.bassin.length}`)
    assert.ok(e.decouvertes.length <= L.TOTAL_COMBOS, 'plus de découvertes que de combinaisons possibles')
    assert.ok(Number.isFinite(e.naissances) && e.naissances >= FONDATEURS.length)
  }
})

test('les fondatrices ne quittent jamais le bassin, même après des milliers de pontes', () => {
  const hasard = graine(6)
  const e = L.neuf()
  for (let i = 0; i < 5000; i++) L.ponte(e, hasard)
  for (let i = 0; i < FONDATEURS.length; i++) assert.equal(e.bassin[i].id, i, `la fondatrice ${i} a été remplacée`)
})

// --- Sauvegarde ------------------------------------------------------------------

test('une sauvegarde d’un format incompatible ne plante pas : elle repart à neuf', () => {
  assert.equal(L.migre(null), null)
  assert.equal(L.migre({ bassin: [] }), null, 'l’ancien format (sans version) doit être rejeté')
  assert.equal(L.migre({ v: 99, bassin: [{ id: 0 }, { id: 1 }] }), null, 'une version future doit être rejetée')
  assert.equal(L.migre({ v: L.VERSION, bassin: [{ id: 0 }] }), null, 'un bassin à une seule créature ne peut pas repartir')
})

test('une sauvegarde abîmée se nettoie plutôt que de planter', () => {
  const e = L.migre({
    v: L.VERSION,
    bassin: [
      { id: 'x', genotype: { couleur: ['a', 'b'] }, naissance: 'jamais' },
      { id: 1, genotype: null, naissance: NaN },
      null,
      42,
    ],
    decouvertes: ['inconnu|inconnu|inconnu|inconnu', L.comboId(L.comboDeIndex(0)), 123],
    naissances: 'beaucoup',
    nourriture: 999,
    minuterie: -5,
    temps: 'jamais',
  })
  assert.ok(e, 'la migration a renoncé sur des champs récupérables')
  assert.equal(e.bassin.length, 2)
  for (const c of e.bassin) {
    for (const t of TRAITS) {
      for (const allele of c.genotype[t.cle]) assert.ok(allele >= 0 && allele < t.valeurs.length, `${t.cle} hors bornes`)
    }
  }
  assert.deepEqual(e.decouvertes, [L.comboId(L.comboDeIndex(0))], 'un id de combinaison inconnu a survécu au nettoyage')
  assert.equal(e.nourriture, NOURRITURE_MAX, 'la nourriture doit être plafonnée, pas rejetée')
  assert.ok(Number.isFinite(e.temps))
  assert.ok(e.minuterie > 0, 'une minuterie négative doit être corrigée, pas laissée bloquante')
})

test('une sauvegarde du bon format se relit sans rien perdre', () => {
  const hasard = graine(9)
  const e = L.neuf()
  for (let i = 0; i < 80; i++) L.ponte(e, hasard)
  L.nourrir(e)
  const relu = L.migre(JSON.parse(JSON.stringify(L.sauvegarde(e))))
  assert.equal(relu.bassin.length, e.bassin.length)
  assert.deepEqual(relu.decouvertes.slice().sort(), e.decouvertes.slice().sort())
  assert.equal(relu.naissances, e.naissances)
  assert.equal(relu.nourriture, e.nourriture)
})

// --- Le crédit hors ligne ------------------------------------------------------------

test('reculer l’horloge ne crédite rien', () => {
  const e = L.neuf()
  const maintenant = 1e12
  e.quand = maintenant
  const credit = L.credite(e, maintenant - 3600_000, graine(1))
  assert.deepEqual(credit, { naissances: 0, decouvertes: 0 })
  assert.equal(e.naissances, FONDATEURS.length, 'une horloge reculée a quand même fait naître des créatures')
})

test('une longue absence est créditée, mais plafonnée à CREDIT_MAX', () => {
  const e = L.neuf()
  e.quand = 1e12
  // Un an d'absence ne doit pas rapporter plus que le plafond ne l'autorise.
  const credit = L.credite(e, 1e12 + 365 * 24 * 3600 * 1000, graine(3))
  assert.ok(credit.naissances > 0, 'une absence plafonnée ne fait quand même rien naître')
  const bornePontes = Math.ceil(CREDIT_MAX / 240) + 2 // au plus vite, une ponte toutes les 240 s
  assert.ok(credit.naissances <= bornePontes, `${credit.naissances} naissances créditées, le plafond ne tient pas`)
})

// --- La partie jouée, via le vrai chemin du moteur ------------------------------------

test('une partie simulée avec des appuis réels ne plante jamais et ne dessine rien d’invalide', () => {
  let tours = 0
  const { j, ctx } = joue(vivier, {
    duree: 300, // cinq minutes de jeu simulées, assez pour éprouver l’interface sans ralentir la suite
    graine: 11,
    dessine: true,
    pilote: (jj) => {
      tours++
      if (tours % 180 !== 0) return // un geste toutes les trois secondes de jeu
      const d = dispo(jj)
      if (tours % 360 === 0) {
        jj.pointer.x = d.bouton.x + d.bouton.w / 2
        jj.pointer.y = d.bouton.y + d.bouton.h / 2
      } else {
        const z = zoneCase(d, tours % 12)
        jj.pointer.x = z.x + z.w / 2
        jj.pointer.y = z.y + z.h / 2
      }
      return 'appui'
    },
  })

  // Deux fondatrices peuvent partager le même phénotype dominant (voir le
  // test de `neuf()` ci-dessus) : la seule garantie ici est qu'il y a bien
  // quelque chose, pas un compte précis.
  assert.ok(j.e.decouvertes.length > 0 && j.e.decouvertes.length <= L.TOTAL_COMBOS)
  assert.ok(Number.isFinite(j.score))
  assert.ok(ctx.ops.length > 0, 'rien n’a été dessiné')
  for (const op of ctx.ops) {
    const b = peint(op)
    if (b === null) continue // hors cadre ou transparent : rien à vérifier
    assert.ok(Number.isFinite(b.x) && Number.isFinite(b.y) && Number.isFinite(b.w) && Number.isFinite(b.h), 'un rectangle peint contient un NaN')
  }
})

test('nourrir depuis l’interface consomme le bouton, pas au hasard', () => {
  const ctx = fauxCtx()
  const { j } = joue(vivier, { duree: 1 / 60, graine: 2 })
  j.e.nourriture = 0
  const d = dispo(j)
  j.pointer.x = d.bouton.x + d.bouton.w / 2
  j.pointer.y = d.bouton.y + d.bouton.h / 2
  vivier.appui(j, j.pointer)
  assert.equal(j.e.nourriture, 2, 'appuyer sur NOURRIR n’a rien nourri')
  vivier.dessine(j, ctx)
})

// --- Le rythme : actif contre passif --------------------------------------------------

test('nourrir régulièrement fait avancer la collection plus vite que ne rien faire', () => {
  // Pas une mesure d'équilibrage complète — c'est le rôle de vivier-banc.mjs
  // — juste la direction : un joueur qui revient nourrir ne doit jamais être
  // plus lent qu'un bassin livré à lui-même.
  const HEURES = 20
  const PAS = 30
  function simuler(actif, seed) {
    const hasard = graine(seed)
    const e = L.neuf()
    for (let t = 0; t < HEURES * 3600; t += PAS) {
      if (actif && Math.floor(t / 120) !== Math.floor((t - PAS) / 120)) L.nourrir(e)
      L.avance(e, PAS, hasard)
    }
    return e.decouvertes.length
  }
  const actif = simuler(true, 41)
  const passif = simuler(false, 43)
  assert.ok(actif >= passif, `actif (${actif}) devrait au moins égaler passif (${passif}) sur ${HEURES} h`)
})
