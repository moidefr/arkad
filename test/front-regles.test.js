/**
 * Les invariants de FRONT : la géométrie, les tables, et le fait qu'aucune
 * aptitude ne soit décorative.
 *
 * Ce dernier point est la leçon du jeu précédent, où des fardeaux entiers
 * n'avaient aucun effet parce que leur application testait des identifiants
 * écrits à la main. Ici, une aptitude qui ne change rien fait échouer le test.
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import * as H from '../src/massif/front/hex.js'
import { TERRAINS, T, BIOMES, INDICE } from '../src/massif/front/terrain.js'
import { CLASSES, CL, TYPES, EFFICACITE, GRADES } from '../src/massif/front/donnees/classes.js'
import { APTITUDES, APT, PASSIFS, EFFETS } from '../src/massif/front/donnees/aptitudes.js'
import { UNIQUES, UQ, RARETES } from '../src/massif/front/donnees/uniques.js'
import * as U from '../src/massif/front/unites.js'

// --- La grille ---------------------------------------------------------------

test('un hexagone a six voisins, tous à un pas', () => {
  for (const v of H.voisins(3, -2)) assert.equal(H.distance(3, -2, v.q, v.r), 1)
  assert.equal(new Set(H.voisins(0, 0).map((v) => H.cle(v.q, v.r))).size, 6)
})

test('la distance est symétrique et vaut le nombre de pas', () => {
  assert.equal(H.distance(0, 0, 0, 0), 0)
  assert.equal(H.distance(0, 0, 3, 0), 3)
  assert.equal(H.distance(2, -3, -1, 4), H.distance(-1, 4, 2, -3))
  // Sur une grille carrée la diagonale trichait ; ici, quatre pas font quatre.
  assert.equal(H.distance(0, 0, 2, 2), 4)
})

test('le rayon n contient 1 + 3n(n+1) hexagones', () => {
  for (let n = 0; n < 5; n++) assert.equal(H.rayon(0, 0, n).length, 1 + 3 * n * (n + 1))
})

test('l’anneau n contient 6n hexagones, tous à n pas', () => {
  for (let n = 1; n < 5; n++) {
    const a = H.anneau(2, 1, n)
    assert.equal(a.length, 6 * n)
    for (const h of a) assert.equal(H.distance(2, 1, h.q, h.r), n)
  }
})

test('écran et hexagone se répondent : on retrouve la case sous le doigt', () => {
  for (let q = -6; q <= 6; q++) {
    for (let r = -6; r <= 6; r++) {
      const p = H.versEcran(q, r, 23)
      const h = H.versHex(p.x, p.y, 23)
      assert.deepEqual(h, { q, r }, `${q},${r}`)
    }
  }
})

test('la ligne relie vraiment les deux bouts, sans trou', () => {
  const l = H.ligne(0, 0, 4, -2)
  assert.deepEqual(l[0], { q: 0, r: 0 })
  assert.deepEqual(l[l.length - 1], { q: 4, r: -2 })
  for (let i = 1; i < l.length; i++) assert.equal(H.distance(l[i - 1].q, l[i - 1].r, l[i].q, l[i].r), 1)
})

test('offset et axial se répondent', () => {
  for (let col = 0; col < 9; col++) {
    for (let lig = 0; lig < 7; lig++) {
      const a = H.versAxial(col, lig)
      assert.deepEqual(H.versOffset(a.q, a.r), { col, lig })
    }
  }
})

// --- Les tables --------------------------------------------------------------

test('chaque terrain est complet et cohérent', () => {
  const vus = new Set()
  for (const t of TERRAINS) {
    assert.ok(!vus.has(t.id), 'terrain en double : ' + t.id)
    vus.add(t.id)
    assert.ok(t.nom && t.court && t.couleur, t.id)
    if (t.bloque) assert.equal(t.cout, undefined, `${t.id} est infranchissable : son coût ne sert à rien`)
    else assert.ok(t.cout > 0 && t.cout <= 3, `${t.id} coûte ${t.cout}`)
    assert.ok(Math.abs(t.couvert ?? 0) <= 0.4, t.id)
  }
})

test('chaque biome ne pose que des terrains qui existent', () => {
  for (const b of BIOMES) {
    assert.ok(T[b.fond], `${b.id} : fond inconnu ${b.fond}`)
    for (const t of b.taches) assert.ok(T[t.t], `${b.id} : tache inconnue ${t.t}`)
  }
})

test('les indices de terrain sont stables et complets', () => {
  TERRAINS.forEach((t, i) => assert.equal(INDICE[t.id], i))
})

test('la table d’efficacité couvre tous les types dans les deux sens', () => {
  for (const a of TYPES) {
    for (const b of TYPES) {
      const v = EFFICACITE[a.id]?.[b.id]
      assert.ok(typeof v === 'number' && v > 0.4 && v < 2, `${a.id}→${b.id} = ${v}`)
    }
  }
})

test('aucun type n’est bon contre tout le monde', () => {
  for (const a of TYPES) {
    const faibles = TYPES.filter((b) => EFFICACITE[a.id][b.id] < 1)
    assert.ok(faibles.length >= 1, `${a.id} n’a aucune mauvaise cible`)
  }
})

test('chaque classe est complète, et ses aptitudes existent', () => {
  const vus = new Set()
  for (const c of CLASSES) {
    assert.ok(!vus.has(c.id), 'classe en double : ' + c.id)
    vus.add(c.id)
    assert.ok(c.nom && c.court.length === 3, c.id)
    assert.ok(
      TYPES.some((t) => t.id === c.type),
      `${c.id} : type inconnu`,
    )
    assert.ok(c.pv > 0 && c.att > 0 && c.def >= 0 && c.mvt > 0 && c.vue > 0 && c.prix > 0, c.id)
    assert.ok(c.portee[0] >= 1 && c.portee[1] >= c.portee[0], c.id)
    for (const a of c.apt) assert.ok(APT[a], `${c.id} : aptitude inconnue ${a}`)
  }
})

test('les six types sont tous jouables dès qu’on monte', () => {
  for (const t of TYPES) {
    const dispo = CLASSES.filter((c) => c.type === t.id)
    assert.ok(dispo.length >= 4, `${t.id} n’a que ${dispo.length} classe(s)`)
    assert.ok(Math.min(...dispo.map((c) => c.rang)) <= 4, `${t.id} arrive trop tard`)
  }
})

test('le prix d’une classe suit sa puissance', () => {
  const trie = [...CLASSES].sort((a, b) => a.prix - b.prix)
  const force = (c) => c.pv + c.att * 3 + c.def * 2 + c.mvt * 2 + c.portee[1] * 4
  // Pas une monotonie stricte — un éclaireur cher n'est pas absurde — mais le
  // premier quart doit rester moins fort que le dernier.
  const bas = trie.slice(0, 8).reduce((s, c) => s + force(c), 0) / 8
  const haut = trie.slice(-8).reduce((s, c) => s + force(c), 0) / 8
  assert.ok(haut > bas * 1.4, `${bas.toFixed(0)} contre ${haut.toFixed(0)}`)
})

test('les grades montent dans le bon ordre', () => {
  GRADES.forEach((g, i) => {
    assert.equal(g.id, i)
    if (i) {
      assert.ok(g.pv >= GRADES[i - 1].pv && g.att >= GRADES[i - 1].att, g.nom)
      assert.ok(g.niveau > GRADES[i - 1].niveau, g.nom)
    }
  })
})

// --- Les aptitudes -----------------------------------------------------------

test('aucune aptitude n’est décorative : sa clé est consommée par le moteur', async () => {
  const src = await lisSources()
  for (const a of APTITUDES) {
    if (a.passif) {
      assert.ok(PASSIFS.includes(a.passif), `${a.id} : passif hors vocabulaire (${a.passif})`)
      assert.ok(src.includes(`'${a.passif}'`), `${a.id} : le passif « ${a.passif} » n’est lu nulle part`)
      assert.ok(a.valeur > 0, `${a.id} : valeur nulle`)
    } else {
      assert.ok(a.ordre, `${a.id} n’est ni passif ni ordre`)
      const cles = Object.keys(a.ordre.effets)
      assert.ok(cles.length, `${a.id} : ordre sans effet`)
      for (const k of cles) {
        assert.ok(EFFETS.includes(k), `${a.id} : effet hors vocabulaire (${k})`)
        assert.ok(src.includes(`e.${k}`), `${a.id} : l’effet « ${k} » n’est lu nulle part`)
      }
    }
  }
})

test('chaque passif du vocabulaire est porté par au moins une aptitude', () => {
  for (const p of PASSIFS)
    assert.ok(
      APTITUDES.some((a) => a.passif === p),
      `passif orphelin : ${p}`,
    )
})

test('les aptitudes ont toutes un nom, un code court et une explication', () => {
  const vus = new Set()
  for (const a of APTITUDES) {
    assert.ok(!vus.has(a.id), 'aptitude en double : ' + a.id)
    vus.add(a.id)
    assert.ok(a.nom && a.court.length <= 3 && a.texte?.length > 12, a.id)
  }
})

test('un ordre a toujours une portée cohérente et un refroidissement', () => {
  for (const a of APTITUDES.filter((x) => x.ordre)) {
    const o = a.ordre
    assert.ok(['soi', 'allie', 'ennemi', 'hex'].includes(o.forme), `${a.id} : forme ${o.forme}`)
    assert.ok(o.froid >= 2, `${a.id} : refroidissement trop court`)
    if (o.forme !== 'soi') assert.ok(o.portee && o.portee[1] >= o.portee[0], a.id)
  }
})

// --- Les uniques -------------------------------------------------------------

test('chaque unique a une identité complète et une classe réelle', () => {
  const vus = new Set()
  const noms = new Set()
  for (const u of UNIQUES) {
    assert.ok(!vus.has(u.id), 'unique en double : ' + u.id)
    vus.add(u.id)
    assert.ok(!noms.has(u.nom), 'deux uniques portent le même nom : ' + u.nom)
    noms.add(u.nom)
    assert.ok(CL[u.cl], `${u.id} : classe inconnue ${u.cl}`)
    assert.ok(u.titre?.length > 3 && u.phrase?.length > 12, `${u.id} : pas d’identité`)
    assert.ok(
      RARETES.some((r) => r.id === u.rarete),
      u.id,
    )
    assert.ok(u.grade >= 1 && u.grade < GRADES.length, `${u.id} : grade ${u.grade}`)
    for (const a of u.apt) assert.ok(APT[a], `${u.id} : aptitude inconnue ${a}`)
    assert.ok(u.rang >= 1, u.id)
  }
})

test('un unique vaut plus que le générique de sa classe', () => {
  for (const uq of UNIQUES) {
    const gen = U.creeGenerique(uq.cl, uq.rang)
    const un = U.creeUnique(uq.id, uq.rang)
    const f = (u) => {
      const x = U.fiche(u)
      return x.pvMax + x.att * 3 + x.def * 2 + x.mvt * 2
    }
    assert.ok(f(un) > f(gen), `${uq.id} ne vaut pas mieux qu’un ${uq.cl}`)
  }
})

test('les quatre raretés servent, et une légende reste rare', () => {
  for (const r of RARETES)
    assert.ok(
      UNIQUES.some((u) => u.rarete === r.id),
      `rareté inutilisée : ${r.nom}`,
    )
  const bassin = UNIQUES.map((u) => u.id)
  const legende = UNIQUES.find((u) => u.rarete === 4)
  const vet = UNIQUES.find((u) => u.rarete === 1)
  assert.ok(U.tauxDrop(legende.id, 20, bassin) < U.tauxDrop(vet.id, 20, bassin))
})

// --- Prix et taux ------------------------------------------------------------

test('le prix de recrutement monte avec le niveau, pour les deux boutiques', () => {
  const cl = CLASSES[0].id
  let prec = 0
  for (let n = 1; n <= 20; n++) {
    const p = U.prixGenerique(cl, n)
    assert.ok(p > prec, `niveau ${n} : ${p} <= ${prec}`)
    prec = p
  }
  const uq = UNIQUES[0].id
  prec = 0
  for (let n = 1; n <= 20; n++) {
    const p = U.prixUnique(uq, n)
    assert.ok(p > prec, `unique niveau ${n}`)
    prec = p
  }
})

test('un unique coûte nettement plus cher que le générique de sa classe', () => {
  for (const uq of UNIQUES) {
    const n = Math.max(uq.rang, 5)
    assert.ok(U.prixUnique(uq.id, n) > U.prixGenerique(uq.cl, n) * 1.5, uq.id)
  }
})

test('le taux d’apparition dépend du niveau, et ne s’ouvre qu’au bon rang', () => {
  const bassin = UNIQUES.map((u) => u.id)
  const legende = UNIQUES.find((u) => u.rarete === 4)
  assert.equal(U.poidsDrop(legende.id, legende.rang - 1, []), 0, 'trop tôt')
  assert.ok(U.poidsDrop(legende.id, legende.rang, []) > 0)
  // Plus la compagnie monte, plus les raretés hautes pèsent lourd.
  const bas = U.tauxDrop(legende.id, legende.rang, bassin)
  const haut = U.tauxDrop(legende.id, legende.rang + 8, bassin)
  assert.ok(haut > bas, `${bas.toFixed(4)} → ${haut.toFixed(4)}`)
})

test('un unique déjà recruté ne réapparaît jamais', () => {
  const bassin = UNIQUES.map((u) => u.id)
  const cible = UNIQUES[0].id
  assert.equal(U.poidsDrop(cible, 20, [cible]), 0)
  assert.equal(U.tauxDrop(cible, 20, bassin, [cible]), 0)
})

test('la somme des taux d’apparition fait bien 1', () => {
  const bassin = UNIQUES.map((u) => u.id)
  for (const n of [1, 5, 12, 22]) {
    const somme = bassin.reduce((s, id) => s + U.tauxDrop(id, n, bassin), 0)
    assert.ok(Math.abs(somme - 1) < 1e-9, `niveau ${n} : ${somme}`)
  }
})

// --- Expérience --------------------------------------------------------------

test('l’expérience fait monter, et le grade suit le niveau', () => {
  const u = U.creeGenerique('milicien', 1)
  assert.equal(u.grade, 0)
  for (let i = 0; i < 40; i++) U.gagneXp(u, 60, 20)
  assert.ok(u.niv > 5, `niveau ${u.niv}`)
  assert.ok(u.grade >= 2, `grade ${u.grade}`)
})

test('un générique ne dépasse jamais lieutenant', () => {
  const u = U.creeGenerique('milicien', 1)
  for (let i = 0; i < 200; i++) U.gagneXp(u, 400, 40)
  assert.equal(u.grade, 3)
})

test('un unique garde son grade même au niveau 1', () => {
  const legende = UNIQUES.find((u) => u.rarete === 4)
  const u = U.creeUnique(legende.id, 1)
  assert.equal(u.grade, legende.grade)
})

test('monter de niveau ne raccourcit jamais la barre de vie', () => {
  const u = U.creeGenerique('fantassin', 1)
  u.pv = U.fiche(u).pvMax
  for (let i = 0; i < 30; i++) {
    U.gagneXp(u, 80, 20)
    assert.ok(u.pv <= U.fiche(u).pvMax, 'la vie dépasse le maximum')
  }
  assert.ok(u.pv >= U.fiche(u).pvMax * 0.8, `${u.pv} / ${U.fiche(u).pvMax}`)
})

// --- Utilitaire --------------------------------------------------------------

/** Le code des règles, concaténé : sert à prouver qu'une clé est lue quelque part. */
async function lisSources() {
  const { readFile } = await import('node:fs/promises')
  const fichiers = ['bataille.js', 'unites.js', 'ia.js', 'compagnie.js']
  const parts = await Promise.all(
    fichiers.map((f) => readFile(new URL('../src/massif/front/' + f, import.meta.url), 'utf8')),
  )
  return parts.join('\n')
}
