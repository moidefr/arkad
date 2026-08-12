/**
 * Le banc d'équilibrage d'ANOMALIE.
 *
 * Il joue des milliers de combats sans rendu et imprime qui gagne, contre
 * quoi, en combien de tours et à quel prix. C'est le seul moyen de tenir la
 * promesse « aucune combinaison surpuissante » sur un jeu de plusieurs
 * centaines de fiches : ASCENSION est mort de n'avoir jamais été mesuré — sa
 * touche GARDE ne faisait perdre de points de vie à personne, et on pouvait
 * ramasser les huit reliques du jeu dès le quatrième rang.
 *
 *   node test/anomalie-banc.mjs [combats par cas]
 */
import * as K from '../src/massif/anomalie/combat.js'
import * as IA from '../src/massif/anomalie/ia.js'
import * as E from '../src/massif/anomalie/etat.js'
import { COMP } from '../src/massif/anomalie/donnees/competences.js'
import { CLASSES } from '../src/massif/anomalie/donnees/classes.js'
import { PROCESSUS, NOYAUX } from '../src/massif/anomalie/donnees/ennemis.js'
import { melange32 } from '../src/massif/anomalie/rng.js'

const PAR_CAS = Number(process.argv[2] ?? 40)

/**
 * Une équipe, garnie de `extra` compétences prises dans la réserve de chaque
 * classe. Mesurer des opérateurs à deux compétences ne dit rien : avec deux
 * options, jouer au hasard revient à jouer au mieux. C'est justement l'écart
 * entre les deux qui doit prouver que les choix comptent.
 */
const equipe = (cl, extra = 0, decalage = 0) =>
  cl.map((c, i) => {
    const op = E.nouvelOperateur(c, 'OP' + i)
    const reserve = CLASSES.find((x) => x.id === c).reserve
    for (let k = 0; k < extra; k++) {
      const libre = op.comp.indexOf(null)
      if (libre < 0) break
      op.comp[libre] = reserve[(k + decalage + i) % reserve.length]
    }
    return op
  })

/** Glouton : le plus fort dégât immédiat, sinon le meilleur soin, sinon n'importe quoi. */
export function gourmand(c, u) {
  let meilleur = null
  for (let k = 0; k < u.comp.length; k++) {
    const comp = COMP[u.comp[k]]
    if (!K.jouable(c, u, comp, k)) continue
    for (const cible of K.cibles(c, u, comp)) {
      let valeur = 0
      if (comp.base) {
        const cibles = K.touches(c, u, comp, cible)
        valeur = cibles.reduce((s, x) => s + K.degats(c, u, comp, x).final, 0)
      } else if (comp.soin) {
        valeur = Math.min(comp.soin, cible.pvMax - cible.pv) * 0.8
      } else valeur = 4
      if (!meilleur || valeur > meilleur.v) meilleur = { k, cible, v: valeur }
    }
  }
  return meilleur
}

/** Prudent : soigne dès qu'un opérateur passe sous 40 %, sinon glouton. */
function prudent(c, u) {
  const mal = K.vivants(c.ops).find((o) => o.pv < o.pvMax * 0.4)
  if (mal) {
    for (let k = 0; k < u.comp.length; k++) {
      const comp = COMP[u.comp[k]]
      if (!comp?.soin || !K.jouable(c, u, comp, k)) continue
      if (K.cibles(c, u, comp).includes(mal)) return { k, cible: mal }
    }
  }
  return gourmand(c, u)
}

/** Hasard : une action légale au hasard. Sert de plancher — si le hasard gagne, les choix ne comptent pas. */
function auHasard(c, u, rng) {
  const options = []
  for (let k = 0; k < u.comp.length; k++) {
    const comp = COMP[u.comp[k]]
    if (!K.jouable(c, u, comp, k)) continue
    for (const cible of K.cibles(c, u, comp)) options.push({ k, cible })
  }
  return options.length ? options[Math.floor(rng() * options.length)] : null
}

const POLITIQUES = { gourmand, prudent, hasard: auHasard }

