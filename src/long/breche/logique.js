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
import { PIECES, PIECE, TRANSFO, TRANSFOS, MONDES, mondeDe, bassinDe, encombrement, TEINTES } from './donnees.js'

export const VERSION = 1
export const EN_MAIN = 3

// --- La grille ------------------------------------------------------------------

export const indice = (p, c, l) => l * p.taille + c
export const dans = (p, c, l) => c >= 0 && l >= 0 && c < p.taille && l < p.taille
export const pleine = (p, c, l) => dans(p, c, l) && p.cases[indice(p, c, l)] > 0

const rngDe = (p, ...sel) => melange32(derive(p.graine, p.n, p.poses, ...sel))

/** Le tirage a son propre compteur : l'échange ne doit pas décaler la crue. */
const rngTirage = (p, k) => melange32(derive(p.graine, p.n, p.tirages ?? 0, k, 77))

// --- Création et mondes ------------------------------------------------------------

export function nouvelle(graine) {
  const p = {
    v: VERSION,
    graine: graine >>> 0,
    n: 0,
    score: 0,
    total: 0,
    poses: 0,
    tirages: 0,
    combo: 0,
    meilleurCombo: 0,
    lignes: 0,
    taille: 8,
    cases: [],
    spec: [],
    gel: [],
    main: [],
    outils: { marteau: 1, echange: 1 },
    fini: false,
  }
  entreMonde(p, 0)
  return p
}

/** Installe le plateau d'un monde : taille, blocs de départ, roches, main neuve. */
export function entreMonde(p, n) {
  const monde = mondeDe(n)
  const r = monde.regles
  p.n = n
  p.score = 0
  p.combo = 0
  p.poses = 0
  p.tirages = 0
  p.montees = 0
  p.depuisMontee = 0
  p.taille = r.taille ?? 8
  const total = p.taille * p.taille
  p.cases = new Array(total).fill(0)
  p.spec = new Array(total).fill('')
  p.gel = new Array(total).fill(0)
  p.outils.marteau++
  p.outils.echange++

  const rng = melange32(derive(p.graine, n, 7))
  const libres = () => {
    const t = []
    for (let i = 0; i < total; i++) if (!p.cases[i]) t.push(i)
    return t
  }
  // Les blocs de départ ne touchent jamais la dernière rangée : commencer avec
  // une ligne à moitié faite ferait éclater au premier coup, ce qui donne un
  // cadeau au lieu d'un problème.
  const hautSeulement = (t) => t.filter((i) => Math.floor(i / p.taille) < p.taille - 1)
  for (let k = 0; k < (r.prerempli ?? 0); k++) {
    const t = hautSeulement(libres())
    if (!t.length) break
    const i = t[Math.floor(rng() * t.length)]
    p.cases[i] = 1 + Math.floor(rng() * TEINTES.length)
  }
  for (let k = 0; k < (r.roche ?? 0); k++) {
    const t = hautSeulement(libres())
    if (!t.length) break
    const i = t[Math.floor(rng() * t.length)]
    p.cases[i] = 1 + Math.floor(rng() * TEINTES.length)
    p.spec[i] = 'roche'
    p.gel[i] = TRANSFO.roche.valeur - 1
  }
  tireMain(p)
  return p
}

export const monde = (p) => mondeDe(p.n)
export const regles = (p) => monde(p).regles

// --- La main -------------------------------------------------------------------------

/**
 * Trois pièces neuves. On ne retire jamais tant qu'il en reste une : c'est
 * cette contrainte qui oblige à garder de la place pour ce qu'on n'a pas
 * encore vu.
 */
