import { C, ton } from '../../../palette.js'
import { rect, cadre, texte, lueur } from '../../../dessin.js'
import { CLASSE, CLASSES } from '../donnees/classes.js'
import { COMP } from '../donnees/competences.js'
import { MODULE, COULEUR_FAMILLE, oppose, EMPLACEMENTS_MODULE } from '../donnees/modules.js'
import { PROC } from '../donnees/ennemis.js'
import * as E from '../etat.js'
import { FARDEAU } from '../sansfin.js'
import * as P from './pieces.js'

/**
 * Les écrans hors combat : titre, recrutement, butin, bilan.
 *
 * C'est ici — et seulement ici — que la prose a le droit d'exister. En combat,
 * on ne lit pas, on regarde des nombres. La règle du projet est de ne rien
 * expliquer ; on la tient en **restreignant plutôt qu'en enseignant** : l'acte I
 * ne donne que deux compétences par opérateur, et chaque système arrive seul.
 */

/**
 * Un bandeau opaque sous le titre : le ciel tramé du jeu passe derrière tout,
 * et un titre posé dessus se lit mal. Les panneaux, eux, sont pleins.
 */
function bandeau(ctx, titre, sous, teinte = C.accent, teinteSous = C.faible) {
  rect(ctx, 0, 58, 360, 56, C.fond)
  texte(ctx, titre, 180, 82, 21, teinte, 700, 320, 3)
  texte(ctx, sous, 180, 105, 12, teinteSous, 700, 320)
  rect(ctx, 20, 112, 320, 2, ton(C.bord, -0.25))
}

// --- Titre ------------------------------------------------------------------------

export function titre(ctx, meta, equipage = 3) {
  rect(ctx, 0, 58, 360, 140, C.fond)
  lueur(ctx, 40, 120, 280, 44, C.accent, 3, 0.8)
  texte(ctx, 'ANOMALIE', 180, 142, 34, C.accent, 700, 300, 4)
  texte(ctx, 'un système corrompu, et personne pour t’aider', 180, 176, 12, C.faible, 700, 320)

  P.texteLong(
    ctx,
    'Le système est corrompu jusqu’au noyau. Descends-y. Les processus ne dorment pas, et plus tu restes, plus on te voit.',
    180,
    216,
    300,
    13,
    ton(C.texte, -0.25),
    18,
  )

  // Le choix d'équipage se fait ici, avant tout : il change le jeu, pas
  // seulement sa difficulté.
  const out = []
  texte(ctx, 'ÉQUIPAGE', 180, 274, 11, C.bord, 700, 300)
  ;[
    { n: 3, nom: 'À TROIS', dit: 'trois classes, cycles partagés' },
    { n: 1, nom: 'SEUL', dit: 'une classe, huit exploits, tout sur soi' },
  ].forEach((choix, k) => {
    const x = 20 + k * 164
    const actif = equipage === choix.n
    if (actif) lueur(ctx, x, 286, 156, 46, C.accent, 2, 0.7)
    rect(ctx, x, 286, 156, 46, C.panneau)
    cadre(ctx, x, 286, 156, 46, actif ? C.accent : ton(C.bord, -0.1))
    texte(ctx, choix.nom, x + 78, 302, 15, actif ? C.accent : C.faible, 700, 146)
    texte(ctx, choix.dit, x + 78, 320, 9, actif ? ton(C.faible, 0.1) : C.bord, 700, 148)
    out.push({ quoi: 'equipage', n: choix.n, x, y: 286, w: 156, h: 46 })
  })

  out.push({ quoi: 'plonger', ...P.bouton(ctx, 50, 344, 260, 54, 'PLONGER', { vif: true, taille: 20 }) })

  // Le mode INFINI ne s'ouvre qu'une fois le système purgé : c'est la
  // récompense d'une campagne finie, et la seule progression entre parties.
  if (meta?.victoires) {
    texte(ctx, `${meta.victoires} système(s) purgé(s)`, 180, 418, 12, C.vert, 700, 300)
    out.push({ quoi: 'infini', ...P.bouton(ctx, 50, 432, 260, 48, 'DESCENDRE SANS FIN', { taille: 16 }) })
    if (meta.profondeur > 1) texte(ctx, `profondeur atteinte : ${meta.profondeur}`, 180, 498, 12, C.accent, 700, 300)
    if (meta.profondeurSeul > 1)
      texte(ctx, `seul : ${meta.profondeurSeul}`, 180, 516, 12, ton(C.accent, -0.2), 700, 300)
  } else {
    texte(ctx, 'purge le système pour ouvrir la descente sans fin', 180, 424, 11, C.bord, 700, 300)
  }
  return out
}

