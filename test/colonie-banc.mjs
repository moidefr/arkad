/**
 * Le banc d'équilibrage de COLONIE.
 *
 * Deux automates, deux questions différentes :
 *
 *  - GÉRÉ construit ce qui est ouvert et abordable, en gardant toujours plus
 *    de nourriture que le reste (un joueur qui fait attention). Combien de
 *    temps met-il à atteindre chaque palier, et jusqu'où grandit la colonie
 *    en 20 minutes / 2 heures / 10 heures ?
 *
 *  - NÉGLIGÉ construit une fois au départ puis n'y touche plus (un joueur qui
 *    ferme l'onglet). À quel rythme une colonie livrée à elle-même périclite
 *    — c'est la mesure que USINE ne peut pas produire, puisqu'elle ne meurt
 *    jamais.
 *
 *   node test/colonie-banc.mjs [graines]
 */
import { BATIMENTS, PALIERS, FAMINE_SEUIL_ABANDON } from '../src/long/colonie/donnees.js'
import * as L from '../src/long/colonie/logique.js'
import { graine } from './faux.js'

const GRAINES = Number(process.argv[2] ?? 12)
const HEURES_MAX = 10
const PAS = 1

/**
 * GÉRÉ : construit ce qui est ouvert et payable, nourriture d'abord.
 *
 * Une fois un palier ouvert, sa ferme bat le CAMPEMENT en nourriture par
 * poste (voir le commentaire de `FERME` et `GRANDE_FERME` dans donnees.js) :
 * un joueur qui sait compter la préfère, à condition d'avoir de quoi
 * l'outiller — d'où l'ATELIER et la FORGE juste avant, dans la liste.
 *
 * Deux jauges plutôt qu'un budget de postes calculé : un joueur ne compte
 * pas exactement, il regarde si « ça tourne bien » (la couverture) et si
 * « ça commence à être à l'étroit » (la population proche du logement) —
 * un budget arithmétique exact s'est révélé instable au banc, un poste
 * ouvert par une petite avance de population étant aussitôt récupéré par le
 * prochain bâtiment à un seul poste avant qu'un bâtiment à plusieurs postes
 * n'ait sa chance.
 */
function tourGere(e) {
  const priorite = [4, 5, 8, 9, 0, 1, 2, 7, 3, 6, 10]
  for (const i of priorite) {
    if (!L.peutConstruire(e, i)) continue
    const b = BATIMENTS[i]
    if (b.postes > 0 && L.couverture(e) < 0.9) continue
    if (b.logement > 0 && e.population < L.logements(e) * 0.9) continue
    L.construit(e, i)
  }
}

function hms(s) {
  if (s === null || s === undefined) return '—'
  return `${String(Math.floor(s / 3600)).padStart(2, '0')}h${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m${String(Math.floor(s % 60)).padStart(2, '0')}s`
}

// --- Le joueur géré : jusqu'où, et à quel rythme ? -------------------------------

console.log(`COLONIE — banc d'équilibrage (${GRAINES} graine(s), jusqu'à ${HEURES_MAX} h)\n`)
console.log('== colonie gérée : construit ce qui est ouvert et abordable, nourriture d’abord ==\n')
{
  const jalons = [1200, 3600, 2 * 3600, 5 * 3600, 10 * 3600] // 20 min, 1h, 2h, 5h, 10h
  const releves = jalons.map(() => [])
  const paliers1 = []
  let effondrements = 0

  for (let g = 0; g < GRAINES; g++) {
    const hasard = graine(1000 + g)
    const e = L.neuve()
    let jalonSuivant = 0
    for (let t = 0; t <= HEURES_MAX * 3600; t += PAS) {
      if (t % 5 === 0) tourGere(e)
      const ev = L.avance(e, PAS, hasard)
      while (jalonSuivant < jalons.length && t >= jalons[jalonSuivant]) {
        releves[jalonSuivant].push(e.population)
        jalonSuivant++
      }
      if (ev.effondree) {
        effondrements++
        break
      }
    }
    const p1 = (() => {
      const hasard2 = graine(1000 + g)
      const e2 = L.neuve()
      for (let t = 0; t < HEURES_MAX * 3600; t += PAS) {
        if (t % 5 === 0) tourGere(e2)
        L.avance(e2, PAS, hasard2)
        if (e2.population >= PALIERS[1]) return t
      }
      return null
    })()
    paliers1.push(p1)
  }

  jalons.forEach((j, i) => {
    const xs = releves[i]
    if (!xs.length) return console.log(`  à ${hms(j).padEnd(11)} : aucune colonie encore en vie`)
    const moyenne = xs.reduce((s, v) => s + v, 0) / xs.length
    console.log(`  à ${hms(j).padEnd(11)} population moyenne ${moyenne.toFixed(1).padStart(6)}  (min ${Math.min(...xs).toFixed(0)}, max ${Math.max(...xs).toFixed(0)})`)
  })
  console.log(`\n  palier ESSOR (${PALIERS[1]} habitants) atteint en moyenne ${hms(paliers1.filter(Boolean).reduce((s, v) => s + v, 0) / Math.max(1, paliers1.filter(Boolean).length))}`)
  console.log(`  colonies effondrées malgré une gestion attentive : ${effondrements} / ${GRAINES}`)
}

