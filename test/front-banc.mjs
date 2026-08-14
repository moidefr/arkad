/**
 * Le banc d'équilibrage de FRONT.
 *
 * Il joue des batailles et des campagnes entières sans rendu, et imprime ce
 * qu'aucun test binaire ne dit : combien de tours dure un engagement, quelle
 * classe rapporte, quel objectif est trop dur, où la campagne s'essouffle.
 *
 * C'est le seul moyen de tenir un jeu de trente-cinq classes et quarante-deux
 * uniques : ASCENSION, avant lui, est mort de n'avoir jamais été mesuré.
 *
 *   node test/front-banc.mjs [campagnes]
 */
import * as B from '../src/massif/front/bataille.js'
import * as IA from '../src/massif/front/ia.js'
import * as Cie from '../src/massif/front/compagnie.js'
import * as U from '../src/massif/front/unites.js'
import { CLASSES, TYPES } from '../src/massif/front/donnees/classes.js'
import { OBJECTIFS } from '../src/massif/front/carte.js'
import { melange32 } from '../src/massif/front/rng.js'
import { genereCarte, placeLibre } from '../src/massif/front/carte.js'
import { versAxial, cle } from '../src/massif/front/hex.js'

const CAMPAGNES = Number(process.argv[2] ?? 12)
const ENGAGEMENTS = 30

/** Joue une bataille jusqu'au bout, des deux côtés, sans dessiner. */
function joue(bat, replierSous = 0.3) {
  let garde = 0
  while (!B.fini(bat) && garde++ < 400) {
    IA.joueCamp(bat, bat.camp)
    if (B.fini(bat)) break
    B.finTour(bat)
    // Un joueur qui voit sa moitié à terre décroche. Sans ce réflexe, le banc
    // mesure une compagnie qui se suicide à chaque revers.
    if (bat.camp === 0 && B.forceRestante(bat, 0) < B.forceRestante(bat, 1) * replierSous) B.retraite(bat)
  }
  return bat
}

/** Ce que fait un joueur entre deux engagements : recruter, soigner, aligner. */
function auCamp(c) {
  while (c.troupes.length < Cie.places(c.niveau) && c.offre.caserne.length) {
    const abordable = c.offre.caserne.filter((l) => l.prix <= c.or).sort((a, b) => b.prix - a.prix)[0]
    if (!abordable) break
    const u = Cie.recruteGenerique(c, abordable.cl)
    if (u) Cie.enrole(c, u.id)
  }
  const dossier = c.offre.uniques.filter((l) => l.prix <= c.or * 0.6).sort((a, b) => b.prix - a.prix)[0]
  if (dossier) {
    const u = Cie.recruteUnique(c, dossier.uq)
    if (u) Cie.enrole(c, u.id)
  }
  for (const t of c.troupes) if (Cie.coutSoin(c, t) <= c.or * 0.35) Cie.soigne(c, t.id)
  while (c.escouades.length < Cie.escouadesMax(c.niveau)) Cie.creeEscouade(c)
  for (const t of [...c.troupes].sort((a, b) => U.fiche(b).att - U.fiche(a).att)) {
    if (!Cie.escouadeDe(c, t.id)) Cie.enrole(c, t.id)
  }
}

// --- Les campagnes ------------------------------------------------------------------

console.log(`${CAMPAGNES} campagnes × ${ENGAGEMENTS} engagements\n`)

const parNiveau = new Map()
const parObjectif = new Map()
const parClasse = new Map()
const ecart = new Map()
const finals = []
let sansFin = 0