export function tireMain(p) {
  p.tirages = (p.tirages ?? 0) + 1
  const rng = rngTirage(p, 999)
  const bassin = bassinDe(regles(p))
  p.main = Array.from({ length: EN_MAIN }, (_, k) => {
    const piece = pondere(rngTirage(p, k), bassin, (x) => x.poids)
    return piece ? piece.id : PIECES[0].id
  })
  // Une main dont aucune pièce ne rentre est une mort qu'on n'a pas méritée :
  // si le plateau a encore de la place pour la plus petite pièce, on redonne
  // au moins une pièce jouable.
  if (!p.main.some((id) => id && placeExiste(p, id))) {
    const secours = bassin.filter((x) => placeExiste(p, x.id))
    if (secours.length) p.main[0] = secours[Math.floor(rng() * secours.length)].id
  }
  return p.main
}

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
  p.total += cellules.length

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
    p.total += gagnes
    // Un quadruplé rapporte un outil : c'est la seule façon d'en gagner, et
    // ça récompense la préparation plutôt que la chance.
    if (pris.lignes + pris.colonnes >= 3) p.outils.marteau++
    // Et un doublé repousse la crue. Voir `monteSiBesoin`.
    if (pris.lignes + pris.colonnes >= REPOUSSE && regles(p).montee) {
      p.depuisMontee = 0
      r.repousse = true
    }
  } else p.combo = 0

  if (mainVide(p)) tireMain(p)
  r.monte = monteSiBesoin(p)
  p.fini = bloque(p)
  r.fini = p.fini
  return r
}

/** Le semis de transformations du monde : quelques blocs marqués, pas plus. */
function semeTransfo(p, rng) {
  const semis = regles(p).semis
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
  const givre = regles(p).gel ?? 0
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

/**
 * La crue : une rangée sort du bas et pousse tout vers le haut. Ce qui déborde
 * par le haut termine la partie — c'est la seule façon de perdre autrement
 * qu'en n'ayant plus de place.
 *
 * **Le compteur retombe à zéro dès qu'on fait deux lignes d'un coup.** C'est
 * la seule chose qui rend ce monde jouable, et elle a été trouvée au banc :
 * avec une montée à intervalle fixe, l'automate débordait vingt fois sur vingt
 * quel que soit le rythme, et le monde n'était pas difficile — il était
 * arithmétique. En laissant un doublé repousser l'eau, la survie redevient une
 * question de jeu.
 */
export const REPOUSSE = 2

function monteSiBesoin(p) {
  const pas = regles(p).montee
  if (!pas) return false
  p.depuisMontee = (p.depuisMontee ?? 0) + 1
  if (p.depuisMontee < pas) return false
  p.depuisMontee = 0
  const t = p.taille
  for (let c = 0; c < t; c++) if (p.cases[indice(p, c, 0)] > 0) return ((p.fini = true), true)
  for (let l = 0; l < t - 1; l++) {
    for (let c = 0; c < t; c++) {
      const haut = indice(p, c, l)
      const bas = indice(p, c, l + 1)
      p.cases[haut] = p.cases[bas]
      p.spec[haut] = p.spec[bas]
      p.gel[haut] = p.gel[bas]
    }
  }
  const rng = melange32(derive(p.graine, p.n, p.poses, 991))
  p.montees = (p.montees ?? 0) + 1
  for (let c = 0; c < t; c++) {
    const i = indice(p, c, t - 1)
    // La rangée qui monte est franchement trouée. Mesuré au banc : à 28 % de
    // trous, aucune partie ne franchissait LA CRUE — la rangée arrivait presque
    // pleine et ne laissait aucune prise pour la faire éclater ensuite. À 45 %,
    // le monde reste le plus dur des cinq premiers sans être un mur.
    const troue = rng() < 0.45
    p.cases[i] = troue ? 0 : 1 + Math.floor(rng() * TEINTES.length)
    p.spec[i] = ''
    p.gel[i] = 0
  }
  const pris = lignesPleines(p)
  if (pris.cases.size) eclate(p, pris.cases)
  p.fini = bloque(p)
  return true
}

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

export const objectif = (p) => monde(p).objectif
export const atteint = (p) => p.score >= objectif(p)

/** Passe au monde suivant. Le score du monde repart à zéro, le total non. */
export function suivant(p) {
  if (!atteint(p)) return false
  entreMonde(p, p.n + 1)
  p.fini = false
  return true
}

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

export { MONDES, TRANSFOS, TRANSFO, PIECE, PIECES, encombrement, TEINTES, mondeDe }
