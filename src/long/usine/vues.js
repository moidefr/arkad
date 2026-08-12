import { C, ton } from '../../palette.js'
import { rect, cadre, bloc, lueur, texte, borne } from '../../dessin.js'
import { MACHINES, AMELIORATIONS, RECHERCHES, CONTRATS } from './donnees.js'
import * as L from './logique.js'

/**
 * Les quatre onglets. Ils ne décident de rien : ils lisent `logique.js`,
 * dessinent, et rendent la liste des lignes touchées. Une ligne dessinée et
 * une ligne touchable sont produites par la même fonction — c'est ce qui
 * empêche l'écart entre le dessin et la zone de clic, la faute qui donnait à
 * ASCENSION son air buggé.
 */

export const ONGLETS = [
  { id: 'usine', nom: 'USINE' },
  { id: 'atelier', nom: 'ATELIER' },
  { id: 'recherche', nom: 'ÉTUDES' },
  { id: 'contrats', nom: 'CONTRATS' },
]

export const BARRE = { y: 308, h: 34 }
export const LISTE = { y: 350, h: 272 }
const ongletX = (k) => 12 + k * 86

export function dessineOnglets(j, ctx) {
  ONGLETS.forEach((o, k) => {
    const actif = j.e.vue === o.id
    const alerte = pastilleOnglet(j.e, o.id)
    const x = ongletX(k)
    rect(ctx, x, BARRE.y, 82, BARRE.h, actif ? C.panneau : C.fond)
    cadre(ctx, x, BARRE.y, 82, BARRE.h, actif ? C.accent : C.bord)
    texte(ctx, o.nom, x + 41, BARRE.y + 17, 13, actif ? C.accent : C.faible, 700, 74)
    if (alerte && !actif) {
      lueur(ctx, x + 72, BARRE.y + 4, 6, 6, C.accent, 2)
      rect(ctx, x + 72, BARRE.y + 4, 6, 6, C.accent)
    }
  })
}

/** Un point sur l'onglet quand quelque chose y est possible ou fini. */
function pastilleOnglet(e, id) {
  if (id === 'usine')
    return e.pannes.length > 0 || MACHINES.some((_, i) => L.machineOuverte(e, i) && e.minerai >= L.cout(e, i))
  if (id === 'atelier') return L.ameliorationsVisibles(e).some((x) => e.minerai >= x.cout) || L.lingotsSi(e) > 0
  if (id === 'recherche') {
    return e.enCours.length < L.placesRecherche(e) && L.recherchesVisibles(e).some((r) => e.minerai >= r.cout)
  }
  return e.contrats.some((c) => c.fait >= c.cible * 0.9)
}

/** La hauteur visible d'un onglet : l'atelier cède la place au panneau de refonte. */
export const fenetreDe = (vue) => (vue === 'atelier' ? FENETRE_ATELIER : LISTE.h)

export const ongletTouche = (p) => {
  if (p.y < BARRE.y || p.y > BARRE.y + BARRE.h) return null
  const k = Math.floor((p.x - 12) / 86)
  return k >= 0 && k < ONGLETS.length && p.x >= ongletX(k) && p.x <= ongletX(k) + 82 ? ONGLETS[k].id : null
}

// --- Le squelette d'une liste défilante -------------------------------------------

/**
 * Une liste : des lignes de hauteur libre, décalées de `defile`, et seules
 * celles qui tombent dans la fenêtre sont dessinées. Pas de découpe du canvas,
 * donc rien à restaurer et rien qui déborde.
 */
function liste(j, ctx, lignes, dessineLigne, fenetre = LISTE.h) {
  let y = LISTE.y - j.e.defile
  for (const l of lignes) {
    // On ne dessine que ce qui tombe dans la fenêtre. Pas de découpe du
    // canvas, donc rien à restaurer — et rien ne déborde sur le panneau fixe
    // de la refonte, qui est en dessous.
    if (y + l.h > LISTE.y - 2 && y < LISTE.y + fenetre + 2) dessineLigne(ctx, l, y)
    l._y = y
    y += l.h + 4
  }
}

/** Ne trouve que ce qui a été dessiné : une ligne hors fenêtre n'existe pas. */
const trouve = (lignes, p, fenetre = LISTE.h) =>
  p.y > LISTE.y + fenetre ? null : (lignes.find((l) => p.y >= l._y && p.y <= l._y + l.h) ?? null)

export function hauteur(lignes) {
  return lignes.reduce((s, l) => s + l.h + 4, 0)
}

