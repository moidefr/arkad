/**
 * BRÈCHE — trois pièces en main, une grille, et des lignes qui éclatent.
 *
 * Le genre est connu ; ce qui l'est moins, c'est qu'il vit ou meurt sur trois
 * détails d'ergonomie, et ce fichier n'existe que pour eux :
 *
 *  1. **La pièce se traîne au-dessus du doigt**, jamais dessous. Une pièce
 *     posée sous la main cache exactement la case qu'on essaie de viser.
 *  2. **L'aperçu montre les lignes qui vont partir**, pas seulement les cases
 *     occupées. C'est la seule information qui compte au moment de choisir.
 *  3. **Le lâcher pardonne d'une case.** Viser au pixel sur une grille de
 *     quarante pixels avec un pouce est une exigence absurde ; si la position
 *     exacte ne rentre pas, on cherche la plus proche qui rentre.
 *
 * Les règles, elles, sont dans `logique.js` et ne connaissent ni canvas ni
 * stockage : une partie entière se joue sous `node --test`.
 */
import { C } from '../../palette.js'
import { texte } from '../../dessin.js'
import { lis, ecris } from '../../stockage.js'
import * as L from './logique.js'
import * as V from './vues.js'
import { PIECE, encombrement, MONDES } from './donnees.js'
import { pourMonde } from '../../musique.js'

const CLE_META = 'breche.meta'
const metaVide = { meilleurMonde: 0, parties: 0, meilleurCombo: 0 }

const litMeta = () => {
  try {
    return { ...metaVide, ...JSON.parse(lis(CLE_META, '{}')) }
  } catch {
    return { ...metaVide }
  }
}
const ecritMeta = (m) => ecris(CLE_META, JSON.stringify(m))

/** Au-delà de ce déplacement, le doigt traîne une pièce au lieu de la désigner. */
const SEUIL = 8