for (let n = 0; n < CAMPAGNES; n++) {
  const c = Cie.nouvelle(20260813 + n * 7919)
  for (let k = 0; k < ENGAGEMENTS && !Cie.aneantie(c); k++) {
    auCamp(c)
    const bat = Cie.prepare(c, k % c.plan.length)
    if (!bat) break
    const niveau = c.niveau
    joue(bat)
    if (!B.fini(bat)) sansFin++

    const objet = parObjectif.get(bat.objectif.id) ?? { n: 0, g: 0, t: 0, parObj: 0, parMassacre: 0 }
    objet.n++
    objet.t += bat.tour
    if (bat.fini === 'gagne') objet.g++
    // Par quelle porte on est sorti. Un objectif qu'on ne franchit jamais
    // *par lui-même* n'est pas un mode de jeu, c'est une étiquette.
    if (bat.cause === 'objectif') objet.parObj++
    if (bat.cause === 'anéantissement') objet.parMassacre++
    parObjectif.set(bat.objectif.id, objet)

    const pal = Math.min(20, niveau)
    const e = parNiveau.get(pal) ?? { n: 0, g: 0, t: 0, perdus: 0, unites: 0 }
    e.n++
    e.t += bat.tour
    e.unites += B.unitesDe(bat, 0).length
    if (bat.fini === 'gagne') e.g++
    parNiveau.set(pal, e)

    for (const u of B.unitesDe(bat, 0)) {
      const s = parClasse.get(u.cl) ?? { n: 0, degats: 0, tues: 0, morts: 0 }
      s.n++
      s.degats += u.degats
      s.tues += u.tues
      if (u.pv <= 0) s.morts++
      parClasse.set(u.cl, s)
    }

    const r = Cie.bilan(c, bat)
    e.perdus += r.perdus.length

    // L'écart entre le niveau de la compagnie et celui de ses troupes.
    //
    // C'est lui qui décide si garder une troupe a un sens : les cartes de la
    // caserne sont créées AU niveau de la compagnie, donc dès que le niveau
    // global court devant les vétérans, acheter bat toujours conserver, et la
    // persistance — le sujet du jeu — ne veut plus rien dire.
    if (c.troupes.length) {
      const moy = c.troupes.reduce((s2, u) => s2 + u.niv, 0) / c.troupes.length
      const g = ecart.get(k) ?? { n: 0, cie: 0, moy: 0, gradesShop: 0 }
      g.n++
      g.cie += c.niveau
      g.moy += moy
      g.gradesShop += (c.offre?.caserne ?? []).filter((l) => U.gradeAtteint({ niv: l.niv, uq: null }) > 0).length
      ecart.set(k, g)
    }
  }
  finals.push({
    niveau: c.niveau,
    troupes: c.troupes.length,
    victoires: c.victoires,
    engagements: c.engagements,
    or: c.or,
  })
}

console.log('  par niveau de compagnie —')
for (const pal of [...parNiveau.keys()].sort((a, b) => a - b)) {
  const e = parNiveau.get(pal)
  console.log(
    `    niv ${String(pal).padStart(2)} · ${String(e.n).padStart(3)} batailles · ` +
      `${((e.g / e.n) * 100).toFixed(0).padStart(3)} % gagnées · ` +
      `${(e.t / e.n).toFixed(1).padStart(4)} tours · ` +
      `${(e.unites / e.n).toFixed(1)} troupes alignées · ` +
      `${(e.perdus / e.n).toFixed(2)} perte(s) par bataille`,
  )
}

console.log('\n  par objectif —')
for (const o of OBJECTIFS) {
  const e = parObjectif.get(o.id)
  if (!e) continue
  console.log(
    `    ${o.nom.padEnd(18)} ${((e.g / e.n) * 100).toFixed(0).padStart(3)} % · ${(e.t / e.n).toFixed(1)} tours · ` +
      `${String(e.n).padStart(4)} fois · résolu par l’objectif ${((e.parObj / e.n) * 100).toFixed(0).padStart(3)} % ` +
      `· par massacre ${((e.parMassacre / e.n) * 100).toFixed(0).padStart(3)} %`,
  )
}

