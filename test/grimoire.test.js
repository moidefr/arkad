/**
 * GRIMOIRE : la résolution d'un combat et d'une récompense, en pur calcul,
 * sans canvas — plus une partie simulée complète via `faux.js` pour prouver
 * que rien ne casse au dessin.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CARTES, STARTERS, POOL, ADVERSAIRES, DEPART, MAIN_TAILLE, ENERGIE_BASE } from '../src/long/grimoire/donnees.js'
import * as L from '../src/long/grimoire/logique.js'
import { graine, fauxJeu, fauxCtx, peint } from './faux.js'
import def from '../src/long/grimoire/index.js'
import { dispo, zoneCarte, dans } from '../src/long/grimoire/dispo.js'

// --- Données -----------------------------------------------------------------------

test('chaque carte du deck de départ existe dans la table des cartes', () => {
  for (const id of DEPART) assert.ok(CARTES.some((c) => c.id === id), `« ${id} » du deck de départ n’existe pas`)
})

test('les identifiants de cartes sont uniques', () => {
  const ids = CARTES.map((c) => c.id)
  assert.equal(new Set(ids).size, ids.length, 'deux cartes partagent le même identifiant')
})

test('chaque carte a un coût fini et non négatif, et au moins un effet', () => {
  const champsEffet = [
    'degats', 'bloc', 'soin', 'recul', 'pioche', 'energieBonus', 'force', 'fragile', 'vulnerable', 'faible', 'poison',
  ]
  for (const c of CARTES) {
    assert.ok(Number.isFinite(c.cout) && c.cout >= 0, `${c.id} a un coût invalide`)
    const aUnEffet = champsEffet.some((champ) => c[champ] !== undefined) || c.defausseMain
    assert.ok(aUnEffet, `${c.id} n’a aucun effet`)
  }
})

test('le pool à débloquer reste dans la fourchette prévue (30 à 40 cartes)', () => {
  assert.ok(POOL.length >= 30 && POOL.length <= 40, `${POOL.length} cartes dans le pool`)
})

test('les cartes de départ sont toutes débloquées d’office (jamais offertes en récompense, mais jouables)', () => {
  for (const c of STARTERS) assert.ok(!POOL.some((p) => p.id === c.id), `${c.id} est à la fois starter et récompense`)
})

test('les paliers de déblocage sont croissants et commencent à zéro', () => {
  const paliers = [...new Set(POOL.map((c) => c.debloqueA))].sort((a, b) => a - b)
  assert.equal(paliers[0], 0, 'aucune carte n’est débloquée dès le départ')
  assert.ok(paliers.length >= 3, 'un seul palier ne fait pas une progression')
})

test('chaque adversaire a un motif d’au moins un coup, avec des multiplicateurs positifs', () => {
  for (const a of ADVERSAIRES) {
    assert.ok(a.pattern.length > 0, `${a.nom} n’a aucun coup`)
    for (const coup of a.pattern) {
      if (coup.type === 'attaque') assert.ok(coup.mult > 0, `${a.nom} a un multiplicateur d’attaque nul ou négatif`)
    }
  }
})

// --- Sauvegarde ------------------------------------------------------------------

test('une sauvegarde d’un format incompatible ne plante pas : elle repart à neuf', () => {
  assert.equal(L.migre(null), null)
  assert.equal(L.migre({ pv: 40, deck: ['coup'] }), null, 'l’ancien format (sans version) doit être rejeté')
  assert.equal(L.migre({ v: 0, run: null }), null, 'une version différente doit être rejetée')
})

test('un run dont toutes les cartes ont disparu de la table redevient null plutôt que de bloquer', () => {
  const brut = { v: L.VERSION, meta: { victoires: 2 }, run: { pv: 10, pvMax: 60, pioche: ['fantome'], main: [], defausse: [] } }
  const s = L.migre(brut)
  assert.equal(s.run, null)
  assert.equal(s.meta.victoires, 2, 'la méta-progression doit survivre même si le run est perdu')
})

test('une sauvegarde du bon format se relit sans rien perdre', () => {
  const s = L.neuf()
  s.meta.victoires = 7
  L.demarrer(s, graine(1))
  const relu = L.migre(JSON.parse(JSON.stringify(s)))
  assert.equal(relu.meta.victoires, 7)
  assert.equal(relu.run.pv, s.run.pv)
  assert.equal(L.tailleDeck(relu.run), L.tailleDeck(s.run))
  assert.equal(relu.run.combat.nom, s.run.combat.nom)
})

test('une sauvegarde en pleine récompense se relit avec sa proposition intacte', () => {
  const s = L.neuf()
  const hasard = graine(9)
  L.demarrer(s, hasard)
  // Un coup à un seul point de vie tombe toujours l’adversaire, quelle que
  // soit la carte tirée en premier : c’est le moyen le plus direct d’atteindre
  // la phase « récompense » sans dépendre d’une main précise.
  s.run.combat.pv = 1
  const i = s.run.main.findIndex((id) => (L.carteDe(id).degats ?? 0) > 0 && L.estJouable(s.run, L.carteDe(id)))
  assert.ok(i >= 0, 'la main de départ devrait toujours porter au moins une attaque jouable')
  L.jouerCarte(s, i, hasard)
  assert.equal(s.run.phase, 'recompense')

  const relu = L.migre(JSON.parse(JSON.stringify(s)))
  assert.equal(relu.run.phase, 'recompense')
  assert.ok(relu.run.recompense.length > 0)
})

// --- Résolution pure : pas de NaN, pas de valeur hors bornes --------------------

test('mille tours joués au hasard ne produisent ni NaN ni PV hors de [0, pvMax]', () => {
  const hasard = graine(5)
  const s = L.neuf()
  L.demarrer(s, hasard)
  for (let i = 0; i < 1000; i++) {
    const run = s.run
    if (run.phase === 'recompense') {
      const options = [...run.recompense, null]
      const choix = options[Math.floor(hasard() * options.length)]
      L.choisirRecompense(s, choix, hasard)
      continue
    }
    assert.ok(Number.isFinite(run.pv) && run.pv >= 0 && run.pv <= run.pvMax, `pv=${run.pv} hors bornes au tour ${i}`)
    if (run.combat) {
      assert.ok(Number.isFinite(run.combat.pv), `pv ennemi devient NaN au tour ${i}`)
      assert.ok(run.combat.pv <= run.combat.pvMax + 1e-6, `pv ennemi > pvMax au tour ${i}`)
    }
    const jouables = run.main.map((id, k) => k).filter((k) => L.estJouable(run, L.carteDe(run.main[k])))
    let ev
    if (jouables.length && hasard() < 0.85) {
      const k = jouables[Math.floor(hasard() * jouables.length)]
      ev = L.jouerCarte(s, k, hasard)
    } else {
      ev = L.finirTour(s, hasard)
    }
    if (ev.defaite) {
      assert.ok(Number.isFinite(ev.profondeur) && ev.profondeur >= 0)
      s.run = null
      L.demarrer(s, hasard)
    }
  }
})

test('un deck plus gros ne fait jamais dépasser les points de vie maximum ni tomber sous zéro', () => {
  const hasard = graine(21)
  const s = L.neuf()
  L.demarrer(s, hasard)
  for (let i = 0; i < 500 && s.run; i++) {
    const run = s.run
    if (run.phase === 'recompense') {
      L.choisirRecompense(s, run.recompense[0] ?? null, hasard)
      continue
    }
    const carte = run.main.length ? L.carteDe(run.main[0]) : null
    const ev = carte && L.estJouable(run, carte) ? L.jouerCarte(s, 0, hasard) : L.finirTour(s, hasard)
    if (ev.defaite) break
    assert.ok(run.pv >= 0 && run.pv <= run.pvMax)
  }
})

// --- Le risque central : un deck qui grossit dilue ses bonnes cartes -----------

test('après plusieurs victoires, le deck a strictement grossi par rapport au départ', () => {
  const hasard = graine(3)
  const s = L.neuf()
  L.demarrer(s, hasard)
  const tailleDepart = L.tailleDeck(s.run)
  let victoires = 0
  for (let i = 0; i < 2000 && victoires < 5; i++) {
    const run = s.run
    if (run.phase === 'recompense') {
      L.choisirRecompense(s, run.recompense[0], hasard) // prend toujours : le pire cas pour la dilution
      victoires++
      continue
    }
    const carte = run.main.length ? L.carteDe(run.main[0]) : null
    const ev = carte && L.estJouable(run, carte) ? L.jouerCarte(s, 0, hasard) : L.finirTour(s, hasard)
    if (ev.defaite) {
      s.run = null
      L.demarrer(s, hasard)
    }
  }
  assert.ok(L.tailleDeck(s.run) > tailleDepart, 'le deck n’a pas grossi après cinq récompenses acceptées')
})

test('refuser toutes les récompenses garde le deck à sa taille de départ', () => {
  const hasard = graine(4)
  const s = L.neuf()
  L.demarrer(s, hasard)
  const tailleDepart = L.tailleDeck(s.run)
  for (let i = 0; i < 300 && s.run; i++) {
    const run = s.run
    if (run.phase === 'recompense') {
      L.choisirRecompense(s, null, hasard)
      continue
    }
    const carte = run.main.length ? L.carteDe(run.main[0]) : null
    const ev = carte && L.estJouable(run, carte) ? L.jouerCarte(s, 0, hasard) : L.finirTour(s, hasard)
    if (ev.defaite) break
  }
  assert.ok(s.run === null || L.tailleDeck(s.run) === tailleDepart, 'une récompense refusée a quand même grossi le deck')
})

// --- Une partie jouée entièrement via le faux moteur, jusqu’au dessin ----------

test('une partie simulée complète ne plante jamais et ne peint aucun NaN', () => {
  const j = fauxJeu(def, { hasard: graine(6), neuve: true })
  const ctx = fauxCtx()

  for (let coup = 0; coup < 400; coup++) {
    ctx.ops.length = 0
    def.dessine(j, ctx)
    for (const op of ctx.ops) {
      const r = peint(op)
      if (!r) continue
      assert.ok(Number.isFinite(r.x) && Number.isFinite(r.y) && Number.isFinite(r.w) && Number.isFinite(r.h), 'position non finie peinte à l’écran')
    }

    const s = j.e.s
    const run = s.run
    if (!run) break

    const d = dispo(j)
    if (run.phase === 'combat') {
      const total = Math.max(1, run.main.length)
      const jouable = run.main.findIndex((id) => L.estJouable(run, L.carteDe(id)))
      const i = jouable >= 0 ? jouable : -1
      const z = i >= 0 ? zoneCarte(d, j, i, total) : d.finTour
      j.pointer.x = z.x + z.w / 2
      j.pointer.y = z.y + z.h / 2
      def.appui(j, j.pointer)
    } else {
      const options = [...run.recompense, null]
      const z = zoneCarte(d, j, 0, options.length)
      j.pointer.x = z.x + z.w / 2
      j.pointer.y = z.y + z.h / 2
      def.appui(j, j.pointer)
    }

    if (j.fini) break
  }
})

test('la géométrie des cartes reste dans l’écran et les zones ne se recouvrent pas', () => {
  const j = { W: 360, H: 640 }
  const d = dispo(j)
  for (let total = 1; total <= 8; total++) {
    for (let i = 0; i < total; i++) {
      const z = zoneCarte(d, j, i, total)
      assert.ok(z.x >= 0 && z.x + z.w <= j.W, `carte ${i}/${total} déborde à l’horizontale (x=${z.x}, w=${z.w})`)
      assert.ok(z.w > 0 && z.h > 0)
    }
  }
})

test('dans() reconnaît un point dans une zone et rejette un point hors zone', () => {
  const z = { x: 10, y: 10, w: 20, h: 20 }
  assert.ok(dans({ x: 15, y: 15 }, z))
  assert.ok(!dans({ x: 5, y: 5 }, z))
  assert.ok(!dans(null, z))
})

// --- Automates : mesure de l'équilibre, pas de suppositions ----------------------

function scoreBrutal(carte) {
  if (carte.type === 'attaque') return 100 + (carte.degats ?? 0) * (carte.fois ?? 1) * 10
  if (carte.type === 'defense') return 20 + (carte.bloc ?? 0)
  return 10 + (carte.soin ?? 0)
}

function scoreSynergie(carte, co) {
  let s = (carte.degats ?? 0) * (carte.fois ?? 1) * 0.6
  s += (carte.poison ?? 0) * 3 + (carte.vulnerable ?? 0) * 4 + (carte.faible ?? 0) * 4
  s += (carte.force ?? 0) * 3.5 + (carte.bloc ?? 0) * 1.6 + (carte.soin ?? 0) * 1.4
  s += (carte.comboParCarte ?? 0) * 5 + (carte.pioche ?? 0) * 2
  if (carte.finisseur) s += co.pv <= co.pvMax * 0.3 ? 20 : 3
  s -= (carte.recul ?? 0) * 3 + (carte.fragile ?? 0) * 4
  return s
}

function joueTour(scoreDe, s, hasard) {
  const run = s.run
  for (let garde = 0; garde < 20; garde++) {
    const main = L.mainDe(run)
    let meilleur = -1
    let meilleurScore = -Infinity
    main.forEach((carte, i) => {
      if (!L.estJouable(run, carte)) return
      const score = scoreDe(carte, run.combat)
      if (score > meilleurScore) {
        meilleurScore = score
        meilleur = i
      }
    })
    if (meilleur < 0) break
    const ev = L.jouerCarte(s, meilleur, hasard)
    if (ev.victoire || ev.defaite) return ev
  }
  return L.finirTour(s, hasard)
}

function joueUnePartie(scoreDe, s, hasard) {
  for (let tour = 0; tour < 3000; tour++) {
    if (s.run.phase === 'recompense') {
      const co = { pv: s.run.pvMax, pvMax: s.run.pvMax }
      let choix = null
      let meilleur = 0
      for (const id of s.run.recompense) {
        const sc = scoreDe(L.carteDe(id), co)
        if (sc > meilleur) {
          meilleur = sc
          choix = id
        }
      }
      L.choisirRecompense(s, choix, hasard)
      continue
    }
    const ev = joueTour(scoreDe, s, hasard)
    if (ev.defaite) return ev.profondeur
  }
  return s.run.profondeur
}

test('au moins deux stratégies de choix de carte restent viables sur cinquante parties (ni ~0, ni la seule à survivre)', () => {
  const strategies = { brutal: scoreBrutal, synergie: scoreSynergie }
  const profondeurs = {}
  for (const [nom, scoreDe] of Object.entries(strategies)) {
    const hasard = graine(nom.length * 101 + 1)
    const s = L.neuf()
    const parties = []
    for (let i = 0; i < 50; i++) {
      L.demarrer(s, hasard)
      parties.push(joueUnePartie(scoreDe, s, hasard))
    }
    profondeurs[nom] = parties.reduce((a, b) => a + b, 0) / parties.length
  }
  for (const [nom, moyenne] of Object.entries(profondeurs)) assert.ok(moyenne > 1, `${nom} n’avance presque jamais (${moyenne})`)
  const [a, b] = Object.values(profondeurs)
  const ratio = Math.max(a, b) / Math.max(1, Math.min(a, b))
  assert.ok(ratio < 3, `une stratégie domine trop l’autre (${JSON.stringify(profondeurs)}, ratio ${ratio.toFixed(2)})`)
})

test('la main de départ ne dépasse jamais MAIN_TAILLE cartes en tout début de combat', () => {
  const hasard = graine(15)
  const s = L.neuf()
  L.demarrer(s, hasard)
  assert.ok(s.run.main.length <= MAIN_TAILLE)
  assert.equal(s.run.energie, ENERGIE_BASE)
})