export default {
  id: 'breche',
  nom: 'BRÈCHE',
  pitch: 'Trois pièces, une grille, des lignes qui éclatent. Dix mondes',
  couleur: C.cyan,
  unite: 'points',
  persistant: true,
  paysage: true,
  // Pas de ciel tramé : le plateau porte déjà cinq couleurs de bloc, et la
  // trame derrière la grille brouillait la lecture au lieu de l'habiller.

  init(j) {
    j.e.meta = litMeta()
    j.e.prise = null
    j.e.arme = null
    j.e.zones = []
    j.e.vue = 'jeu'
    j.e.geste = null
    j.e.avis = null

    const brut = L.migre(j.charge())
    j.e.p = brut ?? L.nouvelle((j.hasard() * 4294967296) >>> 0)
    j.score = j.e.p.total
    accorde(j)
    if (!brut) sauve(j)
  },

  quitte: (j) => sauve(j),

  /** Le format a changé sous nos pieds : rien à recalculer, tout est dérivé. */
  redim(j) {
    j.e.prise = null
  },

  maj(j, dt) {
    const e = j.e
    j.score = e.p.total
    if (e.avis) e.avis.vie -= dt
    if (e.avis?.vie <= 0) e.avis = null
    if (e.geste && j.maintenu) {
      e.geste.bouge = Math.max(e.geste.bouge, Math.hypot(j.pointer.x - e.geste.x, j.pointer.y - e.geste.y))
    }
    if (e.vue === 'jeu' && e.p.fini) {
      finit(j)
    }
  },

  dessine(j, ctx) {
    const e = j.e
    const p = e.p
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    const d = V.dispo(j, p)

    V.plateau(ctx, j, p, d, apercu(j, d))
    V.entete(ctx, j, p, d)
    const zMain = V.main(ctx, j, p, d, e.prise)
    const zOutils = V.outils(ctx, j, p, d, e.arme)
    e.zones = [...zMain, ...zOutils]

    if (e.prise && j.maintenu) V.fantome(ctx, p, d, e.prise, j.pointer)
    if (e.avis) {
      ctx.textAlign = 'center'
      const y = d.large ? d.grille.y + d.grille.h + 16 : d.grille.y - 14
      texte(ctx, e.avis.texte, d.grille.x + d.grille.w / 2, y, 13, C.accent, 700, d.grille.w)
      ctx.textAlign = 'left'
    }
    if (e.vue === 'passage') e.zones = V.passage(ctx, j, p)
    ctx.textAlign = 'center'
  },

  appui(j, p0) {
    const e = j.e
    e.geste = { x: p0.x, y: p0.y, bouge: 0 }
    if (e.vue === 'passage') return

    const d = V.dispo(j, e.p)
    const z = e.zones.find((x) => p0.x >= x.x && p0.x <= x.x + x.w && p0.y >= x.y && p0.y <= x.y + x.h)

    // Le marteau : armé, il attend une case, et il ne prend rien d'autre.
    if (e.arme === 'marteau') {
      const cel = V.caseSous(d, e.p, p0.x, p0.y)
      if (cel && L.marteau(e.p, cel.c, cel.l)) {
        e.arme = null
        j.son.casse(7)
        j.fx.eclat(d.grille.x + (cel.c + 0.5) * d.grille.c, d.grille.y + (cel.l + 0.5) * d.grille.c, C.rouge, { n: 12 })
        sauve(j)
        return
      }
    }

    if (z?.quoi === 'piece') {
      if (!e.p.main[z.k]) return j.son.rate()
      e.prise = { k: z.k }
      e.arme = null
      j.son.clic()
      return
    }
    if (z?.quoi === 'marteau' || z?.quoi === 'echange') return outil(j, z.quoi)
  },

  relache(j, p0) {
    const e = j.e
    const geste = e.geste
    e.geste = null

    if (e.vue === 'passage') {
      const z = e.zones.find((x) => p0.x >= x.x && p0.x <= x.x + x.w && p0.y >= x.y && p0.y <= x.y + x.h)
      if (z?.quoi === 'suite') {
        L.suivant(e.p)
        e.vue = 'jeu'
        j.son.niveau()
        accorde(j)
        sauve(j)
      }
      return
    }

    if (!e.prise) return
    const d = V.dispo(j, e.p)
    // Un simple appui sur la vignette ne pose rien : on garde la pièce en main
    // et le prochain glissement la placera. Ça évite de perdre un coup parce
    // qu'on a effleuré l'écran.
    if ((geste?.bouge ?? 0) < SEUIL && !dansGrille(d, p0)) return
    poseIci(j, d, p0)
  },
}

// --- Le geste de pose ---------------------------------------------------------------

const dansGrille = (d, p0) =>
  p0.x >= d.grille.x && p0.x <= d.grille.x + d.grille.w && p0.y >= d.grille.y && p0.y <= d.grille.y + d.grille.h

/**
 * L'endroit visé, et son rattrapage.
 *
 * Viser au pixel près sur une grille de quarante pixels avec un pouce est une
 * exigence absurde. Si la case exacte ne rentre pas, on cherche la plus proche
 * qui rentre, dans un rayon d'une case — pas plus, sinon on pose ailleurs que
 * là où on croyait.
 */
export function vise(p, d, prise, pointer) {
  const a = V.ancre(d, p, prise, pointer)
  if (!a) return null
  const id = p.main[prise.k]
  if (L.peutPoser(p, id, a.c, a.l)) return { ...a, legal: true }
  let meilleur = null
  for (let dl = -1; dl <= 1; dl++) {
    for (let dc = -1; dc <= 1; dc++) {
      const c = a.c + dc
      const l = a.l + dl
      if (!L.peutPoser(p, id, c, l)) continue
      const dist = Math.abs(dc) + Math.abs(dl)
      if (!meilleur || dist < meilleur.dist) meilleur = { c, l, legal: true, dist }
    }
  }
  return meilleur ?? { ...a, legal: false }
}