console.log('\n  par classe (celles jamais alignées sont du remplissage) —')
const alignees = [...parClasse.entries()].sort((a, b) => b[1].degats / b[1].n - a[1].degats / a[1].n)
for (const [id, s] of alignees) {
  console.log(
    `    ${id.padEnd(13)} ${String(s.n).padStart(4)} sorties · ${(s.degats / s.n).toFixed(0).padStart(4)} dégâts · ` +
      `${(s.tues / s.n).toFixed(2)} mise(s) hors de combat · ${((s.morts / s.n) * 100).toFixed(0)} % tombée`,
  )
}
const jamais = CLASSES.filter((c) => !parClasse.has(c.id))
if (jamais.length) console.log(`    ⚠ jamais alignées : ${jamais.map((c) => c.id).join(', ')}`)

console.log('\n  fin de campagne —')
const moy = (f) => finals.reduce((s, x) => s + f(x), 0) / finals.length
console.log(
  `    niveau ${moy((x) => x.niveau).toFixed(1)} · ${moy((x) => x.victoires).toFixed(1)}/${moy((x) => x.engagements).toFixed(1)} victoires · ` +
    `${moy((x) => x.troupes).toFixed(1)} troupes · ${moy((x) => x.or).toFixed(0)} or`,
)
console.log(`    plus haut niveau atteint : ${Math.max(...finals.map((x) => x.niveau))}`)
if (sansFin) console.log(`    ⚠ ${sansFin} bataille(s) sans fin`)

// --- Le duel des types ---------------------------------------------------------------
//
// Une matrice qui se lit d'un coup : personne ne doit gagner contre tout le
// monde, et personne ne doit perdre contre tout le monde.

console.log('\n  niveau de la compagnie contre niveau des troupes —')
console.log('    engagement   compagnie   troupes   écart   cartes gradées en caserne')
for (const k of [...ecart.keys()].sort((a, b) => a - b)) {
  if (k % 3) continue
  const g = ecart.get(k)
  const cie = g.cie / g.n
  const moy = g.moy / g.n
  console.log(
    `    ${String(k + 1).padStart(9)}   ${cie.toFixed(1).padStart(9)}   ${moy.toFixed(1).padStart(7)}   ` +
      `${(cie - moy).toFixed(1).padStart(5)}   ${(g.gradesShop / g.n).toFixed(1)} sur 6`,
  )
}

// Sur une plaine nue, les troupes légères perdaient tous leurs duels : toute
// leur fiche tient dans l'embuscade, et il n'y avait pas un bosquet. On mesure
// donc sur un vrai terrain généré, comme dans le jeu.
console.log('\n  duels de types, à force égale, en bocage (10 batailles chacun) —')
const carte = (n) => genereCarte(9000 + n, 11, 9, 'bocage')
const entete = '            ' + TYPES.map((t) => t.court.padStart(5)).join('')
console.log(entete)
for (const a of TYPES) {
  const ligne = []
  for (const b of TYPES) {
    let g = 0
    const total = 10
    for (let k = 0; k < total; k++) {
      const rng = melange32(k * 31 + 7)
      const clA = CLASSES.filter((c) => c.type === a.id && c.rang <= 8)
      const clB = CLASSES.filter((c) => c.type === b.id && c.rang <= 8)
      const champ = carte(k)
      const occupe = new Set()
      const pose = (cl, camp, col, lig) => {
        const h = placeLibre(champ, versAxial(col, lig), occupe)
        occupe.add(cle(h.q, h.r))
        return B.engage(U.creeGenerique(cl, 6, camp ? 'B' : 'A', 'X'), camp, h.q, h.r)
      }
      const mien = Array.from({ length: 4 }, (_, i) => pose(clA[i % clA.length].id, 0, 0, 2 + i))
      const sien = Array.from({ length: 4 }, (_, i) => pose(clB[i % clB.length].id, 1, 10, 2 + i))
      const bat = B.commence(champ, { id: 'annihilation' }, mien, sien, { toursMax: 24 })
      joue(bat, 0)
      if (bat.fini === 'gagne') g++
    }
    ligne.push(String(Math.round((g / total) * 100)).padStart(5))
  }
  console.log('    ' + a.court.padEnd(8) + ligne.join(''))
}
