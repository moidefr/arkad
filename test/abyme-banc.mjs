/**
 * Le banc d'équilibrage de l'ABYME.
 *
 * DONJON, l'ancien jeu, n'avait jamais été mesuré. Ici, un automate de combat
 * simple (fonce sur le monstre le plus proche, sinon vers la sortie) joue un
 * grand nombre de descentes, et le banc imprime la profondeur moyenne
 * atteinte, la cause de mort dominante, et — surtout — si une relique
 * choisie en priorité change la profondeur moyenne au point de dominer
 * trivialement les autres, ou de ne servir à rien.
 *
 *   node test/abyme-banc.mjs [parties]
 */
import { RELIQUES, SYNERGIES, MONSTRES } from '../src/long/abyme/donnees.js'
import * as L from '../src/long/abyme/logique.js'
import { graine } from './faux.js'

const PARTIES = Number(process.argv[2] ?? 600)
const TOUTES = RELIQUES.map((r) => r.id)
const MAX_ETAPES = 6000

/**
 * Direction qui rapproche le plus de `(bx, by)`, avec un repli sur l'autre
 * axe si l'axe principal vient d'échouer. À égalité stricte entre les deux
 * axes, le choix est tiré au hasard plutôt que toujours le même : un
 * poursuivant déterministe face à un TIREUR qui fuit toujours en diagonale
 * recrée la même adjacence à chaque tour et boucle sans fin — mesuré au
 * banc, corrigé ici plutôt que dans le jeu, puisque c'est l'automate qui est
 * naïf, pas la règle.
 */
function coupSuivant(e, but, dernierBloque, hasard) {
  const dx = but.x - e.joueur.x
  const dy = but.y - e.joueur.y
  if (dx === 0 && dy === 0) return 'attendre'
  const primaireX = Math.abs(dx) === Math.abs(dy) ? hasard() < 0.5 : Math.abs(dx) > Math.abs(dy)
  const optA = primaireX ? (dx > 0 ? 'droite' : 'gauche') : dy > 0 ? 'bas' : 'haut'
  const optB = primaireX ? (dy > 0 ? 'bas' : dy < 0 ? 'haut' : null) : dx > 0 ? 'droite' : dx < 0 ? 'gauche' : null
  if (dernierBloque === optA && optB) return optB
  return optA
}

function plusProcheEnnemi(e) {
  let meilleur = null
  let meilleureDist = Infinity
  for (const m of e.monstres) {
    if (m.camp !== 'ennemi') continue
    const d = Math.abs(m.x - e.joueur.x) + Math.abs(m.y - e.joueur.y)
    if (d < meilleureDist) {
      meilleureDist = d
      meilleur = m
    }
  }
  return meilleur
}

/**
 * Joue une descente complète. `preferer(offre)` choisit une relique dans
 * l'offre courante — c'est le seul point de variation entre les stratégies
 * mesurées ci-dessous.
 */
function joue(hasard, preferer) {
  const e = L.neuf(hasard, TOUTES)
  let dernierBloque = null
  let blocagesSuite = 0
  let errance = 0
  let errDir = null
  let etapes = 0
  let causeMort = ''
  while (!e.fin && etapes < MAX_ETAPES) {
    etapes++
    if (e.offre) {
      const id = preferer(e.offre, e, hasard)
      L.choisis(e, id, hasard)
      dernierBloque = null
      blocagesSuite = 0
      errance = 0
      continue
    }
    const but = plusProcheEnnemi(e) ?? e.salle.sortie
    let dir
    if (errance > 0) {
      dir = errDir
      errance--
    } else {
      dir = coupSuivant(e, but, dernierBloque, hasard)
    }
    const ev = L.tour(e, dir, hasard)
    if (ev.bloque) {
      blocagesSuite++
      // Deux échecs de suite : ni l'axe principal ni son repli ne passent —
      // un mur isolé coupe la ligne droite. Plutôt que de retenter le même
      // coup indéfiniment, l'automate part au hasard sur le travers, deux
      // pas, avant de recalculer vers sa cible. Une vraie recherche de
      // chemin serait plus fidèle, mais l'automate doit rester simple.
      if (blocagesSuite >= 2) {
        errDir = dir === 'haut' || dir === 'bas' ? (hasard() < 0.5 ? 'gauche' : 'droite') : hasard() < 0.5 ? 'haut' : 'bas'
        errance = 3
        blocagesSuite = 0
      }
    } else {
      blocagesSuite = 0
    }
    dernierBloque = ev.bloque ? dir : null
    if (ev.degatsSubis) causeMort = 'combat'
    if (ev.piege && !ev.ralenti) causeMort = 'piège'
  }
  return {
    profondeur: e.profondeur,
    meurtres: e.meurtres,
    reliques: [...e.reliques],
    ossements: L.ossements(e),
    etapes,
    bloque: etapes >= MAX_ETAPES,
    mort: e.fin === 'mort',
    causeMort,
  }
}

