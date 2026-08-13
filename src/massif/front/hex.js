/**
 * La grille hexagonale — coordonnées axiales `q, r`, hexagones pointe en haut.
 *
 * Six voisins au lieu de huit, et **aucune diagonale à moitié gratuite** : sur
 * un damier, se déplacer en diagonale coûte le même prix qu'un pas droit tout
 * en couvrant 1,41 fois la distance, si bien que tout le monde joue en
 * diagonale. L'hexagone supprime le problème : les six voisins sont
 * équidistants, donc une distance sur la carte est la distance réelle.
 *
 * Rien ici ne connaît le canvas — `versEcran` rend des unités logiques, la vue
 * s'occupe de la caméra.
 */

/** Les six directions, dans le sens horaire depuis l'est. */
export const DIRS = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
]

export const cle = (q, r) => q + ':' + r

export const decle = (k) => {
  const [q, r] = k.split(':')
  return { q: +q, r: +r }
}

export const voisins = (q, r) => DIRS.map(([dq, dr]) => ({ q: q + dq, r: r + dr }))

/** Distance en pas d'hexagone : la moitié de la somme des trois axes cubiques. */
export const distance = (aq, ar, bq, br) => (Math.abs(aq - bq) + Math.abs(aq + ar - bq - br) + Math.abs(ar - br)) / 2

/** Tous les hexagones à `n` pas ou moins, centre compris. */
export function rayon(q, r, n) {
  const t = []
  for (let dq = -n; dq <= n; dq++) {
    for (let dr = Math.max(-n, -dq - n); dr <= Math.min(n, -dq + n); dr++) t.push({ q: q + dq, r: r + dr })
  }
  return t
}

/** L'anneau exact à `n` pas. Sert aux souffles et aux auras dessinées. */
export function anneau(q, r, n) {
  if (n <= 0) return [{ q, r }]
  const t = []
  let cq = q + DIRS[4][0] * n
  let cr = r + DIRS[4][1] * n
  for (let d = 0; d < 6; d++) {
    for (let i = 0; i < n; i++) {
      t.push({ q: cq, r: cr })
      cq += DIRS[d][0]
      cr += DIRS[d][1]
    }
  }
  return t
}

// --- Arrondi cubique ----------------------------------------------------------

/** Arrondit des coordonnées fractionnaires vers l'hexagone réel. */
export function arrondi(q, r) {
  const s = -q - r
  let rq = Math.round(q)
  let rr = Math.round(r)
  let rs = Math.round(s)
  const dq = Math.abs(rq - q)
  const dr = Math.abs(rr - r)
  const ds = Math.abs(rs - s)
  if (dq > dr && dq > ds) rq = -rr - rs
  else if (dr > ds) rr = -rq - rs
  // `Math.round(-0.2)` rend `-0`, qui n'est égal à `0` que par `==` : sans ce
  // rattrapage, une clé d'hexagone s'écrit tantôt « 0:1 », tantôt « -0:1 ».
  return { q: rq === 0 ? 0 : rq, r: rr === 0 ? 0 : rr }
}

/**
 * La ligne droite entre deux hexagones, extrémités comprises.
 *
 * Le décalage d'un millième évite les cas où la droite passe exactement sur
 * une arête : sans lui, la ligne de vue choisit un côté au hasard de
 * l'arrondi, et un mur bloque ou ne bloque pas selon le sens du regard.
 */
export function ligne(aq, ar, bq, br) {
  const n = distance(aq, ar, bq, br)
  if (n === 0) return [{ q: aq, r: ar }]
  const t = []
  for (let i = 0; i <= n; i++) {
    const k = i / n
    t.push(arrondi(aq + (bq - aq + 1e-3) * k, ar + (br - ar + 1e-3) * k))
  }
  return t
}

// --- Écran --------------------------------------------------------------------

export const RACINE3 = Math.sqrt(3)

/** Centre de l'hexagone en unités logiques, pour un rayon circonscrit `R`. */
export function versEcran(q, r, R) {
  return { x: R * RACINE3 * (q + r / 2), y: R * 1.5 * r }
}

/** L'inverse : quel hexagone se trouve sous ce point ? */
export function versHex(x, y, R) {
  return arrondi(((RACINE3 / 3) * x - y / 3) / R, ((2 / 3) * y) / R)
}

/** Encombrement d'un hexagone pointe en haut. */
export const largeurHex = (R) => RACINE3 * R
export const hauteurHex = (R) => 2 * R

// --- Grilles rectangulaires ---------------------------------------------------
//
// Les champs de bataille sont rangés en lignes et colonnes — c'est plus simple
// à générer et à afficher qu'un losange. La conversion « odd-r » décale une
// ligne sur deux, ce qui donne le nid d'abeille attendu.

export const versAxial = (col, lig) => ({ q: col - ((lig - (lig & 1)) >> 1), r: lig })

export function versOffset(q, r) {
  return { col: q + ((r - (r & 1)) >> 1), lig: r }
}
