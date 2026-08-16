import { C, ton } from '../palette.js'
import { texte, rect, cadre, bloc, pastille } from '../dessin.js'
import { melange } from '../hasard.js'

// Une grille seule se résout en une minute. La série grandit la grille et
// donne à FLUX la durée d'un jeu MOYEN — et comme rien ici ne peut faire
// perdre, elle est bornée : la dernière grille résolue est la victoire.
const TAILLES = [5, 6, 7, 8]

// Cyan est la couleur du jeu lui-même : les chemins piochent dans le reste
// de la palette, jamais dedans.
const PALETTE = [C.accent, C.vert, C.violet, C.rouge]
const PAIRES = PALETTE.length

const Y_GRILLE = 116
const MARGE = 14
const MARGE_BAS = 46

export default {
  id: 'flux',
  nom: 'FLUX',
  pitch: 'Relie les points de même couleur et remplis toute la grille',
  couleur: C.cyan,
  unite: 'pts',

  finTitre: () => ({ texte: 'RÉSOLU', couleur: C.cyan }),

  init(j) {
    j.e.niveau = 1
    j.e.fanfare = 0
    poseNiveau(j)
  },

  /** Rien ne dépend de l'écran sauf le cadrage : une rotation ne recommence rien. */
  redim(j) {
    Object.assign(j.e, dispo(j, j.e.n))
  },

  maj(j, dt) {
    j.e.fanfare = Math.max(0, j.e.fanfare - dt)
    avance(j, dt)
  },

  dessine(j, ctx) {
    const { n, x0, y0, case_, grille, extremites, couleurs, actif } = j.e
    ctx.textAlign = 'center'
    cadre(ctx, x0 - 2, y0 - 2, n * case_ + 4, n * case_ + 4, C.bord)

    for (let i = 0; i < grille.length; i++) {
      const x = x0 + (i % n) * case_
      const y = y0 + Math.floor(i / n) * case_
      const idx = grille[i]

      if (idx === -1) {
        bloc(ctx, x + 1, y + 1, case_ - 2, case_ - 2, ton(C.panneau, 0.22), 3)
        continue
      }

      const couleur = idx === actif ? ton(couleurs[idx], -0.12) : couleurs[idx]
      if (extremites[idx].includes(i)) {
        // Le point de départ ne se peint jamais en plein : c'est la cible, pas le tracé.
        bloc(ctx, x + 1, y + 1, case_ - 2, case_ - 2, ton(C.panneau, 0.22), 3)
        pastille(ctx, x + case_ / 2, y + case_ / 2, case_ * 0.3, couleur)
      } else {
        bloc(ctx, x + 1, y + 1, case_ - 2, case_ - 2, couleur, 3)
      }
    }

    ctx.textAlign = 'left'
    texte(ctx, `GRILLE ${j.e.niveau}/${TAILLES.length}`, 14, 76, 16, C.cyan, 700)
    texte(ctx, `${n} × ${n}`, 14, 100, 13, C.faible, 700)
    ctx.textAlign = 'right'
    texte(ctx, `${Math.floor(j.t)} s`, j.W - 14, 76, 14, C.faible, 700)
    ctx.textAlign = 'center'
    texte(ctx, 'relie les points, remplis toute la grille', j.W / 2, y0 + n * case_ + 26, 13, C.faible, 700)

    if (j.e.fanfare > 0) {
      ctx.fillStyle = `rgba(11, 14, 13, ${Math.min(0.8, j.e.fanfare)})`
      rect(ctx, 0, 0, j.W, j.H, ctx.fillStyle)
      texte(ctx, `GRILLE ${j.e.niveau - 1} RÉSOLUE`, j.W / 2, j.H / 2 - 16, 22, C.cyan, 700)
      texte(ctx, `grille ${j.e.niveau}/${TAILLES.length}`, j.W / 2, j.H / 2 + 18, 15, C.texte, 700)
    }
  },

  appui(j, p) {
    // Un doigt à la fois : un second appui pendant un tracé actif n'arrive
    // jamais avec une vraie entrée tactile, mais autant ne pas y croire.
    if (j.e.fanfare > 0 || j.e.actif !== null) return
    const i = index(j, p)
    if (i === null) return
    const idx = j.e.grille[i]
    // On ne démarre un tracé que depuis une extrémité colorée.
    if (idx === -1 || !j.e.extremites[idx].includes(i)) return
    demarre(j, idx, i)
  },

  relache(j) {
    const idx = j.e.actif
    if (idx === null) return
    // Le tracé partiel n'a pas atteint l'autre bout : il s'efface.
    for (const cellule of j.e.trace) if (!j.e.extremites[idx].includes(cellule)) j.e.grille[cellule] = -1
    j.e.actif = null
    j.e.trace = null
  },
}

// --- Génération : on pave la grille avant d'y poser un joueur ----------------

/**
 * Un chemin de Hamilton en boustrophédon (un aller-retour ligne par ligne, ou
 * colonne par colonne) visite chaque case exactement une fois, et deux cases
 * voisines dans la liste sont toujours voisines sur la grille. Le découper en
 * tronçons donne donc, gratuitement, des chemins qui pavent toute la grille
 * sans jamais se chevaucher ni se croiser — pas besoin de marche aléatoire ni
 * de retour en arrière pour le garantir.
 *
 * Fonction pure — c'est ce qui permet de l'éprouver sans canvas ni moteur, en
 * pur calcul.
 */
