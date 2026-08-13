/**
 * L'identité de la borne : un terminal à phosphore ambré.
 *
 * Fond presque noir légèrement vert, une seule couleur d'accent (l'ambre) qui
 * porte tout ce qui compte, et trois teintes secondaires pour distinguer les
 * jeux entre eux. Rien d'autre — c'est la contrainte qui fait tenir l'ensemble.
 */
export const C = {
  fond: '#0b0e0d',
  panneau: '#141a18',
  bord: '#27332e',
  texte: '#d6e0d9',
  faible: '#5d6f66',

  accent: '#ffb43c', // l'ambre, l'identité
  vert: '#5ddb8a',
  cyan: '#49d3cf',
  violet: '#b98cff',
  rouge: '#ff5f56',
}

/**
 * Éclaircit (k > 0) ou assombrit (k < 0) une couleur de la palette.
 *
 * C'est ce qui permet le relief : un bloc n'est pas un aplat mais un corps,
 * une arête claire en haut et une arête sombre en bas. Le résultat est mis en
 * cache — la fonction est appelée des centaines de fois par image.
 */
const cache = new Map()

export function ton(hex, k) {
  const cle = hex + '|' + k
  const connu = cache.get(cle)
  if (connu) return connu

  const cible = k > 0 ? [255, 255, 255] : [6, 8, 7]
  const t = Math.min(1, Math.abs(k))
  const n = parseInt(hex.slice(1), 16)
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  const sortie =
    '#' +
    c
      .map((v, i) =>
        Math.round(v + (cible[i] - v) * t)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  cache.set(cle, sortie)
  return sortie
}
