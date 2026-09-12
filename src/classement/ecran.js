/**
 * Les écrans de classement, et le podium qu'on impose à la vue.
 *
 * Même discipline que le moteur : **une fonction de disposition par écran,
 * lue à la fois par le dessin et par l'appui.** Les deux se sont déjà
 * désynchronisés une fois dans ce projet, et c'était un bouton qui ne
 * répondait pas là où on le voyait ; ici il y a trois niveaux de navigation,
 * l'occasion serait trop belle.
 *
 * Rien de ce fichier ne touche au DOM ni au réseau : il reçoit des lignes,
 * il rend des rectangles. C'est ce qui le rend vérifiable sous `node --test`.
 */
import { C, ton } from '../palette.js'
import { texte, rect, cadre, bloc, lueur, ombre, PX } from '../dessin.js'
import { PODIUM } from './scores.js'

const estLarge = (W, H) => W > H

/** Or, argent, bronze — les trois seules places dont on se souvient. */
export const MEDAILLES = [C.accent, '#c9d4cd', '#c98a4b']

// --- Le podium imposé --------------------------------------------------------

/**
 * La hauteur qu'il faut réserver au podium. Trois marches en portrait, une
 * seule bande en paysage : couché, l'écran n'a que 360 px de haut et un
 * podium en pied mangerait les cartes de l'accueil.
 */
export const hauteurPodium = (W, H) => (estLarge(W, H) ? 30 : 76)

/**
 * Trois marches de hauteurs différentes — la première au milieu et plus
 * haute, comme sur une vraie estrade. On ne lit pas un classement, on le
 * reconnaît.
 */
export function dispoPodium(x, y, w, W, H) {
  if (estLarge(W, H)) return null // couché : une seule bande, voir dessinePodium
  const large = Math.floor((w - 16) / 3)
  const ordre = [1, 0, 2] // 2e, 1er, 3e : le vainqueur au centre
  // Hauteurs et décalages vont par paires : la somme fait toujours 76, donc
  // les trois marches reposent sur le même sol. La plus basse ne descend pas
  // sous 64 px — c'est ce qu'il faut pour tenir un rang, un pseudo et un
  // score sans qu'aucun ne sorte du cadre, ce que 54 px ne permettait pas.
  const MARCHES = [
    { h: 76, dy: 0 },
    { h: 68, dy: 8 },
    { h: 64, dy: 12 },
  ]
  return ordre.map((place, colonne) => ({
    place,
    x: x + colonne * (large + 8),
    y: y + MARCHES[place].dy,
    w: large,
    h: MARCHES[place].h,
  }))
}

/**
 * Le top 3, en gros, là où on ne peut pas ne pas le voir.
 *
 * `lignes` peut être plus court que trois — ou vide, au tout début de la vie
 * d'un classement : les marches restent dessinées, creuses, avec un tiret. Un
 * podium vide dit « personne n'y est encore », ce qui est une invitation ; un
 * podium absent ne dit rien du tout.
 */
