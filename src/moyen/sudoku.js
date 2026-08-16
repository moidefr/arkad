import { C, ton } from '../palette.js'
import { texte, cadre, bloc, lueur } from '../dessin.js'
import { melange } from '../hasard.js'

/**
 * La grille et sa résolution, sans un pixel — c'est ce qui permet de prouver
 * en pur calcul (`node --test`) qu'une grille générée n'a qu'une seule
 * solution, sans jamais ouvrir un canvas.
 *
 * 6 × 6, blocs de 2 lignes sur 3 colonnes : neuf cases par bloc serait trop
 * fin au doigt sur 360 px, six cases par bloc tient large.
 */
const N = 6
const LIGNES_BLOC = 2
const COLONNES_BLOC = 3

/** Une valeur en (l, c) est-elle compatible avec sa ligne, sa colonne, son bloc ? */
function valide(grille, l, c, v) {
  for (let k = 0; k < N; k++) {
    if (grille[l * N + k] === v) return false
    if (grille[k * N + c] === v) return false
  }
  const bl = Math.floor(l / LIGNES_BLOC) * LIGNES_BLOC
  const bc = Math.floor(c / COLONNES_BLOC) * COLONNES_BLOC
  for (let r = bl; r < bl + LIGNES_BLOC; r++) {
    for (let cc = bc; cc < bc + COLONNES_BLOC; cc++) {
      if (grille[r * N + cc] === v) return false
    }
  }
  return true
}

/**
 * Une case déjà remplie est-elle en conflit avec une autre de sa ligne, sa
 * colonne ou son bloc ? Contrairement à `valide`, la case elle-même porte
 * déjà une valeur : il faut l'exclure de la comparaison.
 */
export function enConflit(grille, i) {
  const v = grille[i]
  if (!v) return false
  const l = Math.floor(i / N)
  const c = i % N
  for (let k = 0; k < N; k++) {
    if (k !== c && grille[l * N + k] === v) return true
    if (k !== l && grille[k * N + c] === v) return true
  }
  const bl = Math.floor(l / LIGNES_BLOC) * LIGNES_BLOC
  const bc = Math.floor(c / COLONNES_BLOC) * COLONNES_BLOC
  for (let r = bl; r < bl + LIGNES_BLOC; r++) {
    for (let cc = bc; cc < bc + COLONNES_BLOC; cc++) {
      const j = r * N + cc
      if (j !== i && grille[j] === v) return true
    }
  }
  return false
}

/** Une grille pleine et sans conflit est forcément une solution valide. */
function complete(grille) {
  for (let i = 0; i < grille.length; i++) {
    if (!grille[i] || enConflit(grille, i)) return false
  }
  return true
}

/** Remplissage latin par retour arrière, ordre des valeurs mélangé pour varier la grille d'une partie à l'autre. */
function solutionPleine(hasard) {
  const grille = new Array(N * N).fill(0)
  pose(grille, 0, hasard)
  return grille

  function pose(g, i, h) {
    if (i === N * N) return true
    const l = Math.floor(i / N)
    const c = i % N
    for (const v of melange(h, [1, 2, 3, 4, 5, 6])) {
      if (!valide(g, l, c, v)) continue
      g[i] = v
      if (pose(g, i + 1, h)) return true
      g[i] = 0
    }
    return false
  }
}

/**
 * Compte les solutions d'une grille partielle, jusqu'à `limite` — jamais plus
 * loin, sinon prouver l'unicité d'une grille presque vide serait aussi long
 * que de la résoudre en entier pour rien.
 */
export function compteSolutions(grille, limite = 2) {
  const g = grille.slice()
  let n = 0
  resout(0)
  return n

  function resout(i) {
    if (n >= limite) return
    while (i < N * N && g[i]) i++
    if (i === N * N) {
      n++
      return
    }
    const l = Math.floor(i / N)
    const c = i % N
    for (let v = 1; v <= N; v++) {
      if (n >= limite) return
      if (!valide(g, l, c, v)) continue
      g[i] = v
      resout(i + 1)
      g[i] = 0
    }
  }
}

/** Sur 36 cases, combien en retirer symétriquement — le reste tient toujours au doigt sur 360 px. */
const RETRAITS_CIBLE = 20

/**
 * Une grille 6×6 à solution unique : une solution complète, puis un retrait
 * symétrique case par case, chaque retrait n'étant gardé que s'il laisse
 * l'unicité intacte. `hasard` est injecté (jamais `Math.random` appelé en
 * dur) pour que ce calcul reste rejouable sous une graine, comme partout
 * ailleurs dans le dépôt.
 */
export function genere(hasard = Math.random) {
  const solution = solutionPleine(hasard)
  const depart = solution.slice()

  const paires = []
  for (let i = 0; i < (N * N) / 2; i++) paires.push([i, N * N - 1 - i])

  let retires = 0
  for (const [a, b] of melange(hasard, paires)) {
    if (retires >= RETRAITS_CIBLE) break
    const va = depart[a]
    const vb = depart[b]
    depart[a] = 0
    depart[b] = 0
    if (compteSolutions(depart, 2) === 1) retires += 2
    else {
      depart[a] = va
      depart[b] = vb
    }
  }

  return { solution, depart }
}

