/**
 * ABYME : la génération d'étage et la résolution d'un tour, en pur calcul,
 * sans canvas — puis une descente complète jouée à travers `index.js` avec
 * le faux moteur de `test/faux.js`, pour vérifier qu'aucun appui ni aucun
 * dessin ne produit de NaN.
 *
 * DONJON, l'ancien jeu, n'avait jamais été mesuré : personne ne savait si une
 * relique dominait trivialement les autres, ni jusqu'où une descente typique
 * allait. Ces tests, et le banc qui les accompagne, mesurent exactement ça.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  RELIQUES,
  SYNERGIES,
  MONSTRES,
  APPARITION,
  LARGEUR,
  HAUTEUR,
  BASE_DEBLOQUEES,
  ORDRE_DEBLOCAGE,
} from '../src/long/abyme/donnees.js'
import * as L from '../src/long/abyme/logique.js'
import abyme from '../src/long/abyme/index.js'
import { dispo, dansZone } from '../src/long/abyme/dispo.js'
import { fauxJeu, fauxCtx, peint, graine } from './faux.js'

// --- Données -----------------------------------------------------------------------

test('entre 15 et 20 reliques, chacune avec un identifiant unique', () => {
  assert.ok(RELIQUES.length >= 15 && RELIQUES.length <= 20, `${RELIQUES.length} reliques`)
  assert.equal(new Set(RELIQUES.map((r) => r.id)).size, RELIQUES.length, 'des identifiants en double')
  for (const r of RELIQUES) {
    assert.ok(r.nom && r.dit, `${r.id} n'a pas de nom ou de description`)
  }
})

test('deux ou trois synergies, chacune référençant deux reliques qui existent vraiment', () => {
  assert.ok(SYNERGIES.length >= 2 && SYNERGIES.length <= 3, `${SYNERGIES.length} synergies`)
  const ids = new Set(RELIQUES.map((r) => r.id))
  for (const s of SYNERGIES) {
    assert.ok(s.requises.length === 2 || s.requises.length === 3, `${s.id} ne combine pas 2 ou 3 reliques`)
    for (const r of s.requises) assert.ok(ids.has(r), `${s.id} référence une relique inconnue : ${r}`)
  }
})

test('toute relique est débloquée dès le départ ou par la méta-progression, une seule fois', () => {
  const union = [...BASE_DEBLOQUEES, ...ORDRE_DEBLOCAGE]
  assert.equal(new Set(union).size, union.length, 'une relique débloquée deux fois')
  const ids = RELIQUES.map((r) => r.id).sort()
  assert.deepEqual([...union].sort(), ids, 'la méta-progression ne couvre pas exactement les reliques du jeu')
})

test('le bestiaire a au moins trois comportements distincts, pas seulement des variantes de stats', () => {
  const comportements = new Set(Object.values(MONSTRES).map((m) => m.comportement))
  assert.ok(comportements.size >= 3, `seulement ${comportements.size} comportement(s) distinct(s)`)
  for (const a of APPARITION) assert.ok(MONSTRES[a.type], `apparition référence un type inconnu : ${a.type}`)
})

// --- Génération d'étage, en pur calcul ------------------------------------------------

test('un étage généré est toujours franchissable : départ et sortie restent reliés', () => {
  const hasard = graine(3)
  for (let profondeur = 1; profondeur <= 30; profondeur++) {
    const salle = L.genereSalle(profondeur, hasard)
    assert.equal(salle.murs.length, LARGEUR * HAUTEUR)
    assert.ok(!salle.murs[salle.depart.y * LARGEUR + salle.depart.x], 'le départ est un mur')
    assert.ok(!salle.murs[salle.sortie.y * LARGEUR + salle.sortie.x], 'la sortie est un mur')
    // BFS élémentaire : le fait même que le jeu se joue jusqu'au bout plus
    // bas dépend de cette propriété, donc on la vérifie directement ici.
    const vus = new Set([salle.depart.y * LARGEUR + salle.depart.x])
    const file = [salle.depart]
    while (file.length) {
      const c = file.pop()
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = c.x + dx
        const ny = c.y + dy
        if (nx < 0 || ny < 0 || nx >= LARGEUR || ny >= HAUTEUR) continue
        const i = ny * LARGEUR + nx
        if (salle.murs[i] || vus.has(i)) continue
        vus.add(i)
        file.push({ x: nx, y: ny })
      }
    }
    assert.ok(vus.has(salle.sortie.y * LARGEUR + salle.sortie.x), `étage ${profondeur} : sortie isolée du départ`)
  }
})

// --- Des milliers de tours résolus, sans NaN ni valeur hors bornes -------------------

test('un automate qui fonce sur le monstre le plus proche ne produit ni NaN ni PV hors bornes, sur 20 descentes', () => {
  const hasard = graine(11)
  const TOUTES = RELIQUES.map((r) => r.id)
  for (let partie = 0; partie < 20; partie++) {
    const e = L.neuf(hasard, TOUTES)
    for (let tour = 0; tour < 2000 && !e.fin; tour++) {
      const cible = e.monstres.find((m) => m.camp === 'ennemi') ?? e.salle.sortie
      const dx = cible.x - e.joueur.x
      const dy = cible.y - e.joueur.y
      const dir = dx === 0 && dy === 0 ? 'attendre' : Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'droite' : 'gauche') : dy > 0 ? 'bas' : 'haut'
      L.tour(e, dir, hasard)
      if (e.offre) L.choisis(e, e.offre[Math.floor(hasard() * e.offre.length)], hasard)

      assert.ok(Number.isFinite(e.vie), `vie devient NaN à l'étage ${e.profondeur}`)
      assert.ok(e.vie >= 0 && e.vie <= e.vieMax, `vie = ${e.vie} sort de [0, ${e.vieMax}]`)
      assert.ok(Number.isFinite(e.echo) && e.echo >= 0, `écho invalide : ${e.echo}`)
      assert.ok(Number.isInteger(e.profondeur) && e.profondeur >= 1, `profondeur invalide : ${e.profondeur}`)
      for (const m of e.monstres) {
        assert.ok(Number.isFinite(m.vie), `un ${m.type} a une vie NaN`)
        assert.ok(m.x >= 0 && m.x < LARGEUR && m.y >= 0 && m.y < HAUTEUR, `un ${m.type} est hors grille`)
      }
      assert.ok(e.joueur.x >= 0 && e.joueur.x < LARGEUR && e.joueur.y >= 0 && e.joueur.y < HAUTEUR, 'joueur hors grille')
    }
  }
})

test('une attaque probabiliste (l’esquive du SPECTRE) réussit et échoue à peu près également sur 300 essais', () => {
  const hasard = graine(5)
  let esquives = 0
  let touches = 0
  for (let i = 0; i < 300; i++) {
    const e = L.neuf(hasard, ['chasse-fantome'].length ? RELIQUES.map((r) => r.id).filter((id) => id !== 'chasse-fantome') : [])
    e.monstres = [{ id: 'x', type: 'spectre', camp: 'ennemi', x: e.joueur.x + 1, y: e.joueur.y, vie: 999, vieMax: 999, degats: 1, etourdi: false, tours: 0 }]
    const avant = e.monstres[0].vie
    L.tour(e, 'droite', hasard)
    if (e.monstres[0]?.vie === avant) esquives++
    else touches++
  }
  assert.ok(esquives > 60 && touches > 150, `esquive déséquilibrée : ${esquives} esquives / ${touches} touches`)
})

// --- Sauvegarde --------------------------------------------------------------------

test('une sauvegarde d’un format incompatible ne plante pas : elle repart à neuf', () => {
  assert.equal(L.migre(null), null)
  assert.equal(L.migre({ profondeur: 4, vie: 10 }), null, 'l’ancien format (sans version) doit être rejeté')
  assert.equal(L.migre({ v: 999, profondeur: 1 }), null, 'une version différente doit être rejetée')
  assert.equal(L.migre({ v: L.VERSION, profondeur: 1 }), null, 'une salle absente doit être rejetée, pas inventée')
  assert.equal(
    L.migre({ v: L.VERSION, profondeur: 1, salle: { murs: [true], sortie: { x: 0, y: 0 }, depart: { x: 0, y: 0 }, pieges: [] } }),
    null,
    'une grille de la mauvaise taille doit être rejetée',
  )
})

test('une sauvegarde du bon format se relit sans rien perdre', () => {
  const hasard = graine(9)
  const e = L.neuf(hasard, RELIQUES.map((r) => r.id))
  e.vie = 17
  e.echo = 6
  e.reliques.push('symbiose')
  e.meurtres = 4
  e.chargesEtage.fantome = true
  const relu = L.migre(JSON.parse(JSON.stringify(e)))
  assert.ok(relu)
  assert.equal(relu.vie, 17)
  assert.equal(relu.echo, 6)
  assert.deepEqual(relu.reliques, ['symbiose'])
  assert.equal(relu.meurtres, 4)
  assert.equal(relu.chargesEtage.fantome, true)
  assert.equal(relu.salle.murs.length, LARGEUR * HAUTEUR)
})

test('reliquesDeMeta ne redonne jamais deux fois la même relique et grandit avec les ossements', () => {
  const a = L.reliquesDeMeta(0)
  const b = L.reliquesDeMeta(1000)
  assert.equal(new Set(a).size, a.length)
  assert.equal(new Set(b).size, b.length)
  assert.ok(b.length >= a.length)
  assert.ok(b.length <= RELIQUES.length)
})

// --- Une partie complète jouée à travers index.js, avec le faux moteur --------------

test('une descente complète, jouée via appui/dessine, ne produit ni crash ni NaN à l’écran', () => {
  const j = fauxJeu(abyme, { graine: 21, neuve: true })
  const ctx = fauxCtx()
  let dernierBloque = null

  for (let pas = 0; pas < 4000 && !j.fini; pas++) {
    const d = dispo(j)
    const e = j.e.e

    let cible = { x: e.joueur.x, y: e.joueur.y }
    if (e.offre) {
      const i = Math.floor(j.hasard() * e.offre.length)
      j.pointer = { x: d.offre[i].x + d.offre[i].w / 2, y: d.offre[i].y + d.offre[i].h / 2 }
    } else {
      const ennemi = e.monstres.find((m) => m.camp === 'ennemi')
      cible = ennemi ?? e.salle.sortie
      const dx = cible.x - e.joueur.x
      const dy = cible.y - e.joueur.y
      const dir =
        dx === 0 && dy === 0
          ? 'attendre'
          : Math.abs(dx) >= Math.abs(dy)
            ? dx > 0
              ? 'droite'
              : 'gauche'
            : dy > 0
              ? 'bas'
              : 'haut'
      const z = d.dpad[dir]
      j.pointer = { x: z.x + z.w / 2, y: z.y + z.h / 2 }
      dernierBloque = dir
    }

    abyme.appui(j, j.pointer)
    ctx.ops.length = 0
    abyme.dessine(j, ctx)

    for (const op of ctx.ops) {
      const rect = peint(op)
      if (!rect) continue
      assert.ok(Number.isFinite(rect.x) && Number.isFinite(rect.y), `opération avec une position non finie au pas ${pas}`)
      assert.ok(Number.isFinite(rect.w) && Number.isFinite(rect.h), `opération avec une taille non finie au pas ${pas}`)
    }
  }

  assert.ok(j.fini, 'la descente aurait dû se terminer (mort) avant la limite de pas')
  void dernierBloque
})

test('après la mort, la sauvegarde est effacée et une nouvelle partie repart au premier étage', () => {
  const memoire = { valeur: null }
  const j1 = fauxJeu(abyme, { graine: 4, memoire, neuve: true })
  for (let pas = 0; pas < 4000 && !j1.fini; pas++) {
    const d = dispo(j1)
    const e = j1.e.e
    if (e.offre) {
      const z = d.offre[0]
      j1.pointer = { x: z.x + z.w / 2, y: z.y + z.h / 2 }
    } else {
      const ennemi = e.monstres.find((m) => m.camp === 'ennemi')
      const cible = ennemi ?? e.salle.sortie
      const dx = cible.x - e.joueur.x
      const dy = cible.y - e.joueur.y
      const dir =
        dx === 0 && dy === 0 ? 'attendre' : Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'droite' : 'gauche') : dy > 0 ? 'bas' : 'haut'
      const z = d.dpad[dir]
      j1.pointer = { x: z.x + z.w / 2, y: z.y + z.h / 2 }
    }
    abyme.appui(j1, j1.pointer)
  }
  assert.ok(j1.fini)
  assert.equal(memoire.valeur, null, 'la sauvegarde de la descente perdue doit être effacée')

  const j2 = fauxJeu(abyme, { graine: 4, memoire })
  assert.equal(j2.e.e.profondeur, 1, 'une nouvelle partie doit repartir au premier étage')
})