export function genere(n, k = PAIRES, hasard = Math.random) {
  k = Math.max(1, Math.min(k, Math.floor((n * n) / 2)))
  const balaye = []
  if (hasard() < 0.5) {
    for (let r = 0; r < n; r++) {
      for (let cc = 0; cc < n; cc++) balaye.push(r * n + (r % 2 === 0 ? cc : n - 1 - cc))
    }
  } else {
    for (let cc = 0; cc < n; cc++) {
      for (let r = 0; r < n; r++) balaye.push((cc % 2 === 0 ? r : n - 1 - r) * n + cc)
    }
  }
  if (hasard() < 0.5) balaye.reverse()

  const longueurs = decoupe(n * n, k, hasard)
  const chemins = []
  let i = 0
  for (const long of longueurs) {
    chemins.push(balaye.slice(i, i + long))
    i += long
  }
  return chemins
}

/** k longueurs >= 2 qui somment à `total`, réparties au hasard. */
function decoupe(total, k, hasard) {
  const longueurs = Array(k).fill(2)
  let reste = total - k * 2
  while (reste > 0) {
    longueurs[Math.floor(hasard() * k)]++
    reste--
  }
  for (let i = k - 1; i > 0; i--) {
    const j = Math.floor(hasard() * (i + 1))
    ;[longueurs[i], longueurs[j]] = [longueurs[j], longueurs[i]]
  }
  return longueurs
}

// --- Mise en place -------------------------------------------------------------

function dispo(j, n) {
  const largeur = j.W - MARGE * 2
  const hauteur = j.H - Y_GRILLE - MARGE_BAS
  const case_ = Math.max(16, Math.floor(Math.min(largeur, hauteur) / n))
  const cote = case_ * n
  return { case_, x0: Math.round((j.W - cote) / 2), y0: Y_GRILLE }
}

function poseNiveau(j) {
  const n = TAILLES[j.e.niveau - 1]
  const k = Math.min(PAIRES, Math.floor((n * n) / 2))
  const solution = genere(n, k)
  const couleurs = melange(Math.random, PALETTE.slice(0, k))
  const extremites = solution.map((c) => [c[0], c[c.length - 1]])

  const grille = new Array(n * n).fill(-1)
  extremites.forEach((ex, idx) => {
    grille[ex[0]] = idx
    grille[ex[1]] = idx
  })

  Object.assign(j.e, dispo(j, n), {
    n,
    k,
    couleurs,
    extremites,
    // La solution qui a servi à générer la grille : jamais montrée au joueur
    // (dessine() ne la lit pas), gardée seulement pour qu'un chemin gagnant
    // existe toujours à découvrir. `chemins` est ce que *lui* a effectivement relié.
    solution,
    chemins: Array(k).fill(null),
    grille,
    actif: null,
    trace: null,
    debut: j.t,
  })
}

// --- Le tracé --------------------------------------------------------------

function index(j, p) {
  const { x0, y0, case_, n } = j.e
  const c = Math.floor((p.x - x0) / case_)
  const r = Math.floor((p.y - y0) / case_)
  if (c < 0 || c >= n || r < 0 || r >= n) return null
  return r * n + c
}

function adjacent(n, a, b) {
  const ac = a % n
  const ar = Math.floor(a / n)
  const bc = b % n
  const br = Math.floor(b / n)
  return (ac === bc && Math.abs(ar - br) === 1) || (ar === br && Math.abs(ac - bc) === 1)
}

function demarre(j, idx, depart) {
  // Redémarrer un chemin déjà résolu efface son tracé — seuls ses deux points restent.
  const ancien = j.e.chemins[idx]
  if (ancien) {
    for (const cellule of ancien) if (!j.e.extremites[idx].includes(cellule)) j.e.grille[cellule] = -1
    j.e.chemins[idx] = null
  }
  j.e.actif = idx
  j.e.trace = [depart]
  j.son.clic()
}

function avance(j, dt) {
  if (j.e.actif === null || !j.maintenu) return
  const i = index(j, j.pointer)
  if (i === null) return

  const idx = j.e.actif
  const trace = j.e.trace
  const dernier = trace[trace.length - 1]
  if (i === dernier) return

  // Un pas en arrière efface la dernière case posée : c'est le retour du doigt.
  if (trace.length > 1 && i === trace[trace.length - 2]) {
    const enleve = trace.pop()
    if (!j.e.extremites[idx].includes(enleve)) j.e.grille[enleve] = -1
    j.son.rebond()
    return
  }

  if (!adjacent(j.e.n, i, dernier) || trace.includes(i)) return

  const autre = j.e.extremites[idx].find((cellule) => cellule !== trace[0])
  const occupant = j.e.grille[i]
  if (occupant !== -1 && i !== autre) return // case déjà prise par une autre couleur

  trace.push(i)
  j.e.grille[i] = idx

  if (i === autre) {
    j.e.chemins[idx] = trace.slice()
    j.e.actif = null
    j.e.trace = null
    j.son.touche(Math.min(9, 1 + idx))
    if (resolu(j)) complete(j)
  }
}

/** Résolu quand chaque paire est reliée ET qu'aucune case ne reste vide. */
function resolu(j) {
  return j.e.chemins.every(Boolean) && j.e.grille.every((v) => v !== -1)
}

function complete(j) {
  const { n } = j.e
  const duree = j.t - j.e.debut
  // La prime grandit avec l'aire de la grille et fond avec le temps passé dessus.
  const prime = Math.max(150, 90 * n - Math.round(duree * 4)) * n
  j.score += prime
  j.fx.eclat(j.W / 2, j.e.y0 + (n * j.e.case_) / 2, C.cyan, { n: 30, vitesse: 250 })

  if (j.e.niveau >= TAILLES.length) {
    j.son.niveau()
    return j.perdu()
  }
  j.son.record()
  j.e.niveau++
  poseNiveau(j)
  j.e.fanfare = 1.4
}
