/**
 * Les règles de BRÈCHE. **Aucun dessin, aucun stockage** : ce fichier tourne
 * sous `node --test` sans navigateur, et c'est ce qui permet de mesurer des
 * milliers de parties avant d'en dessiner une.
 *
 * Le jeu tient en une phrase : trois pièces en main, on les pose sur la
 * grille, les lignes et colonnes pleines éclatent, et c'est fini quand aucune
 * des pièces restantes ne rentre nulle part. Tout le reste — les mondes, les
 * transformations, la crue, le givre — n'existe que pour changer ce que
 * « rentrer quelque part » veut dire.
 *
 * **Le tirage est reproductible.** La main sort d'une graine et d'un compteur
 * de poses, tous deux dans la sauvegarde : fermer l'application au bon moment
 * ne permet pas de retirer une main qui ne plaît pas.
 */
import { melange32, derive, pondere } from '../../hasard.js'
import { PIECES, PIECE, TRANSFO, TRANSFOS, encombrement, TEINTES, palierDe, PAR_PALIER } from './donnees.js'
import * as Dir from './directeur.js'

export const VERSION = 1
export const EN_MAIN = 3

// --- La grille ------------------------------------------------------------------

export const indice = (p, c, l) => l * p.taille + c
export const dans = (p, c, l) => c >= 0 && l >= 0 && c < p.taille && l < p.taille
export const pleine = (p, c, l) => dans(p, c, l) && p.cases[indice(p, c, l)] > 0

const rngDe = (p, ...sel) => melange32(derive(p.graine, p.poses, ...sel))

/** Le tirage a son propre compteur : l'échange ne doit pas décaler la crue. */
const rngTirage = (p, k) => melange32(derive(p.graine, p.tirages ?? 0, k, 77))

// --- Création et mondes ------------------------------------------------------------

export const TAILLE = 8

/**
 * Une partie neuve. Un plateau vide, trois pièces, et rien devant : pas
 * d'objectif, pas de monde suivant, pas de fin prévue. On joue jusqu'à ne
 * plus pouvoir poser.
 */
export function nouvelle(graine) {
  const total = TAILLE * TAILLE
  const p = {
    v: VERSION,
    graine: graine >>> 0,
    score: 0,
    poses: 0,
    tirages: 0,
    combo: 0,
    meilleurCombo: 0,
    lignes: 0,
    taille: TAILLE,
    cases: new Array(total).fill(0),
    spec: new Array(total).fill(''),
    gel: new Array(total).fill(0),
    main: [],
    outils: { marteau: 1, echange: 1 },
    // L'estimation du directeur. Elle vit dans la sauvegarde : reprendre une
    // partie trois jours plus tard doit reprendre au même niveau de jeu.
    aisance: Dir.AISANCE_INITIALE,
    fini: false,
  }
  tireMain(p)
  return p
}

/** Le palier courant : il ne sert qu'à choisir la bande-son. */
export const palier = (p) => palierDe(p.score)

// --- La main -------------------------------------------------------------------------

/**
 * Trois pièces neuves. On ne retire jamais tant qu'il en reste une : c'est
 * cette contrainte qui oblige à garder de la place pour ce qu'on n'a pas
 * encore vu.
 */
export function tireMain(p) {
  p.tirages = (p.tirages ?? 0) + 1
  const rng = rngTirage(p, 999)
  // Le vivier n'est plus fixe : le directeur l'incline vers les grosses pièces
  // quand on joue bien, vers les maniables quand on s'enlise. Il ne retire
  // jamais rien du vivier, il ne change que les proportions.
  const entrees = Dir.vivier(p)
  p.main = Array.from({ length: EN_MAIN }, (_, k) => Dir.tire(entrees, rngTirage(p, k)).id)

  // La garantie d'honnêteté : une main dont aucune pièce n'entre est une mort
  // qu'on n'a pas méritée. Perdre doit venir du plateau qu'on a construit.
  if (!p.main.some((id) => id && placeExiste(p, id))) {
    const secours = PIECES.filter((x) => placeExiste(p, x.id))
    if (secours.length) p.main[0] = secours[Math.floor(rng() * secours.length)].id
  }
  return p.main
}

/**
 * Combien de placements la main offre en tout — le signal que lit le directeur.
 *
 * `placesPossibles` rend un **nombre**, pas un tableau : lui demander sa
 * `.length` donnait `undefined`, et l'aisance entière finissait à `NaN` sans
 * que rien ne plante. C'est le banc qui l'a montré, pas les tests.
 */
export const placesEnMain = (p) => p.main.reduce((n, id) => n + (id ? placesPossibles(p, id) : 0), 0)

export const mainVide = (p) => p.main.every((x) => !x)

// --- Poser --------------------------------------------------------------------------

/** Toutes les cases qu'occuperait la pièce, posée avec son coin en (c, l). */
export const empreinte = (pieceId, c, l) => PIECE[pieceId].cases.map(([dc, dl]) => ({ c: c + dc, l: l + dl }))

