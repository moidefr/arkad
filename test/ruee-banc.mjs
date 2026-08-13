/**
 * Le banc de RUÉE : il franchit chaque motif et chaque niveau, et imprime ce
 * qu'aucun test ne dit — **de combien** on peut se tromper.
 *
 *   node test/ruee-banc.mjs
 *
 * Le test, lui, se contente d'un seuil. Ici on veut le détail, parce que
 * régler un niveau c'est déplacer des marges : un passage à deux images est
 * dur, un passage à cinq est confortable, et c'est cette colonne-là qu'on lit
 * quand un niveau « ne va pas » sans qu'on sache dire pourquoi.
 */
import { resout, marge } from './ruee-solveur.mjs'
import { MOTIFS, NIVEAUX, NIVEAU_PAR_ID, repos } from '../src/long/ruee/donnees.js'
import { CASE, VITESSE } from '../src/long/ruee/logique.js'

const barre = (n, sur = 6) => '█'.repeat(Math.max(0, n)) + '·'.repeat(Math.max(0, sur - n))

console.log('\nMOTIFS — chacun seul, entouré de repos\n')
console.log('  motif        véhicule   marge   verdict')
let pires = []
for (const m of MOTIFS) {
  const suite =
    m.mode === 'vaisseau' ? [repos(4), 'volEntree', 'volPlat', m.id, 'volPlat', repos(4)] : [repos(6), m.id, repos(6)]
  const essai = { id: '_banc', nom: 'banc', bande: 'ruee1', vitesse: 1, suite }
  NIVEAUX.push(essai)
  NIVEAU_PAR_ID['_banc'] = essai
  const r = resout('_banc', { budget: 300000 })
  const mg = r.gagne ? marge('_banc', r.appuis) : 0
  NIVEAUX.pop()
  delete NIVEAU_PAR_ID['_banc']
  if (r.gagne) pires.push({ id: m.id, mg })
  console.log(
    `  ${m.id.padEnd(12)} ${m.mode.padEnd(10)} ${barre(mg)}  ${
      r.gagne ? (mg <= 2 ? 'serré' : 'ok') : `INFRANCHISSABLE (${(r.avance * 100).toFixed(0)} %)`
    }`,
  )
}

pires.sort((a, b) => a.mg - b.mg)
console.log(
  `\n  les plus serrés : ${pires
    .slice(0, 4)
    .map((p) => `${p.id} (${p.mg})`)
    .join(' · ')}`,
)

console.log('\nNIVEAUX\n')
console.log('  niveau       durée   cases   marge   états')
for (const n of NIVEAUX) {
  const r = resout(n.id, { budget: 2000000 })
  const mg = r.gagne ? marge(n.id, r.appuis) : 0
  // La durée est celle d'une course parfaite : c'est aussi le temps que dure
  // la bande-son avant de reboucler, donc les deux doivent se ressembler.
  const cases = r.gagne ? Math.round((r.appuis.length * 4) / 240 / (CASE / (VITESSE * (n.vitesse ?? 1)))) : 0
  const duree = r.gagne ? ((r.appuis.length * 4) / 240).toFixed(1) + ' s' : '—'
  console.log(
    `  ${n.id.padEnd(12)} ${duree.padStart(6)}  ${String(cases).padStart(5)}   ${barre(mg)}  ${String(r.etats).padStart(7)}` +
      (r.gagne ? '' : `   BLOQUÉ à ${(r.avance * 100).toFixed(0)} %`),
  )
}
console.log()