// --- Recrutement -------------------------------------------------------------------

/**
 * Quatre fiches et un bouton doivent tenir sous le bandeau : à 118 px de haut
 * le bouton ENTRER recouvrait la quatrième classe, et l'appui partait dans la
 * fiche au lieu du bouton. Une zone qui en cache une autre est exactement la
 * faute qu'on reproche au jeu remplacé.
 */
const REC = { y: 144, h: 94, pas: 100 }

/** Trois opérateurs à composer. Le choix d'équipe est la première vraie décision. */
export function recrutement(ctx, offertes, prises, combien = 3) {
  bandeau(
    ctx,
    combien === 1 ? 'OPÉRATEUR' : 'ÉQUIPE DE PLONGÉE',
    combien === 1
      ? `${prises.length} / 1 · seul, la classe décide de toute la partie`
      : `${prises.length} / 3 · il en est proposé une de plus qu’il n’en faut`,
  )

  const out = []
  offertes.forEach((id, k) => {
    const cl = CLASSE[id]
    const y = REC.y + k * REC.pas
    const pris = prises.includes(id)
    if (pris) lueur(ctx, 20, y, 320, REC.h, cl.couleur, 2, 0.6)
    rect(ctx, 20, y, 320, REC.h, C.panneau)
    rect(ctx, 20, y, 5, REC.h, cl.couleur)
    cadre(ctx, 20, y, 320, REC.h, pris ? cl.couleur : ton(C.bord, -0.1))

    ctx.textAlign = 'left'
    texte(ctx, cl.nom, 38, y + 18, 16, pris ? cl.couleur : C.texte, 700, 190)
    texte(ctx, cl.territoire, 38, y + 34, 10, ton(C.faible, 0.1), 700, 190)
    ctx.textAlign = 'right'
    texte(ctx, `${cl.pv} PV · ${cl.puiss} PUIS · ${cl.vit} VIT`, 322, y + 18, 10, C.faible, 700, 140)
    texte(ctx, pris ? 'DANS L’ÉQUIPE' : '', 322, y + 34, 10, cl.couleur, 700, 140)
    ctx.textAlign = 'center'
    P.texteLong(ctx, cl.dit, 180, y + 54, 288, 11, ton(C.faible, 0.05), 13)
    texte(ctx, cl.depart.map((i) => COMP[i].nom).join('  ·  '), 180, y + 84, 10, ton(cl.couleur, -0.1), 700, 288)
    out.push({ quoi: 'classe', id, x: 20, y, w: 320, h: REC.h })
  })

  if (prises.length === combien)
    out.push({ quoi: 'partir', ...P.bouton(ctx, 50, 556, 260, 52, 'ENTRER', { vif: true, taille: 19 }) })
  return out
}

// --- Nœud : le briefing avant l'engagement ------------------------------------------------

export function noeud(ctx, e, rencontre, n) {
  bandeau(ctx, `ACTE ${e.acte}`, `couche ${(e.position?.couche ?? 0) + 1}`)

  const out = []
  if (n.type === 'processus' || n.type === 'noyau' || n.type === 'elite') {
    texte(
      ctx,
      n.type === 'noyau' ? 'NOYAU' : n.type === 'elite' ? 'ÉLITE' : 'PROCESSUS DÉTECTÉS',
      180,
      152,
      15,
      n.type === 'noyau' ? C.rouge : n.type === 'elite' ? C.violet : C.texte,
      700,
      320,
    )
    rencontre.forEach((id, k) => {
      const p = PROC[id]
      const y = 176 + k * 62
      rect(ctx, 30, y, 300, 54, C.panneau)
      rect(ctx, 30, y, 4, 54, p.couleur)
      cadre(ctx, 30, y, 300, 54, ton(p.couleur, -0.35))
      ctx.textAlign = 'left'
      texte(ctx, p.nom, 46, y + 17, 14, C.texte, 700, 200)
      texte(ctx, resistances(p), 46, y + 37, 11, C.faible, 700, 210)
      ctx.textAlign = 'right'
      texte(ctx, `${p.pv} PV`, 316, y + 17, 13, p.couleur, 700, 70)
      texte(ctx, `rang ${p.rang === 0 ? 'avant' : 'arrière'}`, 316, y + 37, 10, C.faible, 700, 90)
      ctx.textAlign = 'center'
    })
    if (n.type === 'noyau') {
      const noyau = PROC[rencontre[0]]
      P.texteLong(ctx, noyau.dit, 180, 176 + rencontre.length * 62 + 12, 300, 12, C.rouge, 15)
    }
  } else if (n.type === 'marche') {
    texte(ctx, 'MARCHÉ', 180, 200, 24, C.accent, 700, 320, 3)
    P.texteLong(
      ctx,
      'De la mémoire libre. Un opérateur peut y charger un module — mais certains s’excluent définitivement.',
      180,
      240,
      300,
      13,
      C.faible,
      17,
    )
  } else if (n.type === 'archive') {
    texte(ctx, 'ARCHIVE', 180, 200, 24, C.cyan, 700, 320, 3)
    P.texteLong(
      ctx,
      'Un fragment de code oublié. Un opérateur peut y prendre un exploit.',
      180,
      240,
      300,
      13,
      C.faible,
      17,
    )
  } else {
    texte(ctx, 'ATELIER', 180, 200, 24, C.vert, 700, 320, 3)
    P.texteLong(
      ctx,
      'De quoi souffler. L’équipe récupère trente pour cent de son intégrité.',
      180,
      240,
      300,
      13,
      C.faible,
      17,
    )
  }

  out.push({ quoi: 'engager', ...P.bouton(ctx, 50, 556, 260, 56, libelleNoeud(n), { vif: true, taille: 19 }) })
  return out
}