export function dessinePodium(ctx, x, y, w, W, H, lignes, { titre = 'TOP 3', valeur = (l) => l.points } = {}) {
  const marches = dispoPodium(x, y, w, W, H)

  if (!marches) {
    // Paysage : une seule ligne, « 1. GREG 4820 · 2. … », qui tient en 34 px.
    rect(ctx, x, y, w, 30, C.panneau)
    cadre(ctx, x, y, w, 30, C.bord)
    ctx.textAlign = 'left'
    texte(ctx, titre, x + 10, y + 15, 11, C.faible, 700)
    ctx.textAlign = 'center'
    const dispo = w - 74
    for (let i = 0; i < PODIUM; i++) {
      const l = lignes[i]
      const cx = x + 68 + dispo * ((i + 0.5) / PODIUM)
      texte(ctx, l ? `${i + 1}. ${l.pseudo}` : `${i + 1}. --`, cx, y + 11, 12, l ? MEDAILLES[i] : C.bord, 700, dispo / PODIUM - 8)
      if (l) texte(ctx, String(Math.round(valeur(l))), cx, y + 23, 11, C.faible, 700, dispo / PODIUM - 8)
    }
    return
  }

  ctx.textAlign = 'center'
  texte(ctx, titre, x + w / 2, y - 8, 11, C.faible, 700, w)
  for (const m of marches) {
    const l = lignes[m.place]
    const teinte = l ? MEDAILLES[m.place] : C.bord
    ombre(ctx, m.x, m.y, m.w, m.h, 4)
    rect(ctx, m.x, m.y, m.w, m.h, C.panneau)
    if (l) lueur(ctx, m.x, m.y, m.w, 4, teinte, 2, 0.8)
    bloc(ctx, m.x, m.y, m.w, 5, teinte, 2)
    cadre(ctx, m.x, m.y, m.w, m.h, ton(teinte, -0.45))
    // Le rang se cale en haut, le pseudo et le score **sur le bas de leur
    // propre marche** : à hauteur fixe, le score de la troisième était peint
    // sous elle, dans le vide. Une marche porte ce qu'elle mesure.
    texte(ctx, String(m.place + 1), m.x + m.w / 2, m.y + 18, 18, teinte, 700)
    texte(ctx, l ? l.pseudo : '--', m.x + m.w / 2, m.y + m.h - 30, 12, l ? C.texte : C.bord, 700, m.w - 8)
    if (l) texte(ctx, String(Math.round(valeur(l))), m.x + m.w / 2, m.y + m.h - 12, 13, C.accent, 700, m.w - 8)
  }
}

// --- L'écran de classement ---------------------------------------------------

/**
 * Trois niveaux, et un seul état : `{ onglet, jeu }`. `onglet` vaut
 * `'general'` ou l'identifiant d'une catégorie ; `jeu` n'est renseigné que
 * lorsqu'on regarde un jeu en particulier.
 */
export function dispoOnglets(W, H, n) {
  // Sous le sous-titre que `_entete` écrit vers 76 : les onglets s'étaient
  // d'abord posés à 66, et la légende du général leur passait au travers.
  const y = 92
  const h = 26
  const ecart = 6
  const w = Math.floor((W - 40 - (n - 1) * ecart) / n)
  return { x: 20, y, w, h, ecart }
}

export const onglet = (i, d) => ({ x: d.x + i * (d.w + d.ecart), y: d.y, w: d.w, h: d.h })

/**
 * Où se pose le podium de l'écran de classement : sous les onglets. Le
 * calculer ici plutôt que dans le moteur, c'est ce qui permet à `dispoListe`
 * de partir de sa vraie hauteur au lieu d'un nombre écrit à la main qui se
 * décale au premier réglage.
 */
export function dispoPodiumClassement(W, H) {
  const d = dispoOnglets(W, H, 1)
  return { x: 20, y: d.y + d.h + (estLarge(W, H) ? 10 : 34), w: W - 40, h: hauteurPodium(W, H) }
}

/**
 * La liste, sous les onglets (et sous le podium quand il y en a un) : autant
 * de lignes qu'il en tient — **moins une**.
 *
 * La dernière place est gardée pour la tienne. Quand on est cinquantième d'un
 * classement qui n'en montre que huit, le moteur dessine sa propre ligne juste
 * en dessous des autres ; sans cette réserve, elle passerait sous le bouton du
 * bas, c'est-à-dire nulle part.
 */
export function dispoListe(W, H, { avecPodium = false } = {}) {
  const large = estLarge(W, H)
  const onglets = dispoOnglets(W, H, 1)
  const pod = dispoPodiumClassement(W, H)
  const y = avecPodium ? pod.y + pod.h + (large ? 8 : 16) : onglets.y + onglets.h + 12
  const h = large ? 26 : 30
  const ecart = large ? 4 : 5
  const bas = dispoCompte(W, H).y - (large ? 6 : 10)
  const tiennent = Math.floor((bas - y + ecart) / (h + ecart))
  return { x: 20, y, w: W - 40, h, ecart, max: Math.max(1, tiennent - 1) }
}

