import { C, ton } from '../../../palette.js'
import { rect, cadre, texte, lueur } from '../../../dessin.js'
import { CLASSE } from '../donnees/classes.js'
import { COMP } from '../donnees/competences.js'
import { MODULE, COULEUR_FAMILLE, EMPLACEMENTS_MODULE } from '../donnees/modules.js'
import * as E from '../etat.js'
import * as K from '../combat.js'
import * as P from './pieces.js'

/**
 * L'écran ÉQUIPE : ce qu'on porte, et ce que ça coûte.
 *
 * C'est le seul endroit du jeu où la prose a droit de cité, et il est hors
 * combat. Le **surcoût d'axe y est écrit en clair** : une règle qui punit sans
 * se montrer est une règle injuste, et c'est exactement le reproche fait au
 * jeu qu'ANOMALIE remplace.
 */

const ONGLET = { y: 62, h: 30, w: 104, pas: 108, x0: 20 }
const FICHE = { y: 100, h: 66 }
const COMPS = { y: 174, h: 62, pas: 66 }
const MODS = { y: 380, h: 76, w: 104, pas: 108, x0: 20 }
const DETAIL = { y: 470, h: 122 }

/**
 * Seul, l'écran n'a pas d'onglets à afficher et huit emplacements à ranger :
 * on remonte tout, on resserre, et les quatre modules tiennent sur une ligne.
 */
const SEUL = {
  fiche: { y: 66, h: 62 },
  comps: { y: 136, h: 54, pas: 58 },
  mods: { y: 372, h: 70, w: 78, pas: 82, x0: 20 },
  detail: { y: 452, h: 132 },
}

export function dessine(ctx, e, sel, detail) {
  const op = e.equipe[sel]
  const cl = CLASSE[op.cl]
  const seul = E.estSeul(e)
  const FI = seul ? SEUL.fiche : FICHE
  const CO = seul ? SEUL.comps : COMPS
  const MO = seul ? SEUL.mods : MODS
  const DE = seul ? SEUL.detail : DETAIL
  const zones = []

  if (!seul)
    e.equipe.forEach((o, k) => {
      const c = CLASSE[o.cl]
      const x = ONGLET.x0 + k * ONGLET.pas
      const actif = k === sel
      rect(ctx, x, ONGLET.y, ONGLET.w, ONGLET.h, actif ? C.panneau : C.fond)
      cadre(ctx, x, ONGLET.y, ONGLET.w, ONGLET.h, actif ? c.couleur : ton(C.bord, -0.2))
      texte(ctx, o.nom, x + ONGLET.w / 2, ONGLET.y + 15, 13, actif ? c.couleur : C.faible, 700, ONGLET.w - 10)
      zones.push({ quoi: 'op', k, x, y: ONGLET.y, w: ONGLET.w, h: ONGLET.h })
    })

  // La fiche : la classe, l'intégrité, et le rang qu'on peut changer ici.
  rect(ctx, 20, FI.y, 320, FI.h, C.panneau)
  rect(ctx, 20, FI.y, 4, FI.h, cl.couleur)
  cadre(ctx, 20, FI.y, 320, FI.h, ton(cl.couleur, -0.4))
  ctx.textAlign = 'left'
  texte(ctx, `${op.nom} · ${cl.nom}`, 36, FI.y + 18, 15, cl.couleur, 700, 190)
  texte(ctx, `${op.pv} / ${op.pvMax} d’intégrité`, 36, FI.y + 36, 11, C.faible, 700, 150)
  texte(ctx, `PUIS ${cl.puiss}   VIT ${cl.vit}   BLIN ${cl.blindage}`, 36, FI.y + 52, 11, ton(C.faible, 0.1), 700, 190)
  ctx.textAlign = 'center'
  // Seul, un opérateur occupe le seul rang de son camp : le bouton ne
  // changerait rien, alors on ne le propose pas.
  if (seul) texte(ctx, 'seul au contact', 288, FI.y + 30, 11, C.bord, 700, 96)
  else {
    zones.push({
      quoi: 'rang',
      ...P.bouton(ctx, 244, FI.y + 18, 88, 30, op.rang === 0 ? 'AVANT ▲' : 'ARRIÈRE ▼', { taille: 12 }),
    })
  }
  P.barre(ctx, 36, FI.y + FI.h - 6, 296, 3, op.pv / op.pvMax, cl.couleur)

  // Six emplacements de compétence, deux sous cadenas.
  for (let k = 0; k < E.emplacementsDe(e); k++) {
    const x = k % 2 === 0 ? 20 : 184
    const y = CO.y + Math.floor(k / 2) * CO.pas
    const id = op.comp[k]
    const comp = COMP[id]
    const verrou = k < E.VERROUS
    const choisi = detail?.quoi === 'comp' && detail.k === k
    if (choisi) lueur(ctx, x, y, 156, CO.h, C.accent, 2, 0.7)
    rect(ctx, x, y, 156, CO.h, comp ? C.panneau : ton(C.panneau, -0.55))
    cadre(ctx, x, y, 156, CO.h, choisi ? C.accent : verrou ? ton(C.bord, -0.25) : ton(C.bord, -0.05))
    if (comp) {
      ctx.textAlign = 'left'
      texte(ctx, comp.nom, x + 12, y + 18, 13, C.texte, 700, 110)
      texte(ctx, `${K.cout(op, comp)} cyc`, x + 12, y + 38, 11, C.accent, 700, 60)
      const sur = K.surcoutAxe(op, comp)
      if (sur > 0 && CO.h > 56) texte(ctx, `+${sur} d’axe`, x + 12, y + 54, 10, C.rouge, 700, 90)
      else if (sur > 0) texte(ctx, `+${sur}`, x + 74, y + 38, 10, C.rouge, 700, 24)
      ctx.textAlign = 'right'
      if (verrou) texte(ctx, '⌷', x + 144, y + 18, 12, C.bord, 700, 14)
      ctx.textAlign = 'center'
    } else texte(ctx, '—', x + 78, y + CO.h / 2, 16, ton(C.bord, 0.1), 700)
    zones.push({ quoi: 'comp', k, x, y, w: 156, h: CO.h })
  }

  // Trois emplacements de module.
  for (let k = 0; k < E.modulesDe(e); k++) {
    const x = MO.x0 + k * MO.pas
    const id = op.mod?.[k]
    const m = MODULE[id]
    const choisi = detail?.quoi === 'mod' && detail.k === k
    const teinte = m ? COULEUR_FAMILLE[m.famille] : C.bord
    if (choisi) lueur(ctx, x, MO.y, MO.w, MO.h, C.accent, 2, 0.7)
    rect(ctx, x, MO.y, MO.w, MO.h, m ? C.panneau : ton(C.panneau, -0.55))
    rect(ctx, x, MO.y, MO.w, 3, ton(teinte, -0.1))
    cadre(ctx, x, MO.y, MO.w, MO.h, choisi ? C.accent : ton(C.bord, -0.15))
    if (m) P.texteLong(ctx, m.nom, x + MO.w / 2, MO.y + 22, MO.w - 8, 11, teinte, 13)
    else texte(ctx, 'vide', x + MO.w / 2, MO.y + MO.h / 2, 11, ton(C.bord, 0.1), 700)
    zones.push({ quoi: 'mod', k, x, y: MO.y, w: MO.w, h: MO.h })
  }

  detailPanneau(ctx, op, detail, DE)
  zones.push({ quoi: 'retour', ...P.bouton(ctx, 60, 602, 240, 34, 'RETOUR', { vif: true, taille: 14 }) })
  return zones
}