const libelleNoeud = (n) =>
  ({ noyau: 'AFFRONTER', elite: 'ENGAGER', processus: 'ENGAGER', archive: 'FOUILLER', marche: 'CHARGER' })[n.type] ??
  'SOUFFLER'

const resistances = (p) => {
  const noms = { brut: 'BRUT', logique: 'LOG', corruption: 'CORR' }
  return Object.entries(p.resist)
    .filter(([, v]) => v !== 0)
    .map(([t, v]) => `${noms[t]} ${v > 0 ? '+' : ''}${Math.round(v * 100)} %`)
    .join('   ')
}

// --- Butin : trois compétences, et un rejet forcé -------------------------------------------

const BUT = { y: 210, h: 84, pas: 94 }

export function butin(ctx, e, offre, jette) {
  const op = e.equipe[offre.op]
  const cl = CLASSE[op.cl]
  const module = offre.quoi === 'module'
  bandeau(ctx, module ? 'MARCHÉ' : 'ARCHIVE', `pour ${op.nom}, ${cl.nom}`, module ? C.accent : C.cyan, cl.couleur)

  const out = []
  const plein = module ? op.mod.indexOf(null) < 0 : E.librePour(op) < 0

  if (jette == null) {
    offre.choix.forEach((id, k) => {
      const m = module ? MODULE[id] : COMP[id]
      const teinte = module ? COULEUR_FAMILLE[m.famille] : C.cyan
      const y = BUT.y + k * BUT.pas
      rect(ctx, 24, y, 312, BUT.h, C.panneau)
      rect(ctx, 24, y, 4, BUT.h, teinte)
      cadre(ctx, 24, y, 312, BUT.h, ton(C.bord, -0.05))
      ctx.textAlign = 'left'
      texte(ctx, m.nom, 42, y + 20, 15, C.texte, 700, 200)
      ctx.textAlign = 'right'
      // Le choix exclusif s'annonce **avant** d'être fait, jamais après.
      const adverse = module ? oppose(id) : null
      texte(ctx, module ? m.famille : `${m.cout} cycles`, 320, y + 20, 11, teinte, 700, 110)
      ctx.textAlign = 'center'
      P.texteLong(ctx, m.dit, 180, y + 44, 290, 11, C.faible, 14)
      if (adverse) texte(ctx, `verrouille ${MODULE[adverse].nom}`, 180, y + 74, 10, C.rouge, 700, 290)
      out.push({ quoi: 'prend', id, x: 24, y, w: 312, h: BUT.h })
    })
    texte(
      ctx,
      plein
        ? 'plus de place : il faudra en jeter un'
        : module
          ? `${op.mod.filter((x) => !x).length} emplacement(s) de module libre(s)`
          : `${op.comp.length - op.comp.filter(Boolean).length} emplacement(s) libre(s)`,
      180,
      170,
      12,
      plein ? C.rouge : C.faible,
      700,
      320,
    )
    out.push({ quoi: 'passer', ...P.bouton(ctx, 90, 552, 180, 46, 'NE RIEN PRENDRE', { taille: 14 }) })
    return out
  }

  // Deuxième temps : choisir ce qu'on sacrifie. On ne finit jamais avec tout.
  texte(ctx, 'QUE JETTE-T-IL ?', 180, 168, 15, C.rouge, 700, 320)
  const liste = module ? op.mod : op.comp
  const pas = liste.length > 6 ? 48 : 62
  liste.forEach((id, k) => {
    const y = 196 + k * pas
    const verrou = !module && k < E.VERROUS
    const comp = module ? MODULE[id] : COMP[id]
    const h = pas - 8
    rect(ctx, 24, y, 312, h, C.panneau)
    rect(ctx, 24, y, 4, h, verrou ? C.bord : C.rouge)
    cadre(ctx, 24, y, 312, h, verrou ? ton(C.bord, -0.3) : ton(C.rouge, -0.2))
    ctx.textAlign = 'left'
    texte(ctx, comp?.nom ?? '—', 42, y + 18, 14, verrou ? C.bord : C.texte, 700, 200)
    if (h > 44) texte(ctx, verrou ? 'verrouillée' : (comp?.dit ?? ''), 42, y + 36, 10, C.faible, 700, 250)
    ctx.textAlign = 'center'
    if (!verrou) out.push({ quoi: 'jette', k, x: 24, y, w: 312, h })
  })
  out.push({ quoi: 'annule', ...P.bouton(ctx, 110, 596, 140, 34, 'ANNULER', { taille: 13 }) })
  return out
}

