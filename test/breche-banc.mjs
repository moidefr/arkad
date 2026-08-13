/**
 * Le banc d'équilibrage de BRÈCHE.
 *
 * Il fait jouer deux automates de niveaux différents et imprime jusqu'où
 * chacun va. Depuis que la partie est sans fin, ce n'est plus un objectif
 * qu'on vérifie mais **le directeur de difficulté** : un bon automate doit
 * aller plus loin qu'un mauvais, sinon l'adaptation ne sert à rien — et il ne
 * doit pas aller *indéfiniment* plus loin, sinon elle ne mord pas.
 *
 *   node test/breche-banc.mjs [parties]
 */
import * as L from '../src/long/breche/logique.js'
import { PIECE, encombrement, PAR_PALIER } from '../src/long/breche/donnees.js'
import * as Dir from '../src/long/breche/directeur.js'

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
  const bas = 0
  // Superlinéaire sur le nombre de lignes : un joueur prépare un doublé au
  // lieu de prendre deux fois une ligne seule, et dans les mondes de crue c'est
  // exactement la compétence que le jeu demande.
  return lignes * lignes * 90 + lignes * 40 + contacts * 3 - trous * 25 + restants * 0.5 + bas
}

/**
 * Deux automates. Le « moyen » prend ce qui se présente ; le « distrait » pose
 * la première pièce à la première place. L'écart entre les deux est ce que le
 * banc mesure vraiment.
 */
function partie(graine, distrait = false) {
  const p = L.nouvelle(graine)
  let coups = 0
  while (!p.fini && coups < 20000) {
    const coup = distrait ? premierCoup(p) : meilleurCoup(p)
    if (!coup) break
    L.pose(p, coup.k, coup.c, coup.l)
    coups++
  }
  return { p, coups }
}

function premierCoup(p) {
  for (let k = 0; k < p.main.length; k++) {
    const id = p.main[k]
    if (!id) continue
    for (let l = 0; l < p.taille; l++) {
      for (let c = 0; c < p.taille; c++) if (L.peutPoser(p, id, c, l)) return { k, c, l }
    }
  }
  return null
}

// --- Le balayage ---------------------------------------------------------------

console.log(`${PARTIES} parties par automate\n`)

for (const [nom, distrait] of [
  ['distrait', true],
  ['moyen', false],
]) {
  let coupsTotal = 0
  let pointsTotal = 0
  let meilleur = 0
  let paliers = 0
  let aisance = 0
  for (let n = 0; n < PARTIES; n++) {
    const { p, coups } = partie(1000 + n * 7919, distrait)
    coupsTotal += coups
    pointsTotal += p.score
    meilleur = Math.max(meilleur, p.score)
    paliers += L.palier(p)
    aisance += p.aisance
  }
  console.log(
    `  ${nom.padEnd(9)} ${(coupsTotal / PARTIES).toFixed(0).padStart(4)} poses · ` +
      `${(pointsTotal / PARTIES).toFixed(0).padStart(6)} points en moyenne · ` +
      `record ${String(meilleur).padStart(6)} · ` +
      `${(paliers / PARTIES).toFixed(1)} palier(s) de musique · ` +
      `aisance finale ${(aisance / PARTIES).toFixed(2)}`,
  )
}
console.log(`\n  un palier de musique tous les ${PAR_PALIER} points ; il y en a 50 à traverser.`)

// --- Le vivier selon la difficulté ------------------------------------------------

console.log('\n  ce que donne le directeur, part des pièces de 4 cases et plus —')
for (const d of [0, 0.25, 0.5, 0.75, 1]) {
  const faux = { ...L.nouvelle(1), aisance: d, poses: 0 }
  const v = Dir.vivier(faux)
  const total = v.reduce((s, e) => s + e.poids, 0)
  const gros = v.filter((e) => e.piece.cases.length >= 4).reduce((s, e) => s + e.poids, 0)
  const barre = '█'.repeat(Math.round((gros / total) * 40))
  console.log(`    difficulté ${d.toFixed(2)}  ${((gros / total) * 100).toFixed(0).padStart(3)} %  ${barre}`)
}

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