export const ligneListe = (i, d) => ({ x: d.x, y: d.y + i * (d.h + d.ecart), w: d.w, h: d.h })

/** Le bouton du bas : « MON COMPTE » ou « SE CONNECTER », selon. */
export function dispoCompte(W, H) {
  const large = estLarge(W, H)
  const w = Math.min(260, W - 40)
  return { x: Math.round((W - w) / 2), y: H - (large ? 40 : 56), w, h: large ? 28 : 40 }
}

/**
 * La grille des jeux d'une catégorie — le niveau intermédiaire, entre les
 * onglets et le classement d'un jeu précis.
 *
 * Ce n'est pas la liste des joueurs : celle-là se coupe à ce qui tient, et
 * personne ne perd rien à ne pas voir le quatorzième. Ici, **chaque jeu doit
 * être atteignable** — COURT en a vingt-quatre, et une liste d'une colonne
 * n'en montrait que onze : treize jeux dont le classement n'existait, en
 * pratique, pour personne.
 *
 * Alors on prend le plus petit nombre de colonnes qui les fait tous tenir. À
 * une seule colonne il reste la place d'annoncer le meneur ; au-delà, il n'y a
 * plus que le nom, et c'est déjà ce qu'on venait chercher.
 */
export function dispoGrilleJeux(W, H, n) {
  const large = estLarge(W, H)
  const onglets = dispoOnglets(W, H, 1)
  const y = onglets.y + onglets.h + 12
  const dispo = dispoCompte(W, H).y - (large ? 6 : 10) - y
  const hMax = large ? 26 : 30
  const hMin = large ? 24 : 26
  const ecart = large ? 4 : 5

  for (const cols of [1, 2, 3, 4]) {
    const rangs = Math.ceil(n / cols)
    const h = Math.floor((dispo - (rangs - 1) * ecart) / rangs)
    if (h < hMin && cols < 4) continue
    const w = Math.floor((W - 40 - (cols - 1) * ecart) / cols)
    return { x: 20, y, w, h: Math.max(hMin, Math.min(hMax, h)), ecart, cols, avecMeneur: cols === 1 }
  }
}

export const caseJeu = (i, d) => ({
  x: d.x + (i % d.cols) * (d.w + d.ecart),
  y: d.y + Math.floor(i / d.cols) * (d.h + d.ecart),
  w: d.w,
  h: d.h,
})

/**
 * Une ligne de classement : rang, pseudo, valeur. Le joueur connecté est
 * souligné d'ambre — dans une liste de vingt noms, retrouver le sien ne doit
 * pas demander de lire.
 */
export function dessineLigne(ctx, z, { rang, pseudo, valeur, moi, teinte }) {
  rect(ctx, z.x, z.y, z.w, z.h, C.panneau)
  if (moi) {
    lueur(ctx, z.x, z.y, 5, z.h, C.accent, 2, 0.9)
    bloc(ctx, z.x, z.y, 5, z.h, C.accent, 2)
  }
  cadre(ctx, z.x, z.y, z.w, z.h, moi ? ton(C.accent, -0.5) : C.bord)
  ctx.textAlign = 'left'
  texte(ctx, String(rang), z.x + 14, z.y + z.h / 2, 13, teinte ?? C.faible, 700, 30)
  texte(ctx, pseudo, z.x + 48, z.y + z.h / 2, 14, moi ? C.accent : C.texte, 700, z.w - 130)
  ctx.textAlign = 'right'
  texte(ctx, valeur, z.x + z.w - 14, z.y + z.h / 2, 14, C.texte, 700, 90)
  ctx.textAlign = 'center'
}

/** Ce qu'on écrit quand il n'y a rien à écrire — et pourquoi. */
export function messageVide(etat, horsLigne) {
  if (horsLigne) return 'classements hors ligne sur cette borne'
  if (etat.erreur) return etat.erreur
  if (etat.charge) return 'chargement…'
  return 'personne n’y est encore — la place est libre'
}