// --- Un fardeau à choisir ---------------------------------------------------------

/**
 * Tous les trois actes de descente, on choisit **comment** ça devient dur.
 * Une difficulté qu'on choisit se joue ; une difficulté qu'on subit s'endure.
 */
export function fardeau(ctx, e, offre) {
  bandeau(ctx, 'UN FARDEAU', 'la descente ne se fait pas gratuitement', C.rouge, C.faible)
  const out = []
  ;(offre ?? []).forEach((id, k) => {
    const f = FARDEAU[id]
    const y = 180 + k * 108
    rect(ctx, 24, y, 312, 92, C.panneau)
    rect(ctx, 24, y, 4, 92, C.rouge)
    cadre(ctx, 24, y, 312, 92, ton(C.rouge, -0.35))
    texte(ctx, f.nom, 180, y + 26, 16, C.rouge, 700, 290)
    P.texteLong(ctx, f.dit, 180, y + 54, 280, 12, C.faible, 15)
    out.push({ quoi: 'fardeau', id, x: 24, y, w: 312, h: 92 })
  })
  texte(
    ctx,
    `déjà portés : ${e.fardeaux.map((id) => FARDEAU[id].nom).join(', ') || 'aucun'}`,
    180,
    560,
    11,
    C.bord,
    700,
    320,
  )
  return out
}

// --- Bilan -------------------------------------------------------------------------------------

export function bilan(ctx, e, gagne) {
  const teinte = gagne ? C.accent : C.rouge
  lueur(ctx, 50, 140, 260, 44, teinte, 3, 0.9)
  texte(ctx, gagne ? 'COUCHE FRANCHIE' : 'DÉCONNEXION', 180, 162, 24, teinte, 700, 300, 2)

  e.equipe.forEach((o, i) => {
    const cl = CLASSE[o.cl]
    const y = 224 + i * 62
    rect(ctx, 30, y, 300, 52, C.panneau)
    rect(ctx, 30, y, 4, 52, cl.couleur)
    ctx.textAlign = 'left'
    texte(ctx, `${o.nom} · ${cl.nom}`, 46, y + 18, 13, o.pv > 0 ? C.texte : C.bord, 700, 200)
    ctx.textAlign = 'center'
    P.barre(ctx, 46, y + 32, 268, 8, o.pv / o.pvMax, o.pv > 0 ? cl.couleur : C.bord)
    ctx.textAlign = 'right'
    texte(ctx, `${o.pv} / ${o.pvMax}`, 316, y + 18, 12, C.faible, 700, 90)
    ctx.textAlign = 'center'
  })

  if (!gagne) {
    P.texteLong(
      ctx,
      'La plongée s’arrête ici. Une défaite termine la partie — c’est ce qui donne un prix au reste.',
      180,
      428,
      300,
      12,
      C.faible,
      15,
    )
  }
  return [
    {
      quoi: gagne ? 'suite' : 'fin',
      ...P.bouton(ctx, 60, 500, 240, 54, gagne ? 'CONTINUER' : 'REPLONGER', { vif: true, taille: 18 }),
    },
  ]
}

export { CLASSES }
