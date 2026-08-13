/**
 * Un hasard reproductible, partagé.
 *
 * `Math.random()` convient à un jeu de trois minutes qui ne se sauvegarde pas.
 * Dès qu'une partie s'écrit sur le disque, il faut que la reprise redonne la
 * même chose : sinon fermer l'application au bon moment est un moyen de
 * retirer une main qui ne plaît pas. Une graine dans la sauvegarde et un
 * compteur suffisent — et un test qui échoue réechoue.
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

/** Une sous-graine stable : même partie, même tirage, quelle que soit la reprise. */
export function derive(graine, ...parts) {
  let h = graine >>> 0
  for (const p of parts) {
    h = (Math.imul(h ^ (p >>> 0), 0x9e3779b1) + 0x85ebca6b) >>> 0
    h ^= h >>> 13
  }
  return h >>> 0
}

export const entre = (rng, a, b) => a + Math.floor(rng() * (b - a + 1))
export const parmi = (rng, liste) => liste[Math.floor(rng() * liste.length)]

export function melange(rng, liste) {
  const t = [...liste]
  for (let i = t.length - 1; i > 0; i--) {
    const k = Math.floor(rng() * (i + 1))
    ;[t[i], t[k]] = [t[k], t[i]]
  }
  return t
}

/** Tirage pondéré. `poids(x)` peut renvoyer 0 : l'élément est alors hors du sac. */
export function pondere(rng, liste, poids) {
  let total = 0
  for (const x of liste) total += Math.max(0, poids(x))
  if (total <= 0) return null
  let d = rng() * total
  for (const x of liste) {
    d -= Math.max(0, poids(x))
    if (d <= 0) return x
  }
  return liste[liste.length - 1]
}
