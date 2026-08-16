/**
 * Le banc d'équilibrage du VIVIER.
 *
 * VIVIER ne connaît ni victoire ni défaite : rien à mesurer côté survie. Ce
 * qui compte, c'est le rythme — combien de temps (simulé) faut-il pour
 * compléter la moitié, puis la quasi-totalité, de la collection, selon qu'on
 * nourrit régulièrement ou qu'on laisse le bassin tourner sans y toucher —
 * et si les 108 combinaisons sont vraiment toutes atteignables, ou si
 * certaines sont piégées derrière une combinaison d'allèles que le pool de
 * fondatrices ne peut jamais produire.
 *
 *   node test/vivier-banc.mjs [heures]
 */
import * as L from '../src/long/vivier/logique.js'
import { CAPACITE, NOURRITURE_MAX } from '../src/long/vivier/donnees.js'
import { graine } from './faux.js'

const HEURES = Number(process.argv[2] ?? 300)
const PAS = 30 // secondes de jeu simulées par tour de boucle

const PALIERS = [0.25, 0.5, 0.8, 1]

function simuler(heures, actif, seed) {
  const hasard = graine(seed)
  const e = L.neuf()
  const atteint = {}
  let t = 0
  while (t < heures * 3600) {
    // Un joueur actif nourrit environ toutes les deux minutes de jeu : un
    // geste régulier mais jamais pressé.
    if (actif && Math.floor(t / 120) !== Math.floor((t - PAS) / 120)) L.nourrir(e)
    L.avance(e, PAS, hasard)
    t += PAS
    const frac = e.decouvertes.length / L.TOTAL_COMBOS
    for (const p of PALIERS) if (frac >= p && atteint[p] === undefined) atteint[p] = t / 3600
  }
  return { e, atteint }
}

console.log(`VIVIER — banc d'équilibrage (${HEURES} h simulées)\n`)

for (const [nom, actif] of [
  ['actif   (nourrit toutes les ~2 min)', true],
  ['passif  (laisse tourner, ne nourrit jamais)', false],
]) {
  const { e, atteint } = simuler(HEURES, actif, nom.length * 97 + 3)
  console.log(`  ${nom}`)
  console.log(`    ${e.decouvertes.length} / ${L.TOTAL_COMBOS} découvertes · ${e.naissances} naissances au total`)
  for (const p of PALIERS) {
    const dit = atteint[p] !== undefined ? `${atteint[p].toFixed(1)} h` : `jamais en ${HEURES} h`
    console.log(`      ${(p * 100).toFixed(0).padStart(3)} % de la collection : ${dit}`)
  }
  console.log()
}

// --- Atteignabilité -----------------------------------------------------------------
//
// Une simulation dédiée, sans notion de temps réel : juste des pontes en
// rafale, bornées en nombre. Si une combinaison n'apparaît jamais malgré des
// dizaines de milliers de croisements, elle est probablement piégée derrière
// un allèle qu'aucune fondatrice ne porte, ou qu'une seule porte — ce que le
// test de cohérence vérifie par construction, et que ceci vérifie en pratique.
console.log('  atteignabilité par croisement —')
{
  const hasard = graine(4242)
  const e = L.neuf()
  const LIMITE = 60000
  let i = 0
  for (; i < LIMITE && e.decouvertes.length < L.TOTAL_COMBOS; i++) L.ponte(e, hasard)
  const complet = e.decouvertes.length >= L.TOTAL_COMBOS
  console.log(
    `    ${e.decouvertes.length} / ${L.TOTAL_COMBOS} combinaisons atteintes en ${i} pontes` +
      (complet ? '  — toutes les combinaisons du pool sont atteignables' : '  ⚠ incomplet, certaines restent hors de portée'),
  )
  if (!complet) {
    const manquantes = []
    for (let k = 0; k < L.TOTAL_COMBOS; k++) {
      const id = L.comboId(L.comboDeIndex(k))
      if (!e.decouvertes.includes(id)) manquantes.push(id)
    }
    console.log(`    manquantes : ${manquantes.slice(0, 10).join(', ')}${manquantes.length > 10 ? '…' : ''}`)
  }
}

console.log(`\n  bassin plafonné à ${CAPACITE} créatures · nourriture plafonnée à ${NOURRITURE_MAX}`)