/** Ce que l'aperçu doit montrer : les cases visées, et les lignes qui partiraient. */
function apercu(j, d) {
  const e = j.e
  if (!e.prise || !j.maintenu) return null
  const p = e.p
  const cible = vise(p, d, e.prise, j.pointer)
  if (!cible) return null
  const cases = L.empreinte(p.main[e.prise.k], cible.c, cible.l).filter((x) => L.dans(p, x.c, x.l))
  if (!cible.legal) return { cases, lignes: [], legal: false }

  // On simule la pose pour savoir ce qui éclaterait. Sur une grille de cent
  // cases c'est gratuit, et c'est la seule information qui compte au moment
  // de choisir où poser.
  const occupe = new Set(cases.map((x) => L.indice(p, x.c, x.l)))
  const lignes = []
  for (let l = 0; l < p.taille; l++) {
    let plein = true
    for (let c = 0; c < p.taille; c++) {
      const i = L.indice(p, c, l)
      if (!p.cases[i] && !occupe.has(i)) plein = false
    }
    if (plein) lignes.push(['l', l])
  }
  for (let c = 0; c < p.taille; c++) {
    let plein = true
    for (let l = 0; l < p.taille; l++) {
      const i = L.indice(p, c, l)
      if (!p.cases[i] && !occupe.has(i)) plein = false
    }
    if (plein) lignes.push(['c', c])
  }
  return { cases, lignes, legal: true }
}

function poseIci(j, d, pointer) {
  const e = j.e
  const p = e.p
  const cible = vise(p, d, e.prise, pointer)
  const k = e.prise.k
  if (!cible?.legal) {
    e.prise = null
    return j.son.rate()
  }
  const r = L.pose(p, k, cible.c, cible.l)
  e.prise = null
  if (!r) return j.son.rate()

  j.score = p.total
  const n = r.lignes + r.colonnes
  if (n > 0) {
    j.son.record()
    j.fx.secoue(3 + Math.min(9, n * 3))
    for (const i of r.emportees) {
      const c = i % p.taille
      const l = Math.floor(i / p.taille)
      j.fx.eclat(d.grille.x + (c + 0.5) * d.grille.c, d.grille.y + (l + 0.5) * d.grille.c, C.accent, {
        n: 5,
        vitesse: 120,
        taille: 3,
      })
    }
    const mot = n >= 4 ? 'FRACAS' : n === 3 ? 'TRIPLÉ' : n === 2 ? 'DOUBLÉ' : 'BRÈCHE'
    e.avis = { texte: `${mot} +${r.points}${r.combo > 0 ? ` · CHAÎNE ×${r.combo + 1}` : ''}`, vie: 1.4 }
  } else j.son.touche(4)
  if (r.monte) {
    j.son.rate()
    j.fx.secoue(6)
  }

  if (L.atteint(p) && !p.fini) {
    e.vue = 'passage'
    j.son.niveau()
    if (p.n + 1 > (e.meta.meilleurMonde ?? 0)) {
      e.meta.meilleurMonde = p.n + 1
      ecritMeta(e.meta)
    }
  }
  sauve(j)
}

function outil(j, quoi) {
  const e = j.e
  if (quoi === 'marteau') {
    if ((e.p.outils.marteau ?? 0) <= 0) return j.son.rate()
    e.arme = e.arme === 'marteau' ? null : 'marteau'
    e.prise = null
    return j.son.clic()
  }
  if (!L.echange(e.p)) return j.son.rate()
  e.prise = null
  e.arme = null
  j.son.ramasse()
  sauve(j)
}

function finit(j) {
  const e = j.e
  e.meta.parties = (e.meta.parties ?? 0) + 1
  e.meta.meilleurCombo = Math.max(e.meta.meilleurCombo ?? 0, e.p.meilleurCombo)
  if (e.p.n + 1 > (e.meta.meilleurMonde ?? 0)) e.meta.meilleurMonde = e.p.n + 1
  ecritMeta(e.meta)
  j.score = e.p.total
  j.efface()
  j.perdu()
}

function sauve(j) {
  j.sauve(L.sauvegarde(j.e.p))
}

/**
 * La bande du monde courant. Cinq par famille de monde : on refait quatre fois
 * le tour des dix mondes avant de réentendre le premier morceau.
 */
function accorde(j) {
  const n = j.e.p.n
  j.musique(pourMonde(n % MONDES.length, Math.floor(n / MONDES.length)))
}
