/**
 * Le banc d'équilibrage de l'USINE.
 *
 * Il joue la partie à la place d'un humain, en accéléré, et imprime quand
 * chaque contenu tombe. C'est le seul moyen honnête de vérifier qu'un jeu
 * annoncé « 20 minutes à 10 heures » tient sa promesse : la version précédente
 * livrait huit améliorations sur neuf en deux heures, et sa refonte était
 * arithmétiquement toujours perdante. Personne ne l'avait vu parce que
 * personne n'avait joué dix heures.
 *
 *   node test/usine-banc.mjs [heures]
 */
import { MACHINES, AMELIORATIONS, RECHERCHES } from '../src/long/usine/donnees.js'
import * as L from '../src/long/usine/logique.js'
import { graine } from './faux.js'

const HEURES = Number(process.argv[2] ?? 10)
const PAS = 0.5 // demi-seconde de jeu par tour de boucle
const CLICS = 2 // deux coups de pioche par seconde, tant que ça vaut le coup

const hasard = graine(4242)
const e = L.neuve()
const journal = []
const note = (t, quoi) => journal.push({ t, quoi })

let t = 0
let derniereRefonte = 0

while (t < HEURES * 3600) {
  // Le joueur creuse tant que la main rapporte plus qu'une seconde d'usine.
  const main = L.gainMain(e)
  if (main > Math.max(1, L.production(e)) * 0.5) {
    const gain = main * CLICS * PAS
    e.minerai += gain
    e.total += gain
  }

  L.avance(e, PAS, hasard, {
    trouve: (id) => note(t, `recherche  ${RECHERCHES.find((r) => r.id === id).nom}`),
  })

  // On répare tout de suite : c'est ce que fait quelqu'un qui regarde l'écran.
  for (const p of [...e.pannes]) if (p.reste < 0) L.repare(e, p.i)

  // Une recherche à la fois, la moins chère d'abord.
  while (e.enCours.length < L.placesRecherche(e)) {
    const libre = L.recherchesVisibles(e)
      .filter((r) => !e.enCours.some((c) => c.id === r.id))
      .sort((x, y) => x.cout - y.cout)[0]
    if (!libre || !L.lanceRecherche(e, libre.id)) break
  }

  // Les améliorations d'abord : elles cassent la courbe.
  for (const x of L.ameliorationsVisibles(e)) {
    if (L.acheteAmelioration(e, x.id)) note(t, `amélioration  ${x.nom}`)
  }

  // Puis on embauche si l'usine est sous-dotée, sinon on achète la machine la
  // plus rentable au minerai dépensé.
  if (L.couverture(e) < 0.85 && L.coutOuvrier(e) < e.minerai * 0.3) {
    if (L.embauche(e) && e.ouvriers % 10 === 0) note(t, `ouvriers   ${e.ouvriers}`)
  }

  let meilleur = -1
  let meilleurGain = 0
  for (const i of L.machinesVisibles(e)) {
    const prix = L.cout(e, i)
    if (prix > e.minerai) continue
    const gain = (MACHINES[i].prod * L.multiplicateur(e, i)) / prix
    if (gain > meilleurGain) {
      meilleurGain = gain
      meilleur = i
    }
  }
  if (meilleur >= 0) {
    const neuf = e.n[meilleur] === 0
    L.acheteMachine(e, meilleur)
    if (neuf) note(t, `machine    ${MACHINES[meilleur].nom}`)
  }

  // Refondre dès que ça rapporte au moins 60 % de multiplicateur de plus.
  const gain = L.lingotsSi(e)
  const avant = 1 + e.lingots * 0.25
  if (gain > 0 && (1 + (e.lingots + gain) * 0.25) / avant >= 1.6 && t - derniereRefonte > 900) {
    note(t, `REFONTE    +${gain} lingots  →  ×${((1 + (e.lingots + gain) * 0.25) / avant).toFixed(2)}`)
    L.refond(e)
    derniereRefonte = t
  }

  t += PAS
}

const hms = (s) => `${String(Math.floor(s / 3600)).padStart(2, '0')}h${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}`
for (const l of journal) console.log(`  ${hms(l.t)}  ${l.quoi}`)

console.log(`\n--- après ${HEURES} h ---`)
console.log(`  production   ${L.nombre(L.production(e))} / s`)
console.log(`  extrait      ${L.nombre(e.total)}   (cumulé depuis la dernière refonte)`)
console.log(`  machines     ${e.n.map((v, i) => (v ? `${MACHINES[i].nom.slice(0, 4)}×${v}` : null)).filter(Boolean).join('  ')}`)
console.log(`  ouvriers     ${e.ouvriers}  (couverture ${(L.couverture(e) * 100).toFixed(0)} %)`)
console.log(`  lingots      ${e.lingots}  en ${e.fontes} refonte(s)  →  global ×${(1 + e.lingots * 0.25).toFixed(1)}`)
console.log(`  améliorations ${e.ame.length} / ${AMELIORATIONS.length}`)
console.log(`  recherches   ${e.rech.length} / ${RECHERCHES.length}`)