// --- Jeu -----------------------------------------------------------------

const CASE = 46
const LARG = N * CASE
const Y0 = 132
const PAD_Y = Y0 + N * CASE + 30
const PAD_ALT = 48

export default {
  id: 'sudoku',
  nom: 'SUDOKU',
  pitch: 'Un chiffre par ligne, par colonne, par bloc — sans jamais le répéter',
  couleur: C.violet,
  unite: 'pts',

  finTitre: () => ({ texte: 'RÉSOLU', couleur: C.accent }),

  init(j) {
    const { depart } = genere(j.hasard ?? Math.random)
    j.e.grille = depart.slice()
    j.e.fixe = depart.map((v) => v !== 0)
    j.e.selection = null
    j.e.erreurs = 0
  },

  dessine(j, ctx) {
    const x0 = Math.round((j.W - LARG) / 2)
    const { grille, fixe, selection } = j.e

    ctx.textAlign = 'left'
    texte(ctx, `erreurs ${j.e.erreurs}`, x0, Y0 - 26, 14, C.faible, 700)
    ctx.textAlign = 'right'
    texte(ctx, `${Math.floor(j.t)} s`, x0 + LARG, Y0 - 26, 14, C.faible, 700)
    ctx.textAlign = 'center'

    for (let i = 0; i < N * N; i++) {
      const l = Math.floor(i / N)
      const c = i % N
      const x = x0 + c * CASE
      const y = Y0 + l * CASE
      const v = grille[i]
      const conflit = v !== 0 && enConflit(grille, i)

      // Trois fonds : la case donnée au départ, celle que le joueur a posée,
      // celle qui attend encore — c'est ce qui rend la grille lisible d'un
      // coup d'œil, avant même de lire un chiffre.
      const fond = fixe[i] ? ton(C.panneau, 0.3) : v ? ton(C.violet, -0.6) : ton(C.panneau, 0.1)
      bloc(ctx, x + 1, y + 1, CASE - 2, CASE - 2, fond, 3)

      if (conflit) {
        lueur(ctx, x + 2, y + 2, CASE - 4, CASE - 4, C.rouge, 2, 0.8)
        cadre(ctx, x + 1, y + 1, CASE - 2, CASE - 2, C.rouge, 3)
      } else if (selection === i) {
        cadre(ctx, x + 1, y + 1, CASE - 2, CASE - 2, C.violet, 3)
      }

      if (v) texte(ctx, v, x + CASE / 2, y + CASE / 2, 22, conflit ? C.rouge : fixe[i] ? C.texte : C.violet, 700)
    }

    // Les traits de bloc par-dessus les cases : c'est ce qui distingue un
    // sudoku d'une simple grille de nombres.
    for (let br = 0; br < N / LIGNES_BLOC; br++) {
      for (let bc = 0; bc < N / COLONNES_BLOC; bc++) {
        cadre(
          ctx,
          x0 + bc * COLONNES_BLOC * CASE,
          Y0 + br * LIGNES_BLOC * CASE,
          COLONNES_BLOC * CASE,
          LIGNES_BLOC * CASE,
          C.texte,
          2,
        )
      }
    }

    const actif = selection !== null
    for (let d = 1; d <= N; d++) {
      const x = x0 + (d - 1) * CASE
      bloc(ctx, x + 2, PAD_Y, CASE - 4, PAD_ALT, actif ? C.violet : ton(C.panneau, 0.24), 3)
      texte(ctx, d, x + CASE / 2, PAD_Y + PAD_ALT / 2, 22, actif ? C.fond : C.faible, 700)
    }

    texte(ctx, 'touche une case puis un chiffre', j.W / 2, PAD_Y + PAD_ALT + 26, 13, C.faible, 700)
  },

  appui(j, p) {
    if (j.fini) return
    const x0 = Math.round((j.W - LARG) / 2)
    const c = Math.floor((p.x - x0) / CASE)

    const l = Math.floor((p.y - Y0) / CASE)
    if (c >= 0 && c < N && l >= 0 && l < N) {
      const i = l * N + c
      if (!j.e.fixe[i]) {
        j.e.selection = i
        j.son.clic()
      }
      return
    }

    if (p.y >= PAD_Y && p.y < PAD_Y + PAD_ALT && c >= 0 && c < N) {
      if (j.e.selection === null) return
      remplit(j, j.e.selection, c + 1)
    }
  },
}

function remplit(j, i, v) {
  j.e.grille[i] = v
  if (enConflit(j.e.grille, i)) {
    j.e.erreurs++
    j.son.rate()
  } else {
    j.son.rebond()
  }

  if (!complete(j.e.grille)) return
  // La vitesse compte, la sobriété aussi : chaque erreur reste acquise même
  // corrigée, pour ne pas récompenser l'essai-erreur au pavé numérique.
  j.score = Math.max(200, 4000 - Math.floor(j.t) * 6 - j.e.erreurs * 40)
  j.son.niveau()
  j.fx.eclat(j.W / 2, j.H / 2, C.violet, { n: 32, vitesse: 260 })
  j.perdu()
}