// --- Le joueur négligé : à quel rythme périclite-t-il ? --------------------------

console.log('\n== colonie négligée : quelques bâtiments au départ, puis plus rien ==\n')
for (const [nom, depart] of [
  ['minimaliste (1 campement, 1 hutte)', (e) => ((e.n[0] = 1), (e.n[3] = 1))],
  ['modeste (2 campements, 1 bûcheron, 2 huttes)', (e) => ((e.n[0] = 2), (e.n[1] = 1), (e.n[3] = 2))],
]) {
  const releves = []
  for (let g = 0; g < GRAINES; g++) {
    const hasard = graine(2000 + g)
    const e = L.neuve()
    depart(e)
    let t = 0
    let abandons = 0
    for (; t <= HEURES_MAX * 3600; t += PAS) {
      const ev = L.avance(e, PAS, hasard)
      if (ev.abandon !== undefined) abandons++
      if (ev.effondree) break
    }
    releves.push({ t, abandons, effondree: t < HEURES_MAX * 3600, picPop: e.pic })
  }

  console.log(`  -- ${nom} --`)
  const effondrees = releves.filter((r) => r.effondree)
  const survivent = releves.filter((r) => !r.effondree)
  console.log(`  s'éteignent avant ${HEURES_MAX} h : ${effondrees.length} / ${GRAINES}`)
  if (effondrees.length) {
    const delai = effondrees.map((r) => r.t).sort((a, b) => a - b)
    console.log(`    délai d'extinction : médian ${hms(delai[Math.floor(delai.length / 2)])}, le plus rapide ${hms(delai[0])}, le plus lent ${hms(delai[delai.length - 1])}`)
    const abandonsAvant = effondrees.map((r) => r.abandons)
    console.log(`    bâtiments abandonnés avant l'extinction : ${(abandonsAvant.reduce((s, v) => s + v, 0) / abandonsAvant.length).toFixed(1)} en moyenne`)
  }
  if (survivent.length) {
    const pics = survivent.map((r) => r.picPop)
    console.log(`  survivent en stagnant : ${survivent.length} / ${GRAINES}, pic de population moyen ${(pics.reduce((s, v) => s + v, 0) / pics.length).toFixed(1)}`)
  }
}

// --- Une coupure de nourriture, pas une négligence totale ------------------------

console.log("\n== une colonie saine dont les fermes s'arrêtent un moment (bâtiments coupés, pas seulement le stock) ==\n")
{
  for (const duree of [30, 60, 120, 300, 600]) {
    const hasard = graine(3000 + duree)
    const e = L.neuve()
    e.n[0] = 4
    e.n[1] = 2
    e.n[2] = 2
    e.n[3] = 3
    for (let t = 0; t < 900; t += PAS) L.avance(e, PAS, hasard) // stabilise d'abord
    const populationAvant = e.population
    const campements = e.n[0]
    e.n[0] = 0 // les campements s'arrêtent : plus aucune entrée de nourriture
    let abandon = false
    for (let t = 0; t < duree; t += PAS) {
      const ev = L.avance(e, PAS, hasard)
      if (ev.abandon !== undefined) abandon = true
    }
    e.n[0] = campements // les fermes reprennent
    console.log(
      `  coupure de ${String(duree).padStart(3)} s : population ${populationAvant.toFixed(1)} → ${e.population.toFixed(1)}` +
        (abandon ? '  · un bâtiment abandonné' : `  · pas d'abandon (seuil à ${FAMINE_SEUIL_ABANDON} s)`),
    )
  }
}

console.log('\n== bâtiments : coût de départ et rapport production/coût ==\n')
for (let i = 0; i < BATIMENTS.length; i++) {
  const b = BATIMENTS[i]
  const c = Object.entries(b.coutBase)
    .map(([r, v]) => `${v} ${r}`)
    .join(' + ')
  const rend = Object.entries(b.produit)
    .map(([r, v]) => `${v}/s ${r}`)
    .join(', ')
  const cons = Object.keys(b.consomme).length
    ? ` (consomme ${Object.entries(b.consomme)
        .map(([r, v]) => `${v}/s ${r}`)
        .join(', ')})`
    : ''
  console.log(`  P${b.palier}  ${b.nom.padEnd(20)} coût ${c.padEnd(22)} → ${rend || '(logement +' + b.logement + ')'}${cons}`)
}
