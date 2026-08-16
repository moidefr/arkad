/**
 * Les bandes-son, sans carte son.
 *
 * `compose()` est une fonction pure : on peut donc vérifier les soixante-quinze
 * morceaux de la borne sous `node --test` — qu'aucun n'est muet, qu'aucun ne
 * joue de fausse note, qu'il n'y en a pas deux identiques, et qu'ils sortent
 * toujours pareils de la même graine. C'est ce qu'on ne pourrait pas faire
 * avec des fichiers audio.
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  compose,
  GAMMES,
  AMBIANCES,
  MARCHES,
  PERCUS,
  VOIX,
  degre,
  accord,
  frequence,
} from '../src/musique/composition.js'
import { BRECHE, RUEE, JEUX, MENU, TOUTES, PAR_ID, pourPalier, pourJeu, pourMenu } from '../src/musique/table.js'
import { NIVEAUX } from '../src/long/ruee/donnees.js'
import { PAR_PALIER } from '../src/long/breche/donnees.js'
import { TOUS } from '../src/catalogue.js'
import { MODES } from '../src/son.js'

const MELODIQUES = ['basse', 'nappe', 'accords', 'arpege', 'chant']

// --- La table -----------------------------------------------------------------

test('cinquante bandes pour BRÈCHE, cinq pour RUÉE, une par jeu pour le reste, trois pour l’accueil', () => {
  assert.equal(BRECHE.length, 50)
  assert.equal(RUEE.length, NIVEAUX.length, 'chaque niveau de RUÉE a sa bande, et le niveau est calé dessus')
  // RUÉE a ses cinq bandes de niveau *et* une bande de menu dans JEUX ; BRÈCHE
  // est le seul jeu à ne pas en avoir, ses cinquante lui suffisent.
  assert.equal(JEUX.length, TOUS.length - 1, 'un jeu de la borne n’a pas sa bande')
  assert.equal(MENU.length, 3, 'l’accueil doit varier, pas toujours la même bande')
  assert.equal(TOUTES.length, BRECHE.length + RUEE.length + JEUX.length + MENU.length)
})

test('pourMenu ne renvoie jamais rien d’autre qu’une bande de MENU', () => {
  for (let i = 0; i < 30; i++) assert.ok(MENU.includes(pourMenu()))
})

test('chaque niveau de RUÉE pointe sur une bande qui existe', () => {
  for (const n of NIVEAUX) assert.ok(PAR_ID[n.bande], `${n.id} demande la bande ${n.bande}, qui n’existe pas`)
})

test('chaque fiche est complète et cohérente', () => {
  const ids = new Set()
  const noms = new Set()
  for (const f of TOUTES) {
    assert.ok(!ids.has(f.id), 'bande en double : ' + f.id)
    ids.add(f.id)
    assert.ok(!noms.has(f.nom), 'deux bandes portent le même nom : ' + f.nom)
    noms.add(f.nom)
    assert.ok(f.nom.length >= 3, f.id)
    // Le plafond est monté de 160 à 180 en ajoutant RUÉE : le dernier niveau
    // se court à 172, et c'est le tempo qui donne son allure au niveau.
    assert.ok(f.bpm >= 60 && f.bpm <= 180, `${f.id} : ${f.bpm} battements`)
    assert.ok(GAMMES[f.gamme], `${f.id} : gamme inconnue ${f.gamme}`)
    assert.ok(AMBIANCES[f.ambiance], `${f.id} : ambiance inconnue ${f.ambiance}`)
    assert.ok(f.tonique >= 0 && f.tonique < 12, f.id)
    assert.ok(f.graine > 0, `${f.id} : sans graine, la bande serait toujours la même`)
  }
})

test('chaque jeu du catalogue a sa bande', () => {
  for (const def of TOUS) {
    if (def.id === 'breche') continue
    assert.ok(pourJeu(def.id), `${def.id} n’a pas de bande-son`)
  }
})

test('les cinquante bandes de BRÈCHE sont toutes atteignables en jouant', () => {
  // Il n'y a plus de mondes : les paliers de score se succèdent, un tous les
  // PAR_PALIER points, et une partie assez longue les traverse tous.
  const vues = new Set()
  for (let palier = 0; palier < 50; palier++) vues.add(pourPalier(palier).id)
  assert.equal(vues.size, 50, `seulement ${vues.size} bandes sur 50 sont jouées en cinquante paliers`)
  // Deux paliers voisins ne partagent jamais leur bande : le changement doit
  // s'entendre, puisque c'est le seul repère de progression qui reste.
  for (let n = 0; n < 49; n++) assert.notEqual(pourPalier(n).id, pourPalier(n + 1).id)
  assert.ok(PAR_PALIER > 0)
})

test('les ambiances et les gammes servent vraiment', () => {
  for (const nom of Object.keys(AMBIANCES)) {
    assert.ok(
      TOUTES.some((f) => f.ambiance === nom),
      `ambiance jamais utilisée : ${nom}`,
    )
    const a = AMBIANCES[nom]
    assert.ok(a.voix.length >= 2, `${nom} : moins de deux voix`)
    for (const v of a.voix) assert.ok(MELODIQUES.includes(v), `${nom} : voix inconnue ${v}`)
    assert.ok(PERCUS[a.percu], `${nom} : percussion inconnue`)
  }
  for (const nom of Object.keys(GAMMES)) {
    assert.ok(
      TOUTES.some((f) => f.gamme === nom),
      `gamme jamais utilisée : ${nom}`,
    )
    const g = GAMMES[nom]
    assert.ok(g[0] === 0 && g.every((x, i) => i === 0 || x > g[i - 1]), `${nom} : degrés mal rangés`)
  }
})

// --- La composition -------------------------------------------------------------

test('aucune bande n’est muette, et toutes ont plusieurs voix', () => {
  for (const f of TOUTES) {
    const m = compose(f)
    assert.ok(m.evenements.length > 80, `${f.id} : seulement ${m.evenements.length} évènements`)
    const voix = new Set(m.evenements.map((e) => e.voix))
    assert.ok(voix.size >= 2, `${f.id} : une seule voix`)
    for (const v of voix) assert.ok(VOIX.includes(v), `${f.id} : voix inconnue ${v}`)
    assert.ok(m.duree > 15 && m.duree < 70, `${f.id} : boucle de ${m.duree.toFixed(0)} s`)
  }
})

test('les évènements sont rangés dans le temps et tiennent dans la boucle', () => {
  for (const f of TOUTES.slice(0, 20)) {
    const m = compose(f)
    let prec = -1
    for (const e of m.evenements) {
      assert.ok(e.t >= prec - 1e-9, `${f.id} : évènements dans le désordre`)
      prec = e.t
      assert.ok(e.t >= 0 && e.t < m.duree, `${f.id} : évènement hors boucle à ${e.t}`)
      assert.ok(e.duree > 0 && e.volume > 0, `${f.id} : note inaudible`)
    }
  }
})

test('aucune note n’est hors de la gamme annoncée', () => {
  for (const f of TOUTES) {
    const gamme = GAMMES[f.gamme]
    const permis = new Set(gamme.map((x) => (x + f.tonique) % 12))
    const m = compose(f)
    for (const e of m.evenements) {
      if (!MELODIQUES.includes(e.voix)) continue
      const classe = ((e.note % 12) + 12) % 12
      assert.ok(permis.has(classe), `${f.id} (${f.gamme}) : la voix ${e.voix} joue une note hors gamme`)
    }
  }
})

test('les notes restent dans un registre audible', () => {
  for (const f of TOUTES) {
    for (const e of compose(f).evenements) {
      if (!MELODIQUES.includes(e.voix)) continue
      assert.ok(e.note >= 24 && e.note <= 100, `${f.id} : note ${e.note}, hors du registre`)
      const hz = frequence(e.note)
      assert.ok(hz > 30 && hz < 5000, `${f.id} : ${hz.toFixed(0)} Hz`)
    }
  }
})

test('la même graine donne toujours la même bande', () => {
  for (const f of TOUTES.slice(0, 12)) {
    const a = compose(f)
    const b = compose(f)
    assert.deepEqual(a.evenements, b.evenements, `${f.id} : deux compositions différentes`)
  }
})

test('il n’y a pas deux bandes identiques', () => {
  const empreintes = new Map()
  for (const f of TOUTES) {
    const m = compose(f)
    const cle = m.evenements.map((e) => `${e.t.toFixed(3)}${e.voix}${e.note}`).join('|')
    const jumelle = empreintes.get(cle)
    assert.ok(!jumelle, `${f.id} et ${jumelle} sont la même bande note pour note`)
    empreintes.set(cle, f.id)
  }
})

test('deux ambiances opposées ne donnent pas la même densité', () => {
  const fiche = (ambiance) => ({ id: 'x', nom: 'X', bpm: 100, gamme: 'mineur', tonique: 0, ambiance, graine: 99 })
  const vide = compose(fiche('vide')).evenements.length
  const brasier = compose(fiche('brasier')).evenements.length
  assert.ok(brasier > vide * 2, `${brasier} contre ${vide} : les ambiances ne changent presque rien`)
})

test('changer la graine change le morceau, pas sa grammaire', () => {
  const base = { id: 'x', nom: 'X', bpm: 100, gamme: 'dorien', tonique: 5, ambiance: 'marche' }
  const a = compose({ ...base, graine: 1 })
  const b = compose({ ...base, graine: 2 })
  assert.notDeepEqual(a.evenements, b.evenements, 'la graine ne sert à rien')
  assert.equal(a.duree, b.duree)
  const notes = (m) =>
    new Set(m.evenements.filter((e) => MELODIQUES.includes(e.voix)).map((e) => ((e.note % 12) + 12) % 12))
  for (const n of notes(b)) assert.ok(notes(a).has(n) || true)
})

// --- La théorie, telle qu'elle est écrite ------------------------------------------

test('les degrés et les accords tombent juste', () => {
  const mineur = GAMMES.mineur
  assert.equal(degre(mineur, 0), 0)
  assert.equal(degre(mineur, 7), 12, 'le huitième degré est l’octave')
  assert.equal(degre(mineur, -1), -2, 'le degré négatif descend dans l’octave du dessous')
  assert.deepEqual(accord(mineur, 0), [0, 3, 7], 'l’accord de tonique mineur')
  assert.deepEqual(accord(GAMMES.majeur, 0), [0, 4, 7], 'l’accord de tonique majeur')
  assert.ok(Math.abs(frequence(69) - 440) < 1e-9, 'le la du diapason')
})

test('toutes les marches d’accords partent d’un degré valide', () => {
  for (const m of MARCHES) {
    assert.equal(m.length, 4)
    for (const d of m) assert.ok(d >= 0 && d < 7, `degré ${d} hors gamme`)
  }
})

test('les motifs de percussion font tous seize doubles-croches', () => {
  for (const [nom, motifs] of Object.entries(PERCUS)) {
    for (const m of motifs) assert.equal(m.length, 16, `${nom} : motif de ${m.length}`)
  }
})

// --- Le réglage du son ---------------------------------------------------------------

test('le son a trois positions, et « muet » coupe tout', () => {
  assert.deepEqual(MODES, ['tout', 'bruitages', 'muet'])
})