export function combat(classes, rencontre, politique = 'gourmand', graine = 1, plafond = 400, extra = 4) {
  const rng = melange32(graine)
  const c = K.commence(equipe(classes, extra, graine), rencontre)
  IA.annonce(c)
  let tours = 0
  while (!K.fini(c) && tours < plafond) {
    const u = K.actif(c)
    if (!u) break
    K.ouvreTour(c, u)
    K.recharge(u)
    if (!K.estOperateur(c, u)) {
      IA.tourProcessus(c, u)
    } else {
      const choix = POLITIQUES[politique](c, u, rng)
      if (choix) K.joue(c, u, choix.k, choix.cible)
      else K.passe(c, u)
    }
    IA.annonce(c)
    tours++
  }
  const reste = K.vivants(c.ops).reduce((s, o) => s + o.pv, 0)
  const plein = c.ops.reduce((s, o) => s + o.pvMax, 0)
  return { issue: K.fini(c) ?? 'sansfin', tours, sante: reste / plein }
}

// --- Le balayage ------------------------------------------------------------------------

const compositions = []
for (let a = 0; a < CLASSES.length; a++) {
  for (let b = a + 1; b < CLASSES.length; b++) {
    for (let d = b + 1; d < CLASSES.length; d++) compositions.push([CLASSES[a].id, CLASSES[b].id, CLASSES[d].id])
  }
}
if (!compositions.length) compositions.push(CLASSES.map((c) => c.id))

const rng = melange32(20260812)
const tirages = []
for (let n = 0; n < PAR_CAS; n++) {
  const combien = 1 + Math.floor(rng() * 4)
  tirages.push(Array.from({ length: combien }, () => PROCESSUS[Math.floor(rng() * PROCESSUS.length)].id))
}

console.log(`${compositions.length} composition(s) × ${PAR_CAS} rencontres × 3 politiques\n`)

for (const politique of ['gourmand', 'prudent', 'hasard']) {
  let gagnes = 0
  let total = 0
  let tours = 0
  let sante = 0
  let sansFin = 0
  for (const comp of compositions) {
    for (let n = 0; n < tirages.length; n++) {
      const r = combat(comp, tirages[n], politique, 1000 + n)
      total++
      tours += r.tours
      if (r.issue === 'gagne') {
        gagnes++
        sante += r.sante
      }
      if (r.issue === 'sansfin') sansFin++
    }
  }
  console.log(
    `  ${politique.padEnd(9)} ${((gagnes / total) * 100).toFixed(0).padStart(3)} % de victoires · ` +
      `${(tours / total).toFixed(0).padStart(3)} tours · ` +
      `${((sante / Math.max(1, gagnes)) * 100).toFixed(0).padStart(3)} % d'intégrité restante` +
      (sansFin ? `  ⚠ ${sansFin} combats sans fin` : ''),
  )
}

console.log('\n  par rencontre (glouton) :')
const parProc = new Map()
for (const p of PROCESSUS) parProc.set(p.id, { n: 0, g: 0, t: 0 })
for (const comp of compositions) {
  for (let n = 0; n < tirages.length; n++) {
    const r = combat(comp, tirages[n], 'gourmand', 1000 + n)
    for (const id of new Set(tirages[n])) {
      const e = parProc.get(id)
      e.n++
      e.t += r.tours
      if (r.issue === 'gagne') e.g++
    }
  }
}
for (const [id, e] of parProc) {
  if (!e.n) continue
  console.log(`    ${id.padEnd(12)} ${((e.g / e.n) * 100).toFixed(0).padStart(3)} % · ${(e.t / e.n).toFixed(0)} tours`)
}

console.log('\n  noyaux (glouton) :')
for (const noyau of NOYAUX) {
  const rencontre = noyau.escorte ? [noyau.id, ...noyau.escorte] : [noyau.id]
  let g = 0
  let t = 0
  let s = 0
  const n = 24
  for (let k = 0; k < n; k++) {
    const r = combat(compositions[k % compositions.length], rencontre, 'gourmand', 500 + k, 600)
    t += r.tours
    if (r.issue === 'gagne') {
      g++
      s += r.sante
    }
  }
  console.log(
    `    ${noyau.nom.padEnd(20)} ${((g / n) * 100).toFixed(0).padStart(3)} % · ${(t / n).toFixed(0)} tours · ` +
      `${((s / Math.max(1, g)) * 100).toFixed(0)} % d'intégrité restante`,
  )
}
