/**
 * EXPÉDITION : la résolution d'une journée, en pur calcul, sans canvas.
 *
 * L'ancienne version n'avait ni test ni banc — personne ne savait si un taux
 * de mort avant l'arrivée était de 5 % ou de 80 %, ni si une stratégie
 * « toujours prudent » dominait trivialement. Ces tests mesurent
 * exactement ça, avec de vrais automates plutôt que des suppositions.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ETAPES, URGENCES, EMBRANCHEMENT, JAUGES, OBJETS, FATIGUE_SEUIL } from '../src/long/expedition/donnees.js'
import * as L from '../src/long/expedition/logique.js'
import { graine } from './faux.js'

// --- Données -----------------------------------------------------------------------

test('aucune journée n’est un cul-de-sac : une option reste toujours accessible sans objet', () => {
  const tous = [...ETAPES.flatMap((e) => e.journees), ...URGENCES, EMBRANCHEMENT]
  for (const j of tous) {
    const libres = L.optionsDe(j).filter((o) => !o.exige)
    assert.ok(libres.length > 0, `« ${j.texte ?? j.a?.l} » n’a que des options qui exigent un objet`)
  }
})

test('les trois objets-clés sont chacun accordés par au moins une journée de LA PLAINE', () => {
  const plaine = ETAPES[0].journees
  for (const id of Object.keys(OBJETS)) {
    const porteurs = plaine.filter((j) => L.optionsDe(j).some((o) => o.objet === id))
    assert.ok(porteurs.length > 0, `rien ne donne ${id}`)
    assert.ok(
      porteurs.some((j) => j.beat === id),
      `${id} n’a pas de journée-balise garantie (beat)`,
    )
  }
})

test('chaque pool d’étape est assez large pour ne pas se répéter à chaque traversée', () => {
  for (const e of ETAPES) assert.ok(e.journees.length >= 12, `${e.nom} n’a que ${e.journees.length} journées`)
})

// --- Résolution pure -----------------------------------------------------------------

test('mille journées résolues au hasard ne produisent ni NaN ni jauge hors de [0, 100]', () => {
  const hasard = graine(7)
  const h = L.neuf()
  for (let i = 0; i < 1000; i++) {
    if (h.km >= L.arriveeDe(h)) break
    const journee = L.tire(h, hasard)
    const ouvertes = L.optionsDe(journee).filter((o) => L.ouverte(h, o))
    const o = ouvertes[Math.floor(hasard() * ouvertes.length)]
    const ev = L.avancer(h, o, hasard)
    for (const g of JAUGES) {
      assert.ok(Number.isFinite(h[g.cle]), `${g.cle} devient NaN au jour ${h.jour}`)
      assert.ok(h[g.cle] >= 0 && h[g.cle] <= 100, `${g.cle} = ${h[g.cle]} sort de [0, 100] au jour ${h.jour}`)
    }
    assert.ok(Number.isFinite(h.km) && h.km >= 0, `km devient invalide au jour ${h.jour}`)
    assert.ok(h.fatigue >= 0 && h.fatigue <= 4, `fatigue = ${h.fatigue} sort de sa plage`)
    if (ev.mort || ev.arrive) break
  }
})

test('une option probabiliste à 50 % réussit et échoue à peu près également sur 200 essais', () => {
  const hasard = graine(1)
  const o = { l: 't', km: 5, vivres: 0, chance: { p: 0.5, vivres: 30 }, sinon: { vivres: -30 } }
  let succes = 0
  let echecs = 0
  for (let i = 0; i < 200; i++) {
    const ev = L.avancer({ ...L.neuf(), vivres: 50 }, o, hasard)
    if (ev.succes) succes++
    else echecs++
  }
  assert.ok(succes > 70 && echecs > 70, `une tentative à 50 % ne devrait pas être unilatérale (${succes}/${echecs})`)
})

// --- Sauvegarde ------------------------------------------------------------------

test('une sauvegarde d’un format incompatible ne plante pas : elle repart à neuf', () => {
  assert.equal(L.migre(null), null)
  assert.equal(L.migre({ jour: 4, km: 120, vivres: 40 }), null, 'l’ancien format (sans version) doit être rejeté')
  assert.equal(L.migre({ v: 1, km: 10 }), null, 'une version différente doit être rejetée')
})

test('une sauvegarde du bon format se relit sans rien perdre', () => {
  const h = L.neuf()
  h.km = 340
  h.sac.push('corde')
  h.obtenus.push('corde')
  h.fatigue = 2
  h.embranchements[1] = 'sur'
  const relu = L.migre(JSON.parse(JSON.stringify(h)))
  assert.equal(relu.km, 340)
  assert.deepEqual(relu.sac, ['corde'])
  assert.equal(relu.fatigue, 2)
  assert.equal(relu.embranchements[1], 'sur')
})

// --- Embranchements et frontières -----------------------------------------------

test('la route choisie décale la frontière lointaine de l’étape qu’on vient d’entamer', () => {
  const sur = L.neuf()
  sur.embranchements[1] = 'sur'
  const risque = L.neuf()
  risque.embranchements[1] = 'risque'
  const neutre = L.neuf()
  assert.ok(L.limiteDe(sur, 1) > L.limiteDe(neutre, 1))
  assert.ok(L.limiteDe(risque, 1) < L.limiteDe(neutre, 1))
})

test('franchir une frontière met un embranchement en attente, et rien d’autre ne se tire avant qu’il soit choisi', () => {
  const hasard = graine(2)
  const h = L.neuf()
  h.km = ETAPES[0].jusqu - 5
  const o = { l: 't', km: 10, vivres: 0, eau: 0, sante: 0 }
  const ev = L.avancer(h, o, hasard)
  assert.ok(ev.etapeChangee)
  assert.equal(h.enAttente, 1)
  const journee = L.tire(h, hasard)
  assert.ok(journee.embranchement)
})

// --- Automates : mesure de l'équilibre, pas de suppositions ----------------------

const bots = {
  prudent: (h, ouvertes) => meilleure(ouvertes, (o) => -o.km * 0.1 + note(h, o) + (o.repos ? 20 : 0) - (o.dur ? 20 : 0)),
  agressif: (h, ouvertes) => meilleure(ouvertes, (o) => o.km * 0.6 + note(h, o) * 0.5),
  equilibre: (h, ouvertes) => meilleure(ouvertes, (o) => o.km * 0.4 + note(h, o) - (o.dur ? 8 : 0) + (o.repos ? 8 : 0)),
}

// Un automate qui ignore la `chance` d'une option la sous-estime — un joueur
// réel ne joue pas ainsi. `note` compte l'espérance, et pèse chaque jauge
// davantage quand elle est basse, comme un joueur qui protège ce qui manque.
function note(h, o) {
  let s = 0
  for (const g of JAUGES) {
    let delta = o[g.cle] ?? 0
    if (o.chance) delta += o.chance.p * (o.chance[g.cle] ?? 0) + (1 - o.chance.p) * (o.sinon?.[g.cle] ?? 0)
    const poids = h[g.cle] < 30 ? 3 : h[g.cle] < 55 ? 1.4 : 0.6
    s += delta * poids
  }
  return s
}

function meilleure(options, score) {
  let choix = options[0]
  let meilleur = -Infinity
  for (const o of options) {
    const s = score(o)
    if (s > meilleur) {
      meilleur = s
      choix = o
    }
  }
  return choix
}

function routeDe(nom, h) {
  if (nom === 'prudent') return 'sur'
  if (nom === 'agressif') return 'risque'
  return h.fatigue >= FATIGUE_SEUIL || JAUGES.some((g) => h[g.cle] < 30) ? 'sur' : 'risque'
}

function joue(nom, hasard) {
  const h = L.neuf()
  for (let jour = 0; jour < 3000; jour++) {
    const journee = L.tire(h, hasard)
    const ouvertes = L.optionsDe(journee).filter((o) => L.ouverte(h, o))
    const o = journee.embranchement
      ? ouvertes.find((x) => x.route === routeDe(nom, h))
      : bots[nom](h, ouvertes)
    const ev = L.avancer(h, o, hasard)
    if (ev.arrive) return { fini: 'arrive', jours: h.jour }
    if (ev.mort) return { fini: 'mort', jours: h.jour }
  }
  return { fini: 'bloque', jours: h.jour }
}

test('la stratégie « toujours prudent » n’atteint pas une réussite triviale', () => {
  const hasard = graine(11)
  let reussites = 0
  const PARTIES = 1000
  for (let i = 0; i < PARTIES; i++) if (joue('prudent', hasard).fini === 'arrive') reussites++
  assert.ok(reussites / PARTIES < 0.9, `prudent réussit ${reussites}/${PARTIES}, c’est trop dominant`)
})

test('au moins deux stratégies restent viables : ni ~0 %, ni ~100 % de réussite', () => {
  const hasard = graine(13)
  const PARTIES = 400
  const taux = {}
  for (const nom of Object.keys(bots)) {
    let reussites = 0
    for (let i = 0; i < PARTIES; i++) if (joue(nom, hasard).fini === 'arrive') reussites++
    taux[nom] = reussites / PARTIES
  }
  const viables = Object.values(taux).filter((t) => t > 0.05 && t < 0.95)
  assert.ok(viables.length >= 2, `taux de réussite : ${JSON.stringify(taux)}`)
})

test('un automate qui saisit les objets-clés les obtient presque toujours, bien avant d’en avoir besoin', () => {
  const hasard = graine(17)
  const PARTIES = 300
  const obtenus = { corde: 0, carte: 0, remede: 0 }
  for (let i = 0; i < PARTIES; i++) {
    const h = L.neuf()
    for (let jour = 0; jour < 3000 && h.km < L.arriveeDe(h) && h.sante > 0; jour++) {
      const journee = L.tire(h, hasard)
      const ouvertes = L.optionsDe(journee).filter((o) => L.ouverte(h, o))
      const preneur = ouvertes.find((o) => o.objet)
      const o = journee.embranchement
        ? ouvertes.find((x) => x.route === routeDe('equilibre', h))
        : (preneur ?? bots.equilibre(h, ouvertes))
      L.avancer(h, o, hasard)
      if (L.etapeIndexDe(h) > 0) break // les trois objets viennent tous de LA PLAINE
    }
    for (const id of Object.keys(obtenus)) if (h.obtenus.includes(id)) obtenus[id]++
  }
  for (const [id, n] of Object.entries(obtenus)) {
    assert.ok(n / PARTIES > 0.9, `${id} obtenu seulement ${n}/${PARTIES} fois par un automate qui les cherche`)
  }
})