/** La barre de défilement : sans elle, on ne sait pas qu'il y a une suite. */
function ascenseur(ctx, j, total, fenetre = LISTE.h) {
  if (total <= fenetre) return
  const h = Math.max(24, (fenetre / total) * fenetre)
  const y = LISTE.y + (j.e.defile / (total - fenetre)) * (fenetre - h)
  rect(ctx, 353, LISTE.y, 3, fenetre, ton(C.panneau, -0.3))
  rect(ctx, 353, y, 3, h, C.bord)
}

// --- Onglet USINE -------------------------------------------------------------------

export function lignesUsine(e) {
  const out = [{ quoi: 'ouvriers', h: 48 }]
  for (const i of L.machinesVisibles(e)) out.push({ quoi: 'machine', i, h: 48 })
  return out
}

export function dessineUsine(j, ctx) {
  const e = j.e
  const lignes = lignesUsine(e)
  liste(j, ctx, lignes, (c, l, y) => {
    if (l.quoi === 'ouvriers') return ligneOuvriers(c, e, y)
    ligneMachine(c, e, l.i, y)
  })
  ascenseur(ctx, j, hauteur(lignes))
}

function ligneOuvriers(ctx, e, y) {
  const prix = L.coutOuvrier(e)
  const possible = e.minerai >= prix
  const cv = L.couverture(e)
  rect(ctx, 16, y, 328, 48, C.panneau)
  rect(ctx, 16, y, 4, 48, cv >= 0.99 ? C.vert : cv > 0.6 ? C.accent : C.rouge)

  ctx.textAlign = 'left'
  texte(ctx, `OUVRIERS ×${e.ouvriers}`, 32, y + 15, 14, C.texte, 700, 180)
  texte(
    ctx,
    `${Math.round(cv * 100)} % des postes · rendement ×${L.facteurOuvriers(e).toFixed(2)}`,
    32,
    y + 34,
    11,
    cv >= 0.99 ? C.vert : C.faible,
    700,
    210,
  )
  ctx.textAlign = 'right'
  texte(ctx, 'EMBAUCHER', 336, y + 15, 12, possible ? C.accent : C.bord, 700)
  texte(ctx, L.nombre(prix), 336, y + 34, 13, possible ? C.accent : C.bord, 700)
  ctx.textAlign = 'center'

  // La jauge de couverture, en bas de la ligne : un seul coup d'œil suffit.
  rect(ctx, 16, y + 45, 328, 3, ton(C.panneau, -0.4))
  rect(ctx, 16, y + 45, 328 * cv, 3, cv >= 0.99 ? C.vert : C.accent)
}

function ligneMachine(ctx, e, i, y) {
  const m = MACHINES[i]
  const prix = L.cout(e, i)
  const possible = e.minerai >= prix
  const mult = L.multiplicateur(e, i)
  const casse = L.enPanne(e, i)

  rect(ctx, 16, y, 328, 48, C.panneau)
  rect(ctx, 16, y + 45, 328, 3, ton(C.panneau, -0.5))
  if (possible && !casse) lueur(ctx, 16, y, 5, 48, m.couleur, 2)
  bloc(ctx, 16, y, 5, 48, casse ? C.rouge : possible ? m.couleur : C.bord, 2)

  ctx.textAlign = 'left'
  texte(ctx, m.nom, 32, y + 15, 14, casse ? C.rouge : possible ? C.texte : C.faible, 700, 180)
  const detail = casse
    ? 'EN PANNE — APPUIE POUR RÉPARER'
    : `${L.nombre(L.productionMachine(e, i))} / s` + (mult > 1 ? `   ×${mult}` : '')
  texte(ctx, detail, 32, y + 34, 11, casse ? C.rouge : mult > 1 ? C.accent : C.faible, 700, 205)
  ctx.textAlign = 'right'
  texte(ctx, `×${e.n[i]}`, 336, y + 15, 14, C.texte, 700)
  texte(ctx, L.nombre(prix), 336, y + 34, 13, possible ? C.accent : C.bord, 700)
  ctx.textAlign = 'center'
}

export function appuiUsine(j, p) {
  const l = trouve(lignesUsine(j.e), p)
  if (!l) return false
  if (l.quoi === 'ouvriers') {
    if (!L.embauche(j.e)) return (j.son.rate(), true)
    j.son.clic()
    j.fx.bulle(300, l._y + 12, '+1', C.vert, 14)
    return true
  }
  if (L.enPanne(j.e, l.i)) return (repare(j, l.i), true)
  if (!L.acheteMachine(j.e, l.i)) return (j.son.rate(), true)
  j.son.niveau()
  j.fx.eclat(180, l._y + 24, MACHINES[l.i].couleur, { n: 12, vitesse: 140 })
  return true
}