export function peutPoser(p, pieceId, c, l) {
  if (!pieceId || p.fini) return false
  for (const e of empreinte(pieceId, c, l)) {
    if (!dans(p, e.c, e.l) || p.cases[indice(p, e.c, e.l)] > 0) return false
  }
  return true
}

/** Existe-t-il au moins un endroit où cette pièce rentre ? */
export function placeExiste(p, pieceId) {
  if (!pieceId) return false
  const { w, h } = encombrement(PIECE[pieceId])
  for (let l = 0; l <= p.taille - h; l++) {
    for (let c = 0; c <= p.taille - w; c++) if (peutPoser(p, pieceId, c, l)) return true
  }
  return false
}

/** Le nombre d'emplacements légaux : c'est ce qu'affiche la vignette d'une pièce. */
export function placesPossibles(p, pieceId) {
  if (!pieceId) return 0
  let n = 0
  const { w, h } = encombrement(PIECE[pieceId])
  for (let l = 0; l <= p.taille - h; l++) {
    for (let c = 0; c <= p.taille - w; c++) if (peutPoser(p, pieceId, c, l)) n++
  }
  return n
}

/** Fini quand plus aucune pièce de la main ne rentre nulle part. */
export const bloque = (p) => !p.main.some((id) => id && placeExiste(p, id))

/**
 * Pose la pièce `k` de la main. Renvoie tout ce qui s'est passé — les lignes,
 * les cases emportées par les transformations, les points — pour que l'écran
 * puisse le raconter au lieu d'afficher un nombre qui a bougé.
 */
export function pose(p, k, c, l) {
  const pieceId = p.main[k]
  if (!peutPoser(p, pieceId, c, l)) return null

  const rng = rngDe(p, k, 13)
  const teinte = 1 + Math.floor(rng() * TEINTES.length)
  const cellules = empreinte(pieceId, c, l)
  for (const e of cellules) {
    const i = indice(p, e.c, e.l)
    p.cases[i] = teinte
    p.spec[i] = semeTransfo(p, rng)
  }

  p.main[k] = null
  p.poses++
  const r = {
    pose: cellules,
    lignes: 0,
    colonnes: 0,
    emportees: [],
    points: cellules.length,
    combo: p.combo,
    monte: false,
  }
  p.score += cellules.length

  const pris = lignesPleines(p)
  if (pris.cases.size) {
    const bilan = eclate(p, pris.cases)
    r.lignes = pris.lignes
    r.colonnes = pris.colonnes
    r.emportees = bilan.emportees
    p.combo++
    p.meilleurCombo = Math.max(p.meilleurCombo, p.combo)
    p.lignes += pris.lignes + pris.colonnes
    const gagnes = points(pris.lignes + pris.colonnes, p.taille, r.combo) + bilan.prime
    r.points += gagnes
    p.score += gagnes
    // Un quadruplé rapporte un outil : c'est la seule façon d'en gagner, et
    // ça récompense la préparation plutôt que la chance.
    if (pris.lignes + pris.colonnes >= 3) p.outils.marteau++
  } else p.combo = 0

  // Le directeur lit le coup avant qu'on retire : c'est l'état du plateau
  // qu'on vient de laisser qui dit si le joueur est à l'aise.
  Dir.apprend(p, pris.lignes + pris.colonnes, placesEnMain(p))
  if (mainVide(p)) tireMain(p)
  p.fini = bloque(p)
  r.fini = p.fini
  return r
}

/**
 * Le semis de transformations. C'était une règle de monde ; c'est maintenant
 * une table du jeu, la même du début à la fin. Les proportions sont celles du
 * milieu des anciens mondes — assez pour qu'une transformation soit une bonne
 * surprise, assez rare pour qu'on ne compte pas dessus.
 */
const SEMIS = { bombe: 2, rayon: 2, prime: 2, lingot: 1 }

function semeTransfo(p, rng) {
  const semis = SEMIS
  if (!semis) return ''
  const total = Object.values(semis).reduce((s, x) => s + x, 0)
  // Les poids sont en pour-cent : à 3, trois blocs sur cent portent la marque.
  if (rng() * 100 >= total) return ''
  let d = rng() * total
  for (const [id, poids] of Object.entries(semis)) {
    d -= poids
    if (d <= 0) return TRANSFO[id] ? id : ''
  }
  return ''
}

/** Les lignes et colonnes complètes, et l'ensemble des cases qu'elles couvrent. */
export function lignesPleines(p) {
  const cases = new Set()
  let lignes = 0
  let colonnes = 0
  for (let l = 0; l < p.taille; l++) {
    let plein = true
    for (let c = 0; c < p.taille; c++) if (!p.cases[indice(p, c, l)]) plein = false
    if (plein) {
      lignes++
      for (let c = 0; c < p.taille; c++) cases.add(indice(p, c, l))
    }
  }
  for (let c = 0; c < p.taille; c++) {
    let plein = true
    for (let l = 0; l < p.taille; l++) if (!p.cases[indice(p, c, l)]) plein = false
    if (plein) {
      colonnes++
      for (let l = 0; l < p.taille; l++) cases.add(indice(p, c, l))
    }
  }
  return { cases, lignes, colonnes }
}

