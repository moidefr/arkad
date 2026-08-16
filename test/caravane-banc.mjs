/**
 * Le banc d'équilibrage de CARAVANE.
 *
 * Un commerçant joue vraiment le jeu : à chaque halte, il vend sa cargaison,
 * puis choisit le trajet le plus rentable parmi ses voisins directs — pas en
 * achetant bêtement plein la charrette, mais en calculant la quantité qui
 * maximise le profit *net*, prix qui grimpe en achetant et qui s'écroule en
 * vendant compris. C'est ce calcul qui a manqué la première version de ce
 * banc : remplir la charrette à ras bord sur un petit écart de prix fait
 * fondre la marge dans l'impact du gros lot, et un commerçant qui achète
 * ainsi perd de l'argent en boucle sans jamais s'en rendre compte.
 *
 * Il n'agrandit sa flotte que quand une charrette de plus rapporterait
 * vraiment sur l'opportunité du moment (voir `gainCharrette`) — acheter
 * seulement parce que c'est abordable a été mesuré au banc et perd de
 * l'argent : la première version dépensait dans la flotte dès que la caisse
 * le permettait, et une flotte à onze charrettes finissait avec moins de
 * patrimoine qu'une seule qui n'avait jamais grandi.
 *
 * Le banc imprime le patrimoine mesuré à 1 h, 5 h et 10 h de jeu simulé, la
 * répartition des trajets et des marchandises échangées (si une seule route
 * ou une seule marchandise porte l'essentiel du commerce, l'équilibre est à
 * revoir plutôt qu'à deviner — la leçon de DONJON, jamais mesuré), et deux
 * comparaisons : la flotte rapporte-t-elle vraiment, le raccourci de
 * montagne compte-t-il pour de vrai.
 *
 *   node test/caravane-banc.mjs [heures]
 */
import { MARCHANDISES, MARCHES, FRAIS_VENTE, ECART_MIN, ECART_MAX, CAPACITE_PAR_CHARRETTE } from '../src/long/caravane/donnees.js'
import * as L from '../src/long/caravane/logique.js'
import { graine } from './faux.js'

const HEURES = Number(process.argv[2] ?? 10)
const PAS = 30 // secondes de jeu par tour de boucle — le trader ne décide qu'à l'arrivée

/** La réserve de trésorerie gardée de côté : de quoi couvrir l'entretien longtemps sans jamais tomber à zéro. */
const reserveDe = (e) => e.charrettes * 0.012 * 400

/** Le coût cumulé d'acheter 0, 1, 2, … `n` unités de `g` au marché `i` — sans muter l'état. */
function previsionAchat(e, i, g, n) {
  let ecart = e.ecarts[i][g]
  let cum = 0
  const t = [0]
  for (let k = 0; k < n; k++) {
    cum += MARCHANDISES[g].ref * MARCHES[i].mult[g] * ecart
    ecart = Math.min(ECART_MAX, ecart + MARCHANDISES[g].volat)
    t.push(cum)
  }
  return t
}

/** Le gain cumulé (frais déduits) de vendre 0, 1, 2, … `n` unités de `g` au marché `i`. */
function previsionVente(e, i, g, n) {
  let ecart = e.ecarts[i][g]
  let cum = 0
  const t = [0]
  for (let k = 0; k < n; k++) {
    ecart = Math.max(ECART_MIN, ecart - MARCHANDISES[g].volat)
    cum += MARCHANDISES[g].ref * MARCHES[i].mult[g] * ecart * (1 - FRAIS_VENTE)
    t.push(cum)
  }
  return t
}

/**
 * Le meilleur (marchandise, voisin, quantité) pour un aller simple depuis le
 * marché courant, avec la quantité qui maximise le profit *net* — pas
 * forcément la capacité pleine — et une capacité qu'on peut lui souffler
 * pour évaluer « et si j'avais une charrette de plus ? ».
 */
function meilleurTrajet(e, budget, cap = L.capacite(e)) {
  let meilleur = null
  for (const c of L.connexions(e.marche)) {
    for (let g = 0; g < MARCHANDISES.length; g++) {
      const achats = previsionAchat(e, e.marche, g, cap)
      const ventes = previsionVente(e, c.vers, g, cap)
      let k = 0
      let profit = 0
      for (let n = 1; n <= cap; n++) {
        if (achats[n] > budget) break
        const p = ventes[n] - achats[n]
        if (p > profit) {
          profit = p
          k = n
        }
      }
      if (k === 0) continue
      // Un profit par seconde de trajet, pénalisé par le risque : un raccourci
      // dangereux doit rapporter nettement plus pour valoir le coup.
      const score = (profit / c.duree) * (1 - c.risque * 0.8)
      if (!meilleur || score > meilleur.score) meilleur = { g, vers: c.vers, k, score, profit }
    }
  }
  return meilleur
}

/** Achète sans jamais entamer la réserve : on plafonne la caisse le temps de l'achat. */
function acheteAvecReserve(e, g, qte, budget) {
  const reel = e.argent
  e.argent = Math.min(reel, budget)
  const r = L.achete(e, g, qte)
  e.argent += reel - Math.min(reel, budget)
  return r
}

