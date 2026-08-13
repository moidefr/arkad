/**
 * Le champ de bataille : le terrain, les zones de déploiement, l'objectif.
 *
 * Tout sort d'une graine. Deux joueurs qui tombent sur la même graine au même
 * niveau se battent sur le même terrain — et un test qui échoue réechoue.
 */
import { melange32, derive, entre, parmi } from './rng.js'
import { INDICE, T, BIOMES, terrainDe } from './terrain.js'
import { versAxial, versOffset, distance, voisins } from './hex.js'

export const dans = (carte, col, lig) => col >= 0 && lig >= 0 && col < carte.cols && lig < carte.rows

export const indice = (carte, col, lig) => lig * carte.cols + col

/** Le terrain sous un hexagone axial. Hors carte : `null`, jamais une exception. */
export function terrainA(carte, q, r) {
  const { col, lig } = versOffset(q, r)
  if (!dans(carte, col, lig)) return null
  return terrainDe(carte.cases[indice(carte, col, lig)])
}

export function poseTerrain(carte, q, r, id) {
  const { col, lig } = versOffset(q, r)
  if (!dans(carte, col, lig)) return false
  carte.cases[indice(carte, col, lig)] = INDICE[id]
  return true
}

/** Tous les hexagones de la carte, en axial. */
export function toutes(carte) {
  const t = []
  for (let lig = 0; lig < carte.rows; lig++) {
    for (let col = 0; col < carte.cols; col++) t.push(versAxial(col, lig))
  }
  return t
}

// --- Génération ---------------------------------------------------------------

/**
 * Une tache de terrain : on part d'un centre et on avance au hasard, en
 * s'écartant. Un cercle parfait se voit comme un cercle parfait ; une marche
 * aléatoire donne des bosquets et des marécages qui ont l'air d'avoir poussé.
 */
function tache(rng, carte, id, taille) {
  let col = entre(rng, 0, carte.cols - 1)
  let lig = entre(rng, 0, carte.rows - 1)
  const n = Math.max(1, Math.round(taille * (0.6 + rng())))
  for (let i = 0; i < n * 2 && i < 60; i++) {
    if (dans(carte, col, lig)) carte.cases[indice(carte, col, lig)] = INDICE[id]
    const d = Math.floor(rng() * 6)
    col += [1, 1, 0, -1, -1, 0][d]
    lig += [0, -1, -1, 0, 1, 1][d]
    if (!dans(carte, col, lig)) {
      col = Math.min(carte.cols - 1, Math.max(0, col))
      lig = Math.min(carte.rows - 1, Math.max(0, lig))
    }
  }
}

/** Une rivière du haut vers le bas, avec ce qu'il faut de gués pour la passer. */
function riviere(rng, carte) {
  let col = entre(rng, Math.floor(carte.cols * 0.3), Math.ceil(carte.cols * 0.7))
  const passages = new Set()
  const combien = Math.max(2, Math.round(carte.rows / 4))
  for (let i = 0; i < combien; i++) passages.add(entre(rng, 0, carte.rows - 1))
  for (let lig = 0; lig < carte.rows; lig++) {
    const id = passages.has(lig) ? (rng() < 0.4 ? 'pont' : 'gue') : 'riviere'
    if (dans(carte, col, lig)) carte.cases[indice(carte, col, lig)] = INDICE[id]
    if (rng() < 0.45) col += rng() < 0.5 ? -1 : 1
    col = Math.min(carte.cols - 2, Math.max(1, col))
  }
}

/** Une route de bord à bord : c'est elle qui rend une cavalerie dangereuse. */
function route(rng, carte) {
  let lig = entre(rng, 1, carte.rows - 2)
  for (let col = 0; col < carte.cols; col++) {
    const t = terrainDe(carte.cases[indice(carte, col, lig)])
    // Une route qui rencontre l'eau devient un pont : sinon on pave la rivière.
    const id = t.id === 'riviere' || t.id === 'eau' ? 'pont' : 'route'
    carte.cases[indice(carte, col, lig)] = INDICE[id]
    if (rng() < 0.35) lig += rng() < 0.5 ? -1 : 1
    lig = Math.min(carte.rows - 1, Math.max(0, lig))
  }
}

/**
 * Les colonnes de déploiement doivent rester praticables : une montagne
 * pile sur la ligne de départ enferme une armée avant le premier tour.
 */
function degage(carte, colonnes) {
  for (const col of colonnes) {
    for (let lig = 0; lig < carte.rows; lig++) {
      const t = terrainDe(carte.cases[indice(carte, col, lig)])
      if (t.bloque || t.cout > 2) carte.cases[indice(carte, col, lig)] = INDICE.plaine
    }
  }
}

