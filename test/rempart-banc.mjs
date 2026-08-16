/**
 * Le banc d'équilibrage de REMPART.
 *
 * Contrairement à USINE (une seule très longue partie) ou EXPÉDITION
 * (Monte-Carlo sur des parties indépendantes), REMPART a besoin des deux à la
 * fois : c'est une succession de défenses, et la question qui compte n'est
 * pas « une défense est-elle gagnable ? » mais « la 10ᵉ défense est-elle
 * mesurablement plus facile que la 1ʳᵉ, sans devenir triviale ? ».
 *
 * Deux expériences, avec le même automate de pose simple (la tour la moins
 * chère qu'on peut encore payer, sur chaque emplacement libre) :
 *
 *   1. PROGRESSION NATURELLE — on rejoue toujours la carte la plus dure déjà
 *      débloquée, comme le ferait un joueur qui avance. Les cartes plus
 *      dures compensant une partie du gain méta par construction, cette
 *      courbe mesure surtout si le rythme de déblocage des cartes est sain.
 *   2. CARTE FIXE — on rejoue uniquement LE PONT, sans jamais dépenser
 *      d'éclats sur les cartes suivantes. C'est la mesure qui compte le
 *      plus : à défi rigoureusement identique, la méta-progression seule
 *      (tours débloquées, améliorations) doit faire aller mesurablement
 *      plus loin, sans rendre la première défense trop simple.
 *
 *   node test/rempart-banc.mjs [defenses]
 */
import { TOURS, CARTES, AMELIORATIONS_META, NIVEAU_MAX } from '../src/long/rempart/donnees.js'
import * as L from '../src/long/rempart/logique.js'
import { toursBoutique } from '../src/long/rempart/dispo.js'
import { graine } from './faux.js'

const DEFENSES = Number(process.argv[2] ?? 30)
const DT = 1 / 10
const LIMITE_T = 3600 * 3 // filet de sécurité : une défense ne doit jamais tourner sans fin

/** Remplit le plateau avec la tour la moins chère qu'on peut encore payer, puis lance. */
function equipeEtLance(partie, meta, carte) {
  const boutique = [...toursBoutique(meta)].sort((a, b) => a.cout - b.cout)
  for (let i = 0; i < carte.emplacements.length; i++) {
    if (partie.tours.some((t) => t.emplacement === i)) continue
    const abordable = boutique.find((t) => t.cout <= partie.ferraille)
    if (!abordable) break
    L.poseTour(partie, meta, abordable.id, i)
  }
  let ameliore = true
  while (ameliore) {
    ameliore = false
    for (const tour of partie.tours) {
      if (tour.niveau >= NIVEAU_MAX) continue
      const def = L.tourParId(tour.tourId)
      if (partie.ferraille >= L.coutAmeliorationTour(def, tour.niveau) && L.ameliorerTour(partie, tour.instanceId)) ameliore = true
    }
  }
  L.lanceVagueMaintenant(partie)
}

function joueUneDefense(carteId, meta, hasard) {
  const carte = L.carteParId(carteId)
  const partie = L.partieNeuve(carteId, meta)
  let t = 0
  while (partie.phase !== 'defaite' && t < LIMITE_T) {
    if (partie.phase === 'attente') equipeEtLance(partie, meta, carte)
    L.avance(partie, DT, hasard, {
      vagueTerminee: (vague, gain) => {
        L.crediteEclats(meta, gain)
        L.noteMeilleureVague(meta, carteId, vague)
      },
    })
    t += DT
  }
  L.noteDefaite(meta)
  return { vague: partie.vague, t }
}

/** Tours puis améliorations puis, si demandé, la carte suivante — tout ce qu'on peut se permettre. */
function depenseTout(meta, { cartes = true } = {}) {
  let bouge = true
  while (bouge) {
    bouge = false
    for (const t of TOURS) if (!meta.toursDeblocs.includes(t.id) && L.debloqueTour(meta, t.id)) bouge = true
    for (const a of AMELIORATIONS_META) if (L.ameliore(meta, a.id)) bouge = true
    if (cartes) for (const c of CARTES) if (!meta.cartesDeblocs.includes(c.id) && L.debloqueCarte(meta, c.id)) bouge = true
  }
}

const meilleureCarteDebloquee = (meta) => CARTES.filter((c) => meta.cartesDeblocs.includes(c.id)).at(-1)

// --- Expérience 1 : progression naturelle --------------------------------------------