export function repare(j, i) {
  const prime = L.repare(j.e, i)
  j.son.niveau()
  j.fx.secoue(4)
  j.fx.eclat(180, 240, C.vert, { n: 14, vitesse: 150 })
  if (prime > 0) j.fx.bulle(180, 220, '+' + L.nombre(prime), C.vert, 16)
}

// --- Onglet ATELIER -----------------------------------------------------------------

const FONTE = { y: 546, h: 74 }
/** La liste des améliorations s'arrête au-dessus du panneau de refonte. */
const FENETRE_ATELIER = FONTE.y - LISTE.y - 8

export function lignesAtelier(e) {
  return L.ameliorationsVisibles(e).map((x) => ({ quoi: 'ame', x, h: 46 }))
}

export function dessineAtelier(j, ctx) {
  const e = j.e
  const lignes = lignesAtelier(e)
  liste(
    j,
    ctx,
    lignes,
    (c, l, y) => {
      const possible = e.minerai >= l.x.cout
      rect(c, 16, y, 328, 46, C.panneau)
      rect(c, 16, y, 4, 46, possible ? C.accent : C.bord)
      c.textAlign = 'left'
      texte(c, l.x.nom, 32, y + 16, 13, possible ? C.texte : C.faible, 700, 200)
      texte(c, l.x.dit, 32, y + 33, 11, possible ? C.accent : C.faible, 700, 200)
      c.textAlign = 'right'
      texte(c, L.nombre(l.x.cout), 336, y + 24, 13, possible ? C.accent : C.bord, 700)
      c.textAlign = 'center'
    },
    FENETRE_ATELIER,
  )
  if (!lignes.length) texte(ctx, 'plus rien à forger pour l’instant', 180, LISTE.y + 40, 13, C.bord, 700)
  ascenseur(ctx, j, hauteur(lignes), FENETRE_ATELIER)

  // La refonte reste au même endroit, toujours : c'est la décision la plus
  // lourde du jeu, elle ne doit pas se promener au fil du défilement.
  const gain = L.lingotsSi(e)
  rect(ctx, 16, FONTE.y, 328, FONTE.h, C.fond)
  rect(ctx, 16, FONTE.y + 4, 328, FONTE.h - 4, C.panneau)
  cadre(ctx, 16, FONTE.y + 4, 328, FONTE.h - 4, gain > 0 ? C.rouge : C.bord)
  texte(ctx, 'TOUT REFONDRE', 180, FONTE.y + 24, 16, gain > 0 ? C.rouge : C.bord, 700)
  texte(
    ctx,
    gain > 0
      ? `+${gain} lingots  →  global ×${(1 + (e.lingots + gain) * 0.25).toFixed(2)}`
      : `il faut ${L.nombre(L.coutProchainLingot(e))} extraits en tout`,
    180,
    FONTE.y + 45,
    12,
    gain > 0 ? C.accent : C.faible,
    700,
    308,
  )
  texte(ctx, 'les recherches et les ouvriers restent', 180, FONTE.y + 62, 10, C.bord, 700, 308)
}

export function appuiAtelier(j, p) {
  if (p.y >= FONTE.y && p.y <= FONTE.y + FONTE.h) {
    const gain = L.refond(j.e)
    if (!gain) return (j.son.rate(), true)
    j.e.vue = 'usine'
    j.e.defile = 0
    j.son.record()
    j.fx.secoue(11)
    j.fx.eclat(180, 250, C.accent, { n: 44, vitesse: 300 })
    return true
  }
  const l = trouve(lignesAtelier(j.e), p, FENETRE_ATELIER)
  if (!l) return false
  if (!L.acheteAmelioration(j.e, l.x.id)) return (j.son.rate(), true)
  j.son.record()
  j.fx.eclat(180, l._y + 23, C.accent, { n: 16, vitesse: 160 })
  return true
}

// --- Onglet ÉTUDES --------------------------------------------------------------------

export function lignesRecherche(e) {
  const out = e.enCours.map((c) => ({ quoi: 'cours', c, h: 52 }))
  for (const r of L.recherchesVisibles(e)) {
    if (e.enCours.some((c) => c.id === r.id)) continue
    out.push({ quoi: 'libre', r, h: 52 })
  }
  return out
}