/**
 * Ce qu'une charrette de plus rapporterait *maintenant*, sur la meilleure
 * opportunité du moment : la différence entre le profit accessible avec la
 * capacité actuelle et celui accessible avec une capacité plus grande, à
 * budget diminué du prix de la charrette. Une capacité qu'on ne peut de
 * toute façon pas remplir (le budget est le vrai plafond, pas la place) ne
 * gagne rien à grandir — c'est exactement ce calcul qui manquait avant.
 */
function gainCharrette(e, budget, profitActuel) {
  const cout = L.coutCharrette(e)
  if (e.argent < cout) return { cout, gain: -Infinity }
  const plus = meilleurTrajet(e, Math.max(0, budget - cout), L.capacite(e) + CAPACITE_PAR_CHARRETTE)
  return { cout, gain: (plus?.profit ?? 0) - profitActuel }
}

function joue(heures, hasard, { flotte = true } = {}) {
  const e = L.neuf()
  const releves = {}
  const bornes = [3600, 5 * 3600, 10 * 3600, 24 * 3600].filter((h) => h <= heures * 3600)
  const usageRoutes = {}
  const usageBiens = MARCHANDISES.map(() => 0)
  let incidents = 0
  let banqueroutes = 0
  let charrettesAchetees = 0
  let voyages = 0

  for (let t = 0; t < heures * 3600; t += PAS) {
    const ev = L.avance(e, PAS, hasard)
    if (ev.incident) incidents++
    if (ev.banqueroute) banqueroutes++

    if (!e.enRoute) {
      // On vend tout ce qu'on transporte : on ne l'a chargé que pour ça.
      for (let g = 0; g < MARCHANDISES.length; g++) if (e.cargaison[g] > 0) L.vend(e, g, e.cargaison[g])

      const reserve = reserveDe(e)
      let budget = Math.max(0, e.argent - reserve)
      let trajet = meilleurTrajet(e, budget)

      // On n'agrandit la flotte que si ça se rembourse en quelques trajets —
      // pas simplement parce que c'est abordable (mesuré : ça perd de l'argent).
      if (flotte) {
        const { cout, gain } = gainCharrette(e, budget, trajet?.profit ?? 0)
        if (gain * 4 > cout && e.argent - cout >= reserve) {
          if (L.acheteCharrette(e)) {
            charrettesAchetees++
            budget = Math.max(0, e.argent - reserve)
            trajet = meilleurTrajet(e, budget)
          }
        }
      }

      if (trajet) {
        acheteAvecReserve(e, trajet.g, trajet.k, budget)
        usageBiens[trajet.g]++
        const cle = [e.marche, trajet.vers].sort((a, b) => a - b).join('-')
        usageRoutes[cle] = (usageRoutes[cle] ?? 0) + 1
        L.partir(e, trajet.vers)
        voyages++
      } else {
        // Rien de rentable d'ici : direction LA CITADELLE, le carrefour, pour
        // se redonner des options plutôt que de rester planté.
        const conn = L.connexions(e.marche)
        const vers = conn.find((c) => c.vers === 3) ?? conn[Math.floor(hasard() * conn.length)]
        if (vers) L.partir(e, vers.vers)
      }
    }

    for (const h of bornes) if (t >= h && !(h in releves)) releves[h] = L.patrimoine(e)
  }
  releves.fin = L.patrimoine(e)
  return { e, releves, usageRoutes, usageBiens, incidents, banqueroutes, charrettesAchetees, voyages }
}

const somme = (arr) => arr.reduce((s, n) => s + n, 0)

console.log(`--- CARAVANE : ${HEURES} h simulées, un commerçant qui achète la quantité optimale ---\n`)

const r = joue(HEURES, graine(4242))

console.log('patrimoine (argent + cargaison au prix de référence − dette) :')
for (const [h, v] of Object.entries(r.releves)) {
  const libelle = h === 'fin' ? `${HEURES} h (fin)` : `${(Number(h) / 3600).toFixed(0)} h`
  console.log(`  ${libelle.padEnd(12)} ${L.nombre(v).padStart(8)} or`)
}

console.log(`\nvoyages : ${r.voyages}   incidents (vol/taxe) : ${r.incidents}   banqueroutes : ${r.banqueroutes}`)
console.log(`charrettes achetées : ${r.charrettesAchetees}   flotte finale : ${r.e.charrettes}   capacité : ${L.capacite(r.e)}`)