function detailPanneau(ctx, op, detail, DETAIL = { y: 470, h: 122 }) {
  rect(ctx, 20, DETAIL.y, 320, DETAIL.h, ton(C.panneau, -0.3))
  cadre(ctx, 20, DETAIL.y, 320, DETAIL.h, ton(C.bord, -0.25))
  if (!detail) {
    texte(ctx, 'appuie sur un emplacement pour le lire', 180, DETAIL.y + DETAIL.h / 2, 12, C.bord, 700, 300)
    return
  }
  if (detail.quoi === 'comp') {
    const comp = COMP[op.comp[detail.k]]
    if (!comp) return texte(ctx, 'emplacement libre', 180, DETAIL.y + DETAIL.h / 2, 12, C.bord, 700, 300)
    texte(ctx, comp.nom, 180, DETAIL.y + 18, 15, C.texte, 700, 300)
    P.texteLong(ctx, comp.dit, 180, DETAIL.y + 42, 292, 12, C.faible, 15)
    const sur = K.surcoutAxe(op, comp)
    const base = `${comp.cout} cycles · ${comp.temps <= 0.7 ? 'rapide' : comp.temps >= 1.6 ? 'lourde' : 'normale'}`
    texte(ctx, base, 180, DETAIL.y + 92, 11, C.accent, 700, 300)
    if (sur > 0) {
      // Le surcoût s'écrit en clair : une règle qui punit doit se montrer.
      texte(
        ctx,
        `${sur + 2}ᵉ compétence « ${comp.axe} » : +${sur} cycle(s), +${sur * 15} % de temps`,
        180,
        DETAIL.y + 108,
        10,
        C.rouge,
        700,
        300,
      )
    }
    return
  }
  const m = MODULE[op.mod?.[detail.k]]
  if (!m) return texte(ctx, 'emplacement de module libre', 180, DETAIL.y + DETAIL.h / 2, 12, C.bord, 700, 300)
  texte(ctx, m.nom, 180, DETAIL.y + 18, 15, COULEUR_FAMILLE[m.famille], 700, 300)
  P.texteLong(ctx, m.dit, 180, DETAIL.y + 44, 292, 12, C.faible, 15)
  texte(
    ctx,
    `famille ${m.famille} · une seule par famille sur un même opérateur`,
    180,
    DETAIL.y + 100,
    10,
    ton(C.faible, -0.1),
    700,
    300,
  )
}
