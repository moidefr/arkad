/**
 * Le banc d'équilibrage d'EXPÉDITION.
 *
 * Contrairement à `usine-banc.mjs`, ce n'est pas une seule longue partie
 * qu'on regarde avancer : c'est une partie complète, courte, qu'on rejoue en
 * Monte-Carlo. Trois automates (prudent / agressif / équilibré) jouent
 * chacun `n` parties, et le banc imprime le taux de réussite, le nombre
 * médian de jours, la cause de mort dominante et l'état de santé moyen à
 * l'arrivée — de quoi juger si un taux de mort est de 5 % ou de 80 % sans le
 * deviner.
 *
 *   node test/expedition-banc.mjs [parties]
 */
import { ETAPES, JAUGES, OBJETS, FATIGUE_SEUIL } from '../src/long/expedition/donnees.js'
import * as L from '../src/long/expedition/logique.js'
import { graine } from './faux.js'

const PARTIES = Number(process.argv[2] ?? 1000)

/**
 * Un automate qui ignore la `chance` d'une option (ne compte que son effet
 * garanti) la sous-estime systématiquement — et un joueur réel ne joue pas
 * ainsi. `note` compte l'espérance, et pèse chaque jauge davantage quand
 * elle est basse : un joueur raisonnable protège ce qui manque déjà.
 */
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

const bots = {
  prudent: (h, ouvertes) => meilleure(ouvertes, (o) => -o.km * 0.1 + note(h, o) + (o.repos ? 20 : 0) - (o.dur ? 20 : 0)),
  agressif: (h, ouvertes) => meilleure(ouvertes, (o) => o.km * 0.6 + note(h, o) * 0.5),
  equilibre: (h, ouvertes) => meilleure(ouvertes, (o) => o.km * 0.4 + note(h, o) - (o.dur ? 8 : 0) + (o.repos ? 8 : 0)),
}

function routeDe(nom, h) {
  if (nom === 'prudent') return 'sur'
  if (nom === 'agressif') return 'risque'
  return h.fatigue >= FATIGUE_SEUIL || JAUGES.some((g) => h[g.cle] < 30) ? 'sur' : 'risque'
}

function joue(nom, hasard) {
  const h = L.neuf()
  let causeMort = ''
  for (let jour = 0; jour < 3000; jour++) {
    const journee = L.tire(h, hasard)
    const ouvertes = L.optionsDe(journee).filter((o) => L.ouverte(h, o))
    const o = journee.embranchement ? ouvertes.find((x) => x.route === routeDe(nom, h)) : bots[nom](h, ouvertes)
    const ev = L.avancer(h, o, hasard)
    if (ev.mal) causeMort = ev.mal
    if (ev.arrive) return { fini: 'arrive', jours: h.jour, sante: h.sante, h }
    if (ev.mort) return { fini: 'mort', jours: h.jour, cause: causeMort || 'santé à zéro', h }
  }
  return { fini: 'bloque', jours: h.jour, h }
}

function mediane(xs) {
  const t = [...xs].sort((a, b) => a - b)
  return t[Math.floor(t.length / 2)] ?? 0
}

console.log(`${PARTIES} parties par automate\n`)

for (const nom of Object.keys(bots)) {
  const hasard = graine(nom.length * 1000 + 7)
  const resultats = []
  for (let i = 0; i < PARTIES; i++) resultats.push(joue(nom, hasard))

  const arrives = resultats.filter((r) => r.fini === 'arrive')
  const morts = resultats.filter((r) => r.fini === 'mort')
  const bloques = resultats.filter((r) => r.fini === 'bloque')
  const jours = mediane(resultats.map((r) => r.jours))
  const santeArrivee = arrives.length ? arrives.reduce((s, r) => s + r.sante, 0) / arrives.length : 0

  const causes = {}
  for (const r of morts) causes[r.cause] = (causes[r.cause] ?? 0) + 1
  const causePrincipale = Object.entries(causes).sort((a, b) => b[1] - a[1])[0]

  console.log(`  ${nom.padEnd(10)} réussite ${((arrives.length / PARTIES) * 100).toFixed(1).padStart(5)} % · ` +
    `mort ${((morts.length / PARTIES) * 100).toFixed(1).padStart(5)} % · ` +
    `${jours} jours (médiane) · santé moyenne à l’arrivée ${santeArrivee.toFixed(0)}` +
    (bloques.length ? ` · ⚠ ${bloques.length} partie(s) bloquée(s) à 3000 jours` : '') +
    (causePrincipale ? ` · cause de mort dominante : ${causePrincipale[0]} (${causePrincipale[1]})` : ''))
}

// --- Les objets-clés : à quel jour arrivent-ils, pour un automate qui les cherche ? ---

console.log('\n  objets-clés — jour d’obtention (automate équilibré qui les saisit dès qu’ils sont offerts) —')
{
  const hasard = graine(999)
  const jours = { corde: [], carte: [], remede: [] }
  for (let i = 0; i < 300; i++) {
    const h = L.neuf()
    for (let jour = 0; jour < 40 && L.etapeIndexDe(h) === 0; jour++) {
      const journee = L.tire(h, hasard)
      const ouvertes = L.optionsDe(journee).filter((o) => L.ouverte(h, o))
      const preneur = ouvertes.find((o) => o.objet)
      const o = preneur ?? bots.equilibre(h, ouvertes)
      L.avancer(h, o, hasard)
      if (o.objet) jours[o.objet].push(h.jour)
    }
  }
  for (const [id, js] of Object.entries(jours)) {
    console.log(
      `    ${OBJETS[id].padEnd(8)} obtenu dans ${js.length}/300 parties, jour médian ${mediane(js) || '—'}`,
    )
  }
}

// --- Les frontières et la fatigue --------------------------------------------------

console.log('\n  frontières (km) —')
for (let i = 0; i < ETAPES.length; i++) console.log(`    ${ETAPES[i].nom.padEnd(12)} jusqu’à ${ETAPES[i].jusqu} km`)