console.log('\nrépartition des trajets choisis (marché ↔ marché : nombre de fois emprunté) :')
const totalRoutes = somme(Object.values(r.usageRoutes)) || 1
for (const [cle, n] of Object.entries(r.usageRoutes).sort((a, b) => b[1] - a[1])) {
  const [a, b] = cle.split('-').map(Number)
  const pct = ((n / totalRoutes) * 100).toFixed(1)
  console.log(`  ${MARCHES[a].nom.padEnd(14)} ↔ ${MARCHES[b].nom.padEnd(14)} ${String(n).padStart(4)}  (${pct.padStart(5)} %)`)
}
const routeMax = Math.max(...Object.values(r.usageRoutes), 0)
if (routeMax / totalRoutes > 0.5) console.log('  ⚠ une route porte plus de la moitié du commerce')
else console.log(`  route la plus prise : ${((routeMax / totalRoutes) * 100).toFixed(1)} % du commerce — pas de domination triviale`)

console.log('\nrépartition des marchandises achetées (nombre de trajets où elles sont choisies) :')
const totalBiens = somme(r.usageBiens) || 1
r.usageBiens.forEach((n, g) => {
  const pct = ((n / totalBiens) * 100).toFixed(1)
  console.log(`  ${MARCHANDISES[g].nom.padEnd(8)} ${String(n).padStart(4)}  (${pct.padStart(5)} %)`)
})
const bienMax = Math.max(...r.usageBiens)
if (bienMax / totalBiens > 0.6) console.log('  ⚠ une marchandise domine trivialement le commerce')
else console.log(`  marchandise la plus achetée : ${((bienMax / totalBiens) * 100).toFixed(1)} % des trajets — pas de domination triviale`)

// --- La flotte compte-t-elle vraiment ? Une mesure directe, pas un long ---------
// --- aller-retour simulé : le chemin que prend un commerçant glouton sur -------
// --- des dizaines d'heures dépend de micro-décisions en cascade, et deux -------
// --- flottes différentes finissent par emprunter des routes différentes — -----
// --- comparer leurs patrimoines finaux mesurerait ce hasard-là, pas la ---------
// --- capacité. Ce qui se mesure proprement : sur le *même* état, avec la ------
// --- *même* trésorerie, une capacité plus grande permet-elle un meilleur ------
// --- trajet, tout de suite ? ----------------------------------------------------

console.log('\n--- la flotte, mesurée directement : une charrette de plus, sur la meilleure opportunité du moment ---')
{
  const [depart, arrivee] = [2, 7] // VALDOR → CARDAMONE : le métal y est à son plus large écart
  const e = L.neuf()
  e.marche = depart
  e.argent = 20000
  for (const charrettes of [1, 2, 4, 8]) {
    e.charrettes = charrettes
    const cap = L.capacite(e)
    const achats = previsionAchat(e, depart, 3, cap) // métal, bon marché à Valdor
    const ventes = previsionVente(e, arrivee, 3, cap)
    let k = 0
    let profit = 0
    for (let n = 1; n <= cap; n++) {
      if (achats[n] > e.argent) break
      if (ventes[n] - achats[n] > profit) {
        profit = ventes[n] - achats[n]
        k = n
      }
    }
    console.log(`  ${charrettes} charrette(s), capacité ${cap.toString().padStart(3)} : meilleur trajet rapporte ${L.nombre(profit)} or (${k} unités)`)
  }
}

// --- Comparaison : le raccourci de montagne compte-t-il pour de vrai ? --------------

console.log('\n--- comparaison : un commerçant qui ignore le raccourci VALDOR–CARDAMONE ---')
{
  const hasard = graine(4242)
  const e = L.neuf()
  for (let t = 0; t < HEURES * 3600; t += PAS) {
    L.avance(e, PAS, hasard)
    if (e.enRoute) continue
    for (let g = 0; g < MARCHANDISES.length; g++) if (e.cargaison[g] > 0) L.vend(e, g, e.cargaison[g])
    const reserve = reserveDe(e)
    const budget = Math.max(0, e.argent - reserve)
    const cap = L.capacite(e)
    const conn = L.connexions(e.marche).filter((c) => !(e.marche === 2 && c.vers === 7) && !(e.marche === 7 && c.vers === 2))
    let meilleur = null
    for (const c of conn) {
      for (let g = 0; g < MARCHANDISES.length; g++) {
        const achats = previsionAchat(e, e.marche, g, cap)
        const ventes = previsionVente(e, c.vers, g, cap)
        let k = 0
        let profit = 0
        for (let n = 1; n <= cap; n++) {
          if (achats[n] > budget) break
          if (ventes[n] - achats[n] > profit) {
            profit = ventes[n] - achats[n]
            k = n
          }
        }
        if (k === 0) continue
        const score = (profit / c.duree) * (1 - c.risque * 0.8)
        if (!meilleur || score > meilleur.score) meilleur = { g, vers: c.vers, k, score }
      }
    }
    if (meilleur) {
      acheteAvecReserve(e, meilleur.g, meilleur.k, budget)
      L.partir(e, meilleur.vers)
    } else if (conn.length) L.partir(e, conn[Math.floor(hasard() * conn.length)].vers)
  }
  console.log(`  patrimoine à ${HEURES} h sans le raccourci : ${L.nombre(L.patrimoine(e))} or`)
  console.log(`  (à comparer aux ${L.nombre(r.releves.fin)} or du commerçant qui l’emprunte)`)
}
