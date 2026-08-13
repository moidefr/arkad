/**
 * Le banc d'équilibrage de BRÈCHE.
 *
 * Il fait jouer un automate correct — pas parfait, correct — et imprime
 * jusqu'où il va : quel monde il atteint, combien de coups il tient, où il
 * meurt. C'est le seul moyen de savoir si un objectif est atteignable sans
 * jouer soi-même trois heures, et si un monde est infranchissable plutôt que
 * difficile.
 *
 *   node test/breche-banc.mjs [parties]
 */
import * as L from '../src/long/breche/logique.js'
import { PIECE, MONDES, encombrement } from '../src/long/breche/donnees.js'

const PARTIES = Number(process.argv[2] ?? 40)

/**
 * L'automate. Il pense comme un joueur moyen : il prend les lignes quand
 * elles se présentent, se colle aux blocs déjà posés, et évite de laisser des
 * trous d'une case. Il ne regarde pas les deux coups suivants — un joueur qui
 * le fait ira nettement plus loin, et c'est très bien : le banc doit mesurer
 * un plancher, pas un plafond.
 */
function meilleurCoup(p) {
  let meilleur = null
  for (let k = 0; k < p.main.length; k++) {
    const id = p.main[k]
    if (!id) continue
    const { w, h } = encombrement(PIECE[id])
    for (let l = 0; l <= p.taille - h; l++) {
      for (let c = 0; c <= p.taille - w; c++) {
        if (!L.peutPoser(p, id, c, l)) continue
        const s = note(p, id, c, l)
        if (!meilleur || s > meilleur.s) meilleur = { k, c, l, s }
      }
    }
  }
  return meilleur
}

function note(p, id, c, l) {
  const cases = L.empreinte(id, c, l)
  const occupe = new Set(cases.map((e) => L.indice(p, e.c, e.l)))
  const plein = (cc, ll) => {
    if (!L.dans(p, cc, ll)) return true
    const i = L.indice(p, cc, ll)
    return p.cases[i] > 0 || occupe.has(i)
  }

  let lignes = 0
  for (let ll = 0; ll < p.taille; ll++) {
    let f = true
    for (let cc = 0; cc < p.taille; cc++) if (!plein(cc, ll)) f = false
    if (f) lignes++
  }
  for (let cc = 0; cc < p.taille; cc++) {
    let f = true
    for (let ll = 0; ll < p.taille; ll++) if (!plein(cc, ll)) f = false
    if (f) lignes++
  }

  // Se coller à ce qui existe, et ne pas isoler une case vide.
  let contacts = 0
  for (const e of cases) {
    for (const [dc, dl] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      if (plein(e.c + dc, e.l + dl)) contacts++
    }
  }
  let trous = 0
  for (let ll = 0; ll < p.taille; ll++) {
    for (let cc = 0; cc < p.taille; cc++) {
      if (plein(cc, ll)) continue
      let mur = 0
      for (const [dc, dl] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        if (plein(cc + dc, ll + dl)) mur++
      }
      if (mur === 4) trous++
    }
  }
  let restants = 0
  for (let i = 0; i < p.cases.length; i++) if (!p.cases[i] && !occupe.has(i)) restants++

  // Quand une rangée monte du bas, un joueur garde le haut dégagé — c'est la
  // stratégie évidente du monde, et une heuristique qui l'ignore mesure son
  // propre angle mort plutôt que la difficulté du jeu.
  let bas = 0
  if (L.regles(p).montee) {
    for (const e of cases) bas += e.l
    bas = (bas / cases.length) * 6
  }
  // Superlinéaire sur le nombre de lignes : un joueur prépare un doublé au
  // lieu de prendre deux fois une ligne seule, et dans les mondes de crue c'est
  // exactement la compétence que le jeu demande.
  return lignes * lignes * 90 + lignes * 40 + contacts * 3 - trous * 25 + restants * 0.5 + bas
}

function partie(graine) {
  const p = L.nouvelle(graine)
  let coups = 0
  const mondes = []
  while (!p.fini && coups < 5000) {
    const coup = meilleurCoup(p)
    if (!coup) break
    L.pose(p, coup.k, coup.c, coup.l)
    coups++
    if (L.atteint(p)) {
      mondes.push({ n: p.n, coups })
      L.suivant(p)
    }
  }
  return { p, coups, mondes }
}

// --- Le balayage ---------------------------------------------------------------

console.log(`${PARTIES} parties, automate « joueur moyen »\n`)

const atteints = new Map()
const morts = new Map()
let coupsTotal = 0
let totalPoints = 0
let plusLoin = 0

for (let n = 0; n < PARTIES; n++) {
  const { p, coups } = partie(1000 + n * 7919)
  coupsTotal += coups
  totalPoints += p.total
  plusLoin = Math.max(plusLoin, p.n)
  for (let k = 0; k <= p.n; k++) atteints.set(k, (atteints.get(k) ?? 0) + 1)
  morts.set(p.n, (morts.get(p.n) ?? 0) + 1)
}

console.log('  monde par monde —')
for (let k = 0; k <= plusLoin; k++) {
  const m = L.mondeDe(k)
  const a = atteints.get(k) ?? 0
  const mo = morts.get(k) ?? 0
  const franchis = a - mo
  console.log(
    `    ${String(k + 1).padStart(2)}. ${m.nom.padEnd(18)} ` +
      `objectif ${String(m.objectif).padStart(5)} · ` +
      `atteint par ${String(a).padStart(3)}/${PARTIES} · ` +
      `franchi par ${String(franchis).padStart(3)} (${((franchis / Math.max(1, a)) * 100).toFixed(0)} %)`,
  )
}

console.log('\n  ensemble —')
// Les mondes où une rangée monte se jouent en préparant des doublés, qui la
// repoussent. L'automate ne regarde pas le coup suivant : il prend les lignes
// qui se présentent et ne prépare rien. Son plafond dans ces mondes-là mesure
// donc sa myopie autant que leur difficulté — c'est le seul endroit du banc où
// il faut lire les chiffres avec cette réserve en tête.
console.log(
  `    ${(coupsTotal / PARTIES).toFixed(0)} poses par partie · ${(totalPoints / PARTIES).toFixed(0)} points en moyenne`,
)
console.log(`    monde le plus loin : ${plusLoin + 1} sur ${MONDES.length}`)

// --- Les pièces ------------------------------------------------------------------
//
// Une pièce qu'on ne peut presque jamais poser est une pièce qui tue ; une
// pièce qui rentre partout ne demande rien. On mesure les deux.

console.log('\n  pièces, place moyenne sur un plateau de mi-partie —')
const p = L.nouvelle(4242)
for (let i = 0; i < 14; i++) {
  const coup = meilleurCoup(p)
  if (!coup) break
  L.pose(p, coup.k, coup.c, coup.l)
}
const mesures = Object.values(PIECE)
  .map((piece) => ({ nom: piece.nom, n: L.placesPossibles(p, piece.id), cases: piece.cases.length }))
  .sort((a, b) => a.n - b.n)
for (const m of mesures.slice(0, 6)) console.log(`    la plus serrée : ${m.nom.padEnd(18)} ${m.n} places`)
for (const m of mesures.slice(-3)) console.log(`    la plus large  : ${m.nom.padEnd(18)} ${m.n} places`)
const bloquees = mesures.filter((m) => m.n === 0)
if (bloquees.length) console.log(`    ⚠ ${bloquees.length} pièce(s) ne rentrent nulle part à ce stade`)
