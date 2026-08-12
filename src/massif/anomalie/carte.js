import { melange32, sousGraine, entier, parmi, pioche } from './rng.js'
import { PROCESSUS, NOYAUX } from './donnees/ennemis.js'

/**
 * La carte d'un acte : un graphe en couches, engendré depuis la graine.
 *
 * À chaque couche on choisit entre deux ou trois nœuds, et on ne voit jamais
 * tout un acte en une partie — c'est de là que vient la rejouabilité, pas de
 * la longueur des listes. La ligne droite du lot précédent servait à régler le
 * combat ; elle ne donnait aucune décision hors combat.
 *
 * Aucun nœud n'est rejouable : c'est la règle qui interdit structurellement la
 * boucle de farm sans risque d'ASCENSION.
 */

export const ACTES = [
  {
    n: 1,
    nom: 'PÉRIPHÉRIE',
    couches: 5,
    large: [1, 2, 3, 2, 1],
    bassin: ['veille', 'balise', 'tampon', 'boucle', 'essaim'],
    noyaux: ['n_veilleur'],
    force: 0,
    dit: 'La bordure du système. Rien n’y est encore hostile, seulement attentif.',
  },
  {
    n: 2,
    nom: 'CACHE',
    couches: 6,
    large: [1, 3, 3, 2, 3, 1],
    bassin: ['veille', 'balise', 'tampon', 'boucle', 'essaim', 'relais', 'salvateur'],
    noyaux: ['n_metier'],
    force: 2,
    dit: 'Ce que le système garde en mémoire vive. Ça se répare tout seul.',
  },
  {
    n: 3,
    nom: 'PILE',
    couches: 7,
    large: [1, 3, 3, 3, 2, 3, 1],
    bassin: ['tampon', 'boucle', 'sentinelle', 'relais', 'salvateur', 'rouille', 'garde'],
    noyaux: ['n_veilleur', 'n_metier'],
    force: 4,
    dit: 'Les appels s’empilent et ne redescendent plus. On y résiste, ou on y reste.',
  },
]

export const acteDe = (n) => ACTES[Math.min(ACTES.length, Math.max(1, n)) - 1]

/** Les types de nœud et leur glyphe sur la carte. */
export const TYPES = {
  processus: { glyphe: 'P', nom: 'PROCESSUS' },
  elite: { glyphe: 'É', nom: 'ÉLITE' },
  archive: { glyphe: 'A', nom: 'ARCHIVE' },
  atelier: { glyphe: 'R', nom: 'ATELIER' },
  marche: { glyphe: '$', nom: 'MARCHÉ' },
  noyau: { glyphe: 'X', nom: 'NOYAU' },
}

/**
 * Engendre le graphe.
 *
 * Chaque nœud est relié à un ou deux nœuds de la couche suivante, et **toute
 * couche est atteignable depuis toute couche précédente** : une carte où l'on
 * peut s'enfermer dans un cul-de-sac est une carte fausse. Un test le vérifie
 * sur des centaines de graines.
 */
export function engendre(graine, acteN) {
  const acte = acteDe(acteN)
  const rng = melange32(sousGraine(graine, acteN, 101))
  const couches = acte.large.map((n, i) =>
    Array.from({ length: n }, (_, k) => ({ couche: i, k, type: null, liens: [] })),
  )

  // Les liens d'abord : la forme du graphe décide de la difficulté ressentie
  // bien plus que le contenu des nœuds.
  for (let i = 0; i < couches.length - 1; i++) {
    const ici = couches[i]
    const suivante = couches[i + 1]
    ici.forEach((n, k) => {
      // On vise en face, puis on ouvre parfois une bifurcation d'un cran.
      const face = Math.min(suivante.length - 1, Math.round((k / Math.max(1, ici.length - 1)) * (suivante.length - 1)))
      n.liens.push(face)
      if (suivante.length > 1 && rng() < 0.55) {
        const autre = face + (rng() < 0.5 ? -1 : 1)
        if (autre >= 0 && autre < suivante.length) n.liens.push(autre)
      }
    })
    // Aucun nœud de la couche suivante ne doit rester inatteignable.
    suivante.forEach((_, k) => {
      if (ici.some((n) => n.liens.includes(k))) return
      const source =
        ici[Math.min(ici.length - 1, Math.round((k / Math.max(1, suivante.length - 1)) * (ici.length - 1)))]
      source.liens.push(k)
    })
    for (const n of ici) n.liens = [...new Set(n.liens)].sort((a, b) => a - b)
  }

  // Puis les types. La première couche est toujours un combat simple : on
  // n'ouvre pas un acte sur une boutique.
  couches.forEach((ligne, i) => {
    const dernier = i === couches.length - 1
    ligne.forEach((n, k) => {
      if (dernier) return (n.type = 'noyau')
      if (i === 0) return (n.type = 'processus')
      n.type = tireType(rng, i, couches.length, k)
    })
  })
  // Un acte doit offrir au moins un atelier et une archive, sinon la carte ne
  // propose rien à décider.
  garantit(couches, rng, 'atelier')
  garantit(couches, rng, 'archive')

  return { acte: acteN, couches }
}

function tireType(rng, i, total, k) {
  const t = rng()
  // Plus on descend, plus les élites remplacent les processus.
  const partElite = 0.05 + (i / total) * 0.2
  if (t < partElite) return 'elite'
  if (t < partElite + 0.2) return 'archive'
  if (t < partElite + 0.32) return 'atelier'
  if (t < partElite + 0.4) return 'marche'
  return 'processus'
}

function garantit(couches, rng, type) {
  const milieu = couches.slice(1, -1).flat()
  if (milieu.some((n) => n.type === type)) return
  const cible =
    parmi(
      rng,
      milieu.filter((n) => n.type === 'processus'),
    ) ?? milieu[0]
  if (cible) cible.type = type
}

// --- Le chemin ------------------------------------------------------------------------

export const noeudA = (carte, couche, k) => carte.couches[couche]?.[k] ?? null

/** Les nœuds accessibles depuis la position courante. Au départ, toute la première couche. */
export function accessibles(carte, position) {
  if (!position) return carte.couches[0].map((_, k) => ({ couche: 0, k }))
  const n = noeudA(carte, position.couche, position.k)
  if (!n) return []
  return n.liens.map((k) => ({ couche: position.couche + 1, k }))
}

export const termine = (carte, position) => position && position.couche >= carte.couches.length - 1

// --- Le contenu d'un nœud -----------------------------------------------------------------

/**
 * La rencontre d'un nœud, tirée d'une sous-graine stable : revenir sur la même
 * partie retrouve exactement les mêmes processus.
 */
export function rencontre(graine, acteN, couche, k, type) {
  const acte = acteDe(acteN)
  const rng = melange32(sousGraine(graine, acteN, couche, k, 11))
  if (type === 'noyau') {
    // Le tirage se fait **une fois**, avant la recherche : écrit à l'intérieur
    // du prédicat, il retirait un identifiant différent à chaque candidat et ne
    // trouvait souvent aucun des deux noyaux de l'acte.
    const id = parmi(rng, acte.noyaux)
    const noyau = NOYAUX.find((n) => n.id === id)
    return noyau.escorte ? [noyau.id, ...noyau.escorte] : [noyau.id]
  }
  const bassin = PROCESSUS.filter((p) => acte.bassin.includes(p.id))
  const dur = type === 'elite'
  const combien = Math.min(4, (dur ? 3 : 1) + Math.floor(acte.force / 2) + entier(rng, 2))
  return pioche(rng, bassin, Math.min(combien, bassin.length)).map((p) => p.id)
}