function mediane(xs) {
  const t = [...xs].sort((a, b) => a - b)
  return t[Math.floor(t.length / 2)] ?? 0
}
function moyenne(xs) {
  return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0
}

// --- Stratégie de référence : relique tirée au hasard dans l'offre -------------------

console.log(`${PARTIES} parties — automate « fonce sur le plus proche, sinon vers la sortie »\n`)

{
  const hasard = graine(7)
  const auHasard = (offre, _e, h) => offre[Math.floor(h() * offre.length)]
  const resultats = []
  for (let i = 0; i < PARTIES; i++) resultats.push(joue(hasard, auHasard))

  const profondeurs = resultats.map((r) => r.profondeur)
  const bloques = resultats.filter((r) => r.bloque)
  console.log(`  relique aléatoire  profondeur moyenne ${moyenne(profondeurs).toFixed(1)} · ` +
    `médiane ${mediane(profondeurs)} · min ${Math.min(...profondeurs)} · max ${Math.max(...profondeurs)}` +
    (bloques.length ? ` · ⚠ ${bloques.length} partie(s) bloquée(s) (${MAX_ETAPES} étapes)` : ''))

  const causes = {}
  for (const r of resultats) if (r.mort) causes[r.causeMort || '?'] = (causes[r.causeMort || '?'] ?? 0) + 1
  console.log(`  causes de mort : ${JSON.stringify(causes)}`)

  const synergiesVues = {}
  for (const r of resultats) {
    for (const s of SYNERGIES) {
      if (s.requises.every((id) => r.reliques.includes(id))) synergiesVues[s.id] = (synergiesVues[s.id] ?? 0) + 1
    }
  }
  console.log(`  synergies complétées sur ${PARTIES} parties : ${JSON.stringify(synergiesVues)}`)

  const profSelonSynergie = {}
  for (const s of SYNERGIES) {
    const avec = resultats.filter((r) => s.requises.every((id) => r.reliques.includes(id)))
    const sans = resultats.filter((r) => !s.requises.every((id) => r.reliques.includes(id)))
    profSelonSynergie[s.id] = {
      avec: avec.length ? moyenne(avec.map((r) => r.profondeur)).toFixed(1) : '—',
      sans: sans.length ? moyenne(sans.map((r) => r.profondeur)).toFixed(1) : '—',
      n: avec.length,
    }
  }
  console.log('\n  profondeur moyenne, avec la synergie complétée vs sans —')
  for (const [id, v] of Object.entries(profSelonSynergie)) {
    console.log(`    ${id.padEnd(18)} avec ${v.avec.toString().padStart(5)}  ·  sans ${v.sans.toString().padStart(5)}  (n=${v.n})`)
  }
}

// --- Une relique préférée à la fois : laquelle domine, laquelle ne sert à rien ? ------

console.log('\n  profondeur moyenne quand le bot choisit une relique en priorité dès qu’elle est offerte —')
{
  const PARTIES_RELIQUE = Math.max(80, Math.floor(PARTIES / 4))
  const lignes = []
  for (const rel of RELIQUES) {
    const hasard = graine(1000 + rel.id.length * 31)
    const preferer = (offre) => (offre.includes(rel.id) ? rel.id : offre[0])
    const resultats = []
    for (let i = 0; i < PARTIES_RELIQUE; i++) resultats.push(joue(hasard, preferer))
    const profondeurs = resultats.map((r) => r.profondeur)
    lignes.push({ id: rel.id, nom: rel.nom, moyenne: moyenne(profondeurs), mediane: mediane(profondeurs) })
  }
  lignes.sort((a, b) => b.moyenne - a.moyenne)
  for (const l of lignes) {
    console.log(`    ${l.nom.padEnd(20)} profondeur moyenne ${l.moyenne.toFixed(1).padStart(5)}  ·  médiane ${l.mediane}`)
  }
  const moyennes = lignes.map((l) => l.moyenne)
  console.log(`\n  écart entre la meilleure et la pire préférence : ${(Math.max(...moyennes) - Math.min(...moyennes)).toFixed(1)} étages`)
}

// --- Le bestiaire : qui tue le plus, à quelle profondeur apparaît chaque type --------

console.log('\n  bestiaire —')
for (const [id, m] of Object.entries(MONSTRES)) console.log(`    ${m.nom.padEnd(10)} vie ${m.vie} (+${m.croissanceVie}/étage) · dégâts ${m.degats} (+${m.croissanceDegats}/étage)`)