console.log(`${DEFENSES} défenses par expérience\n`)
console.log('--- 1. progression naturelle (on avance toujours vers la carte la plus dure débloquée) ---\n')

const hasard1 = graine(2024)
const meta1 = L.metaNeuve()
const nat = []

for (let i = 1; i <= DEFENSES; i++) {
  const carte = meilleureCarteDebloquee(meta1)
  const { vague } = joueUneDefense(carte.id, meta1, hasard1)
  depenseTout(meta1)
  nat.push({ i, carte: carte.id, vague, tours: meta1.toursDeblocs.length, cartes: meta1.cartesDeblocs.length })
  console.log(
    `  défense ${String(i).padStart(3)}  ${carte.id.padEnd(12)} vague ${String(vague).padStart(3)}` +
      `  ·  éclats ${String(meta1.eclats).padStart(4)}  ·  tours ${meta1.toursDeblocs.length}/${TOURS.length}  ·  cartes ${meta1.cartesDeblocs.length}/${CARTES.length}`,
  )
}

const toutesToursA = nat.findIndex((r) => r.tours === TOURS.length)
const toutesCartesA = nat.findIndex((r) => r.cartes === CARTES.length)
console.log(`\n  toutes les tours débloquées : défense n° ${toutesToursA >= 0 ? toutesToursA + 1 : 'jamais en ' + DEFENSES}`)
console.log(`  toutes les cartes débloquées : défense n° ${toutesCartesA >= 0 ? toutesCartesA + 1 : 'jamais en ' + DEFENSES}`)
console.log('  meilleure vague par carte —')
for (const c of CARTES) console.log(`    ${c.nom.padEnd(16)} ${meta1.meilleureVague[c.id] ?? '—'}`)

// --- Expérience 2 : carte fixe, seule la méta progresse -------------------------------

console.log('\n--- 2. carte fixe (LE PONT uniquement, éclats jamais dépensés sur les cartes) ---\n')

const hasard2 = graine(7)
const meta2 = L.metaNeuve()
const fixe = []

for (let i = 1; i <= DEFENSES; i++) {
  const { vague } = joueUneDefense(CARTES[0].id, meta2, hasard2)
  depenseTout(meta2, { cartes: false })
  fixe.push({ i, vague })
  if (i <= 5 || i % 5 === 0) console.log(`  défense ${String(i).padStart(3)}  vague ${String(vague).padStart(3)}  ·  éclats ${meta2.eclats}`)
}

const moyenne = (xs) => xs.reduce((s, r) => s + r.vague, 0) / xs.length
const debut = fixe.slice(0, 5)
const fin = fixe.slice(-5)
const ratio = moyenne(fin) / Math.max(1, moyenne(debut))

console.log(`\n  vague moyenne, 5 premières défenses : ${moyenne(debut).toFixed(1)}`)
console.log(`  vague moyenne, 5 dernières défenses : ${moyenne(fin).toFixed(1)}`)
console.log(`  facteur de progression : ×${ratio.toFixed(2)} (1.0 = la méta-progression ne change rien mesurablement)`)
console.log(`  niveaux d'améliorations atteints : ${AMELIORATIONS_META.map((a) => `${a.nom} ${L.niveauMeta(meta2, a.id)}/${a.couts.length}`).join('  ·  ')}`)

// --- Verdicts ---------------------------------------------------------------------

console.log('\n--- verdicts ---')
if (ratio < 1.15) console.log(`  ⚠ progression trop plate sur carte fixe (×${ratio.toFixed(2)}) — la méta-progression ne se sent pas.`)
else console.log(`  ✓ la méta-progression fait mesurablement mieux sur un défi identique (×${ratio.toFixed(2)}).`)

if (moyenne(debut) > 25) console.log(`  ⚠ la toute première défense (aucun bonus) va déjà très loin (${moyenne(debut).toFixed(1)} vagues) — trop facile d'entrée.`)
else if (moyenne(debut) < 4) console.log(`  ⚠ la toute première défense s'arrête presque tout de suite (${moyenne(debut).toFixed(1)} vagues) — trop dur d'entrée.`)
else console.log(`  ✓ la première défense n'est ni triviale ni bloquante (${moyenne(debut).toFixed(1)} vagues en moyenne).`)

if (fin.some((r) => r.vague > 60)) console.log('  ⚠ des défenses tardives dépassent 60 vagues avec un automate simple — l’escalade infinie plafonne peut-être trop tard.')