/**
 * L'éclatement, transformations comprises.
 *
 * Une bombe prise dans une ligne emporte ses voisines, qui peuvent contenir
 * une autre bombe : la résolution est donc une vague qui se propage. Elle est
 * bornée à huit passes — une cascade infinie sur une grille finie est
 * impossible, mais un plafond coûte une ligne et évite d'avoir à le prouver.
 */
export function eclate(p, depart) {
  const aFaire = new Set(depart)
  const traites = new Set()
  const emportees = []
  let prime = 0

  for (let passe = 0; passe < 8 && aFaire.size; passe++) {
    const vague = [...aFaire]
    aFaire.clear()
    for (const i of vague) {
      if (traites.has(i)) continue
      traites.add(i)
      const t = TRANSFO[p.spec[i]]
      if (!t) continue
      if (t.effet === 'dur') continue
      if (t.effet === 'prime') prime += t.valeur * 2
      if (t.effet === 'souffle') {
        const c = i % p.taille
        const l = Math.floor(i / p.taille)
        for (let dl = -t.valeur; dl <= t.valeur; dl++) {
          for (let dc = -t.valeur; dc <= t.valeur; dc++) {
            if (dans(p, c + dc, l + dl)) aFaire.add(indice(p, c + dc, l + dl))
          }
        }
      }
      if (t.effet === 'rayon') {
        const c = i % p.taille
        const l = Math.floor(i / p.taille)
        for (let k = 0; k < p.taille; k++) {
          aFaire.add(indice(p, c, k))
          aFaire.add(indice(p, k, l))
        }
      }
      if (t.effet === 'teinte') {
        const teinte = p.cases[i]
        for (let k = 0; k < p.cases.length; k++) if (p.cases[k] === teinte) aFaire.add(k)
      }
    }
    for (const i of aFaire) if (traites.has(i)) aFaire.delete(i)
  }

  // On applique. Une roche encaisse au lieu de partir ; le givre du monde du
  // gel se pose sur ce qui vient d'éclater, ce qui rend chaque ligne deux fois
  // plus chère à faire.
  const givre = 0
  let poses = 0
  for (const i of traites) {
    if (!p.cases[i]) continue
    if (p.gel[i] > 0) {
      p.gel[i]--
      if (p.gel[i] <= 0 && p.spec[i] === 'roche') p.spec[i] = ''
      continue
    }
    emportees.push(i)
    if (givre > 0 && poses < givre && p.spec[i] !== 'roche') {
      poses++
      p.gel[i] = 1
      p.spec[i] = ''
      continue
    }
    p.cases[i] = 0
    p.spec[i] = ''
    p.gel[i] = 0
  }
  return { emportees, prime }
}

/**
 * Ce que rapportent des lignes faites d'un seul coup, chaîne comprise.
 *
 * Réglé au banc : à la moitié de cette valeur, l'automate « joueur moyen » ne
 * franchissait le premier monde qu'une fois sur quatre. Un premier monde qu'on
 * rate trois fois sur quatre n'apprend rien — il décourage. Le facteur
 * quadratique sur `n` et le facteur de chaîne restent, eux, franchement
 * marqués : c'est là que se joue la différence entre poser et manœuvrer.
 */
export const points = (n, taille, combo) =>
  n <= 0 ? 0 : Math.round(taille * n * (1 + (n - 1) * 0.7) * (1 + Math.min(8, combo) * 0.35) * 4)

// --- Les outils ---------------------------------------------------------------------

/** Le marteau : une case, n'importe laquelle, disparaît. */
export function marteau(p, c, l) {
  if (p.outils.marteau <= 0 || !dans(p, c, l)) return false
  const i = indice(p, c, l)
  if (!p.cases[i]) return false
  p.outils.marteau--
  p.cases[i] = 0
  p.spec[i] = ''
  p.gel[i] = 0
  p.fini = bloque(p)
  return true
}

/** L'échange : une main neuve, quand celle qu'on a ne mène nulle part. */
export function echange(p) {
  if (p.outils.echange <= 0) return false
  p.outils.echange--
  tireMain(p)
  p.fini = bloque(p)
  return true
}

// --- Progression et sauvegarde ---------------------------------------------------------

export const sauvegarde = (p) => ({ v: VERSION, p })

export function migre(brut) {
  if (!brut || brut.v !== VERSION || !brut.p?.cases) return null
  const p = brut.p
  const total = p.taille * p.taille
  if (p.cases.length !== total) return null
  p.spec ??= new Array(total).fill('')
  p.gel ??= new Array(total).fill(0)
  p.tirages ??= 0
  p.outils ??= { marteau: 1, echange: 1 }
  return p
}

export { TRANSFOS, TRANSFO, PIECE, PIECES, encombrement, TEINTES, palierDe, PAR_PALIER }