export function genereCarte(graine, cols, rows, biomeId) {
  const rng = melange32(derive(graine, 11, cols, rows))
  const biome = BIOMES.find((b) => b.id === biomeId) ?? BIOMES[0]
  const carte = { cols, rows, biome: biome.id, cases: new Array(cols * rows).fill(INDICE[biome.fond]) }

  for (const t of biome.taches) {
    const n = Math.max(1, Math.round((t.n * cols * rows) / 90))
    for (let i = 0; i < n; i++) tache(rng, carte, t.t, t.taille)
  }
  if (biome.riviere) riviere(rng, carte)
  if (rng() < (biome.route ?? 0.5)) route(rng, carte)

  degage(carte, [0, 1, cols - 2, cols - 1])
  return carte
}

// --- Déploiement ---------------------------------------------------------------

/** Les hexagones où un camp peut poser ses troupes : deux colonnes de son bord. */
export function zoneDeploiement(carte, camp, largeur = 2) {
  const t = []
  for (let i = 0; i < largeur; i++) {
    const col = camp === 0 ? i : carte.cols - 1 - i
    for (let lig = 0; lig < carte.rows; lig++) {
      const terr = terrainDe(carte.cases[indice(carte, col, lig)])
      if (!terr.bloque) t.push(versAxial(col, lig))
    }
  }
  return t
}

// --- Objectifs -----------------------------------------------------------------

/**
 * Cinq objectifs, et chacun change la façon de jouer la même carte : on
 * n'avance pas de la même manière pour anéantir que pour percer. C'est ce qui
 * fait qu'une bataille de niveau 14 n'est pas une bataille de niveau 3 avec
 * plus de monde.
 */
export const OBJECTIFS = [
  {
    id: 'annihilation',
    nom: 'ANÉANTIR',
    court: 'ANÉANTIR',
    texte: 'Mettre hors de combat toute la troupe adverse.',
    rang: 1,
  },
  {
    id: 'capture',
    nom: 'TENIR LES POINTS',
    court: 'TENIR',
    texte: 'Occuper la majorité des points marqués à la fin de trois tours.',
    rang: 3,
    points: true,
  },
  {
    id: 'decapitation',
    nom: 'DÉCAPITER',
    court: 'DÉCAPITER',
    texte: 'Abattre l’officier adverse. Le reste se rendra.',
    rang: 5,
  },
  {
    id: 'percee',
    nom: 'PERCER',
    court: 'PERCER',
    texte: 'Faire passer deux troupes par le bord adverse.',
    rang: 7,
  },
  {
    id: 'survie',
    nom: 'TENIR LE CHOC',
    court: 'TENIR BON',
    texte: 'Tenir jusqu’au dernier tour. L’ennemi est en force.',
    rang: 9,
  },
]

export const OBJ = Object.fromEntries(OBJECTIFS.map((o) => [o.id, o]))

/**
 * Les points à tenir, semés dans **le tiers central** et jamais sur un
 * obstacle.
 *
 * Mesuré au banc : semés n'importe où entre les deux zones de déploiement,
 * ils tombaient régulièrement du côté adverse, l'ennemi les occupait dès le
 * premier tour et la bataille était perdue au troisième — 10 % de victoires
 * sur cet objectif contre 24 % pour les autres. Un point à tenir doit être à
 * conquérir par les deux camps, pas offert à l'un d'eux.
 *
 * Leur nombre est **toujours impair** : avec deux points, « la majorité »
 * voulait dire les deux, et l'objectif devenait un tout-ou-rien.
 */
export function pointsCapture(graine, carte, combien) {
  const rng = melange32(derive(graine, 77))
  const impair = combien % 2 ? combien : combien + 1
  const gauche = Math.max(2, Math.floor(carte.cols * 0.32))
  const droite = Math.min(carte.cols - 3, Math.ceil(carte.cols * 0.68))
  const t = []
  const vus = new Set()
  for (let essai = 0; essai < 400 && t.length < impair; essai++) {
    const col = entre(rng, Math.min(gauche, droite), Math.max(gauche, droite))
    const lig = entre(rng, 0, carte.rows - 1)
    const terr = terrainDe(carte.cases[indice(carte, col, lig)])
    if (terr.bloque) continue
    const a = versAxial(col, lig)
    if (t.some((p) => distance(p.q, p.r, a.q, a.r) < 2)) continue
    const k = col + ':' + lig
    if (vus.has(k)) continue
    vus.add(k)
    t.push(a)
  }
  return t
}

/** Un hexagone libre autour de `a`, pour poser une troupe sans en écraser une autre. */
export function placeLibre(carte, a, occupe) {
  const file = [a]
  const vus = new Set([a.q + ':' + a.r])
  while (file.length) {
    const h = file.shift()
    const t = terrainA(carte, h.q, h.r)
    if (t && !t.bloque && !occupe.has(h.q + ':' + h.r)) return h
    for (const v of voisins(h.q, h.r)) {
      const k = v.q + ':' + v.r
      if (vus.has(k)) continue
      vus.add(k)
      if (terrainA(carte, v.q, v.r)) file.push(v)
    }
  }
  return null
}

/** Le biome d'un engagement : il tourne, pour qu'on ne se batte pas deux fois au même endroit. */
export const biomePour = (graine, n) => parmi(melange32(derive(graine, 913, n)), BIOMES).id

export { T }