export function dessineRecherche(j, ctx) {
  const e = j.e
  const lignes = lignesRecherche(e)
  const places = L.placesRecherche(e)

  liste(j, ctx, lignes, (c, l, y) => {
    if (l.quoi === 'cours') {
      const r = RECHERCHES.find((x) => x.id === l.c.id)
      const k = 1 - l.c.reste / r.duree
      rect(c, 16, y, 328, 52, C.panneau)
      rect(c, 16, y, 4, 52, C.cyan)
      c.textAlign = 'left'
      texte(c, r.nom, 32, y + 16, 13, C.cyan, 700, 200)
      texte(c, r.dit, 32, y + 33, 11, C.faible, 700, 210)
      c.textAlign = 'right'
      texte(c, L.duree(l.c.reste), 336, y + 22, 13, C.cyan, 700)
      c.textAlign = 'center'
      rect(c, 16, y + 47, 328, 5, ton(C.panneau, -0.4))
      rect(c, 16, y + 47, 328 * borne(k, 0, 1), 5, C.cyan)
      return
    }
    const r = l.r
    const libre = e.enCours.length < places
    const possible = libre && e.minerai >= r.cout
    rect(c, 16, y, 328, 52, C.panneau)
    rect(c, 16, y, 4, 52, possible ? C.accent : C.bord)
    c.textAlign = 'left'
    texte(c, r.nom, 32, y + 16, 13, possible ? C.texte : C.faible, 700, 200)
    texte(c, r.dit, 32, y + 33, 11, possible ? C.accent : C.faible, 700, 210)
    c.textAlign = 'right'
    texte(c, L.nombre(r.cout), 336, y + 16, 13, possible ? C.accent : C.bord, 700)
    texte(c, L.duree(r.duree), 336, y + 34, 11, C.faible, 700)
    c.textAlign = 'center'
  })

  if (!lignes.length) texte(ctx, 'tout est trouvé', 180, LISTE.y + 40, 13, C.bord, 700)
  ascenseur(ctx, j, hauteur(lignes))
  texte(
    ctx,
    `${e.rech.length} / ${RECHERCHES.length} trouvées · ${e.enCours.length} / ${places} en cours`,
    180,
    630,
    11,
    C.faible,
    700,
    330,
  )
}

export function appuiRecherche(j, p) {
  const l = trouve(lignesRecherche(j.e), p)
  if (!l || l.quoi !== 'libre') return false
  if (!L.lanceRecherche(j.e, l.r.id)) return (j.son.rate(), true)
  j.son.clic()
  j.fx.eclat(180, l._y + 26, C.cyan, { n: 14, vitesse: 150 })
  return true
}

// --- Onglet CONTRATS ---------------------------------------------------------------------

export function dessineContrats(j, ctx) {
  const e = j.e
  if (!L.placesContrat(e)) {
    texte(ctx, 'personne ne t’a encore rien commandé', 180, LISTE.y + 46, 13, C.bord, 700, 330)
    texte(ctx, 'cherche BUREAU COMMERCIAL dans les études', 180, LISTE.y + 70, 12, C.faible, 700, 330)
    return
  }

  e.contrats.forEach((c, k) => {
    const m = CONTRATS[c.m]
    const y = LISTE.y + k * 92
    const k2 = borne(c.fait / c.cible, 0, 1)
    const presse = c.reste < m.delai * 0.25
    rect(ctx, 16, y, 328, 84, C.panneau)
    rect(ctx, 16, y, 4, 84, k2 >= 1 ? C.vert : presse ? C.rouge : C.accent)
    ctx.textAlign = 'left'
    texte(ctx, m.nom, 32, y + 18, 14, C.texte, 700, 200)
    texte(ctx, `${L.nombre(c.fait)} / ${L.nombre(c.cible)}`, 32, y + 38, 12, C.faible, 700, 200)
    ctx.textAlign = 'right'
    texte(ctx, L.duree(c.reste), 336, y + 18, 13, presse ? C.rouge : C.faible, 700)
    texte(ctx, prime(m), 336, y + 38, 11, C.accent, 700, 150)
    ctx.textAlign = 'center'
    rect(ctx, 32, y + 52, 296, 8, ton(C.panneau, -0.45))
    rect(ctx, 32, y + 52, 296 * k2, 8, k2 >= 1 ? C.vert : C.accent)
    texte(ctx, `${Math.floor(k2 * 100)} %`, 180, y + 72, 12, k2 >= 1 ? C.vert : C.faible, 700)
  })

  if (e.boost > 0) {
    texte(ctx, `prime en cours : tout ×2 pendant ${L.duree(e.boost)}`, 180, 630, 12, C.accent, 700, 330)
  }
}

const prime = (m) => (m.prime === 'lingot' ? 'lingots' : m.prime === 'multi' ? 'tout ×2' : 'minerai')
