/**
 * Un hasard reproductible.
 *
 * Toute une partie d'ANOMALIE découle d'une seule graine : la carte, les
 * rencontres, les offres de butin. Deux parties de même graine sont
 * identiques, ce qui rend une anomalie de jeu rejouable au lieu d'être une
 * histoire qu'on raconte. `Math.random` ne convient pas : il ne se rembobine
 * pas, et le moteur fournit `j.hasard` justement pour ça.
 */
export function melange32(graine) {
  let a = graine >>> 0
  return function () {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Une sous-graine stable : le nœud 3 de l'acte 2 tire toujours la même chose. */
export const sousGraine = (graine, ...cles) => {
  let h = graine >>> 0
  for (const k of cles) h = (Math.imul(h ^ (k + 0x9e3779b9), 0x85ebca6b) >>> 0) ^ (h >>> 13)
  return h >>> 0
}

export const entier = (rng, n) => Math.floor(rng() * n)
export const parmi = (rng, liste) => liste[Math.floor(rng() * liste.length)]

/** Tire `n` éléments distincts, sans modifier la liste d'origine. */
export function pioche(rng, liste, n) {
  const copie = liste.slice()
  const out = []
  while (out.length < n && copie.length) out.push(copie.splice(Math.floor(rng() * copie.length), 1)[0])
  return out
}
