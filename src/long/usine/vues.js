import { C, ton } from '../../palette.js'
import { rect, cadre, bloc, lueur, texte, borne } from '../../dessin.js'
import { MACHINES, RECHERCHES, CONTRATS } from './donnees.js'
import { ongletX, fenetreDe } from './dispo.js'
import * as L from './logique.js'

/**
 * Les quatre onglets. Ils ne décident de rien : ils lisent `logique.js`,
 * dessinent, et rendent la liste des lignes touchées. Une ligne dessinée et
 * une ligne touchable sont produites par la même fonction, et **aucune position
 * n'est écrite ici** — tout vient de `dispo.js`, qu'on reçoit sous le nom `d`.
 * C'est ce qui empêche l'écart entre le dessin et la zone de clic, la faute qui
 * donnait à ASCENSION son air buggé et qui avait rendu cette usine inachetable.
 */

export const ONGLETS = [
  { id: 'usine', nom: 'USINE' },
  { id: 'atelier', nom: 'ATELIER' },
  { id: 'recherche', nom: 'ÉTUDES' },
  { id: 'contrats', nom: 'CONTRATS' },
]

export function dessineOnglets(j, ctx, d) {
  const b = d.barre
  ONGLETS.forEach((o, k) => {
    const actif = j.e.vue === o.id
    const alerte = pastilleOnglet(j.e, o.id)
    const x = ongletX(d, k)
    rect(ctx, x, b.y, b.w, b.h, actif ? C.panneau : C.fond)
    cadre(ctx, x, b.y, b.w, b.h, actif ? C.accent : C.bord)
    texte(ctx, o.nom, x + b.w / 2, b.y + b.h / 2, 13, actif ? C.accent : C.faible, 700, b.w - 8)
    if (alerte && !actif) {
      lueur(ctx, x + b.w - 10, b.y + 4, 6, 6, C.accent, 2)
      rect(ctx, x + b.w - 10, b.y + 4, 6, 6, C.accent)
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

export const ongletTouche = (d, p) => {
  const b = d.barre
  if (p.y < b.y || p.y > b.y + b.h) return null
  const k = Math.floor((p.x - b.x) / b.pas)
  return k >= 0 && k < ONGLETS.length && p.x >= ongletX(d, k) && p.x <= ongletX(d, k) + b.w ? ONGLETS[k].id : null
}

// --- Le squelette d'une liste défilante -------------------------------------------

/**
 * Une liste : des lignes de hauteur libre, décalées de `defile`, et seules
 * celles qui tombent dans la fenêtre sont dessinées. Pas de découpe du canvas,
 * donc rien à restaurer et rien qui déborde.
 */
function liste(j, ctx, d, lignes, dessineLigne, fenetre = d.liste.h) {
  // Les lignes posées au dessin sont **conservées** : l'appui relit
  // exactement celles-là.
  //
  // Elles étaient reconstruites à chaque appui, donc sans leur position — les
  // objets n'étaient pas les mêmes — et plus rien dans aucune liste n'était
  // cliquable : ni machine, ni ouvrier, ni amélioration, ni recherche. Seuls
  // la scène et les onglets répondaient encore.
  j.e.posees = lignes
  let y = d.liste.y - j.e.defile
  for (const l of lignes) {
    // On ne dessine que ce qui tombe dans la fenêtre. Pas de découpe du
    // canvas, donc rien à restaurer — et rien ne déborde sur le panneau fixe
    // de la refonte, qui est en dessous.
    if (y + l.h > d.liste.y - 2 && y < d.liste.y + fenetre + 2) dessineLigne(ctx, l, y)
    l._y = y
    y += l.h + 4
  }
}

/**
 * Ne trouve que ce qui a été dessiné : une ligne hors fenêtre n'existe pas, et
 * une ligne jamais posée non plus.
 */
const trouve = (j, quoi, p, d, fenetre = d.liste.h) => {
  if (p.y > d.liste.y + fenetre) return null
  const lignes = j.e.posees ?? []
  return (
    lignes.find(
      (l) => l._y != null && p.y >= l._y && p.y <= l._y + l.h && (!quoi || l.quoi === quoi || quoi === '*'),
    ) ?? null
  )
}

export function hauteur(lignes) {
  return lignes.reduce((s, l) => s + l.h + 4, 0)
}

/** La barre de défilement : sans elle, on ne sait pas qu'il y a une suite. */
function ascenseur(ctx, j, d, total, fenetre = d.liste.h) {
  if (total <= fenetre) return
  const a = d.ascenseur
  const h = Math.max(24, (fenetre / total) * fenetre)
  const y = d.liste.y + (j.e.defile / (total - fenetre)) * (fenetre - h)
  rect(ctx, a.x, d.liste.y, a.w, fenetre, ton(C.panneau, -0.3))
  rect(ctx, a.x, y, a.w, h, C.bord)
}

// --- Onglet USINE -------------------------------------------------------------------

export function lignesUsine(e) {
  const out = [{ quoi: 'ouvriers', h: 48 }]
  for (const i of L.machinesVisibles(e)) out.push({ quoi: 'machine', i, h: 48 })
  return out
}

export function dessineUsine(j, ctx, d) {
  const e = j.e
  const lignes = lignesUsine(e)
  liste(j, ctx, d, lignes, (c, l, y) => {
    if (l.quoi === 'ouvriers') return ligneOuvriers(c, d, e, y)
    ligneMachine(c, d, e, l.i, y)
  })
  ascenseur(ctx, j, d, hauteur(lignes))
}

function ligneOuvriers(ctx, d, e, y) {
  const { x, w } = d.liste
  const prix = L.coutOuvrier(e)
  const possible = e.minerai >= prix
  const cv = L.couverture(e)
  rect(ctx, x, y, w, 48, C.panneau)
  rect(ctx, x, y, 4, 48, cv >= 0.99 ? C.vert : cv > 0.6 ? C.accent : C.rouge)

  ctx.textAlign = 'left'
  texte(ctx, `OUVRIERS ×${e.ouvriers}`, d.ligne.gauche, y + 15, 14, C.texte, 700, w - 148)
  texte(
    ctx,
    `${Math.round(cv * 100)} % des postes · rendement ×${L.facteurOuvriers(e).toFixed(2)}`,
    d.ligne.gauche,
    y + 34,
    11,
    cv >= 0.99 ? C.vert : C.faible,
    700,
    w - 118,
  )
  ctx.textAlign = 'right'
  texte(ctx, 'EMBAUCHER', d.ligne.droite, y + 15, 12, possible ? C.accent : C.bord, 700)
  texte(ctx, L.nombre(prix), d.ligne.droite, y + 34, 13, possible ? C.accent : C.bord, 700)
  ctx.textAlign = 'center'

  // La jauge de couverture, en bas de la ligne : un seul coup d'œil suffit.
  rect(ctx, x, y + 45, w, 3, ton(C.panneau, -0.4))
  rect(ctx, x, y + 45, w * cv, 3, cv >= 0.99 ? C.vert : C.accent)
}

function ligneMachine(ctx, d, e, i, y) {
  const { x, w } = d.liste
  const m = MACHINES[i]
  const prix = L.cout(e, i)
  const possible = e.minerai >= prix
  const mult = L.multiplicateur(e, i)
  const casse = L.enPanne(e, i)

  rect(ctx, x, y, w, 48, C.panneau)
  rect(ctx, x, y + 45, w, 3, ton(C.panneau, -0.5))
  if (possible && !casse) lueur(ctx, x, y, 5, 48, m.couleur, 2)
  bloc(ctx, x, y, 5, 48, casse ? C.rouge : possible ? m.couleur : C.bord, 2)

  ctx.textAlign = 'left'
  texte(ctx, m.nom, d.ligne.gauche, y + 15, 14, casse ? C.rouge : possible ? C.texte : C.faible, 700, w - 148)
  const detail = casse
    ? 'EN PANNE — APPUIE POUR RÉPARER'
    : `${L.nombre(L.productionMachine(e, i))} / s` + (mult > 1 ? `   ×${mult}` : '')
  texte(ctx, detail, d.ligne.gauche, y + 34, 11, casse ? C.rouge : mult > 1 ? C.accent : C.faible, 700, w - 123)
  ctx.textAlign = 'right'
  texte(ctx, `×${e.n[i]}`, d.ligne.droite, y + 15, 14, C.texte, 700)
  texte(ctx, L.nombre(prix), d.ligne.droite, y + 34, 13, possible ? C.accent : C.bord, 700)
  ctx.textAlign = 'center'
}

export function appuiUsine(j, p, d) {
  const l = trouve(j, '*', p, d)
  if (!l) return false
  if (l.quoi === 'ouvriers') {
    if (!L.embauche(j.e)) return (j.son.rate(), true)
    j.son.clic()
    j.fx.bulle(d.ligne.droite - 36, l._y + 12, '+1', C.vert, 14)
    return true
  }
  if (L.enPanne(j.e, l.i)) return (repare(j, l.i, d), true)
  if (!L.acheteMachine(j.e, l.i)) return (j.son.rate(), true)
  j.son.niveau()
  j.fx.eclat(d.ligne.centre, l._y + 24, MACHINES[l.i].couleur, { n: 12, vitesse: 140 })
  return true
}

export function repare(j, i, d) {
  const prime = L.repare(j.e, i)
  j.son.niveau()
  j.fx.secoue(4)
  j.fx.eclat(d.foyer.x, d.foyer.y, C.vert, { n: 14, vitesse: 150 })
  if (prime > 0) j.fx.bulle(d.foyer.x, d.foyer.y - 20, '+' + L.nombre(prime), C.vert, 16)
}

// --- Onglet ATELIER -----------------------------------------------------------------

export function lignesAtelier(e) {
  return L.ameliorationsVisibles(e).map((x) => ({ quoi: 'ame', x, h: 46 }))
}

export function dessineAtelier(j, ctx, d) {
  const e = j.e
  const { x, w } = d.liste
  const fenetre = fenetreDe(d, 'atelier')
  const lignes = lignesAtelier(e)
  liste(
    j,
    ctx,
    d,
    lignes,
    (c, l, y) => {
      const possible = e.minerai >= l.x.cout
      rect(c, x, y, w, 46, C.panneau)
      rect(c, x, y, 4, 46, possible ? C.accent : C.bord)
      c.textAlign = 'left'
      texte(c, l.x.nom, d.ligne.gauche, y + 16, 13, possible ? C.texte : C.faible, 700, w - 128)
      texte(c, l.x.dit, d.ligne.gauche, y + 33, 11, possible ? C.accent : C.faible, 700, w - 128)
      c.textAlign = 'right'
      texte(c, L.nombre(l.x.cout), d.ligne.droite, y + 24, 13, possible ? C.accent : C.bord, 700)
      c.textAlign = 'center'
    },
    fenetre,
  )
  const vide = 'plus rien à forger pour l’instant'
  if (!lignes.length) texte(ctx, vide, d.ligne.centre, d.liste.y + 40, 13, C.bord, 700, w)
  ascenseur(ctx, j, d, hauteur(lignes), fenetre)

  // La refonte reste au même endroit, toujours : c'est la décision la plus
  // lourde du jeu, elle ne doit pas se promener au fil du défilement.
  const f = d.fonte
  const gain = L.lingotsSi(e)
  rect(ctx, f.x, f.y, f.w, f.h, C.fond)
  rect(ctx, f.x, f.y + 4, f.w, f.h - 4, C.panneau)
  cadre(ctx, f.x, f.y + 4, f.w, f.h - 4, gain > 0 ? C.rouge : C.bord)
  texte(ctx, 'TOUT REFONDRE', d.ligne.centre, f.y + 24, 16, gain > 0 ? C.rouge : C.bord, 700)
  texte(
    ctx,
    gain > 0
      ? `+${gain} lingots  →  global ×${(1 + (e.lingots + gain) * 0.25).toFixed(2)}`
      : `il faut ${L.nombre(L.coutProchainLingot(e))} extraits en tout`,
    d.ligne.centre,
    f.y + 45,
    12,
    gain > 0 ? C.accent : C.faible,
    700,
    f.w - 20,
  )
  texte(ctx, 'les recherches et les ouvriers restent', d.ligne.centre, f.y + 62, 10, C.bord, 700, f.w - 20)
}

export function appuiAtelier(j, p, d) {
  if (p.y >= d.fonte.y && p.y <= d.fonte.y + d.fonte.h) {
    const gain = L.refond(j.e)
    if (!gain) return (j.son.rate(), true)
    j.e.vue = 'usine'
    j.e.defile = 0
    j.son.record()
    j.fx.secoue(11)
    j.fx.eclat(d.foyer.x, d.foyer.y, C.accent, { n: 44, vitesse: 300 })
    return true
  }
  const l = trouve(j, 'ame', p, d, fenetreDe(d, 'atelier'))
  if (!l) return false
  if (!L.acheteAmelioration(j.e, l.x.id)) return (j.son.rate(), true)
  j.son.record()
  j.fx.eclat(d.ligne.centre, l._y + 23, C.accent, { n: 16, vitesse: 160 })
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

export function dessineRecherche(j, ctx, d) {
  const e = j.e
  const { x, w } = d.liste
  const lignes = lignesRecherche(e)
  const places = L.placesRecherche(e)

  liste(j, ctx, d, lignes, (c, l, y) => {
    if (l.quoi === 'cours') {
      const r = RECHERCHES.find((x) => x.id === l.c.id)
      const k = 1 - l.c.reste / r.duree
      rect(c, x, y, w, 52, C.panneau)
      rect(c, x, y, 4, 52, C.cyan)
      c.textAlign = 'left'
      texte(c, r.nom, d.ligne.gauche, y + 16, 13, C.cyan, 700, w - 128)
      texte(c, r.dit, d.ligne.gauche, y + 33, 11, C.faible, 700, w - 118)
      c.textAlign = 'right'
      texte(c, L.duree(l.c.reste), d.ligne.droite, y + 22, 13, C.cyan, 700)
      c.textAlign = 'center'
      rect(c, x, y + 47, w, 5, ton(C.panneau, -0.4))
      rect(c, x, y + 47, w * borne(k, 0, 1), 5, C.cyan)
      return
    }
    const r = l.r
    const libre = e.enCours.length < places
    const possible = libre && e.minerai >= r.cout
    rect(c, x, y, w, 52, C.panneau)
    rect(c, x, y, 4, 52, possible ? C.accent : C.bord)
    c.textAlign = 'left'
    texte(c, r.nom, d.ligne.gauche, y + 16, 13, possible ? C.texte : C.faible, 700, w - 128)
    texte(c, r.dit, d.ligne.gauche, y + 33, 11, possible ? C.accent : C.faible, 700, w - 118)
    c.textAlign = 'right'
    texte(c, L.nombre(r.cout), d.ligne.droite, y + 16, 13, possible ? C.accent : C.bord, 700)
    texte(c, L.duree(r.duree), d.ligne.droite, y + 34, 11, C.faible, 700)
    c.textAlign = 'center'
  })

  if (!lignes.length) texte(ctx, 'tout est trouvé', d.ligne.centre, d.liste.y + 40, 13, C.bord, 700)
  ascenseur(ctx, j, d, hauteur(lignes))
  texte(
    ctx,
    `${e.rech.length} / ${RECHERCHES.length} trouvées · ${e.enCours.length} / ${places} en cours`,
    d.ligne.centre,
    d.pied,
    11,
    C.faible,
    700,
    w,
  )
}

export function appuiRecherche(j, p, d) {
  const l = trouve(j, '*', p, d)
  if (!l || l.quoi !== 'libre') return false
  if (!L.lanceRecherche(j.e, l.r.id)) return (j.son.rate(), true)
  j.son.clic()
  j.fx.eclat(d.ligne.centre, l._y + 26, C.cyan, { n: 14, vitesse: 150 })
  return true
}

// --- Onglet CONTRATS ---------------------------------------------------------------------

export function dessineContrats(j, ctx, d) {
  const e = j.e
  const { x, w } = d.liste
  if (!L.placesContrat(e)) {
    texte(ctx, 'personne ne t’a encore rien commandé', d.ligne.centre, d.liste.y + 46, 13, C.bord, 700, w)
    texte(ctx, 'cherche BUREAU COMMERCIAL dans les études', d.ligne.centre, d.liste.y + 70, 12, C.faible, 700, w)
    return
  }

  e.contrats.forEach((c, k) => {
    const m = CONTRATS[c.m]
    const y = d.liste.y + k * 92
    const k2 = borne(c.fait / c.cible, 0, 1)
    const presse = c.reste < m.delai * 0.25
    rect(ctx, x, y, w, 84, C.panneau)
    rect(ctx, x, y, 4, 84, k2 >= 1 ? C.vert : presse ? C.rouge : C.accent)
    ctx.textAlign = 'left'
    texte(ctx, m.nom, d.ligne.gauche, y + 18, 14, C.texte, 700, w - 128)
    texte(ctx, `${L.nombre(c.fait)} / ${L.nombre(c.cible)}`, d.ligne.gauche, y + 38, 12, C.faible, 700, w - 128)
    ctx.textAlign = 'right'
    texte(ctx, L.duree(c.reste), d.ligne.droite, y + 18, 13, presse ? C.rouge : C.faible, 700)
    texte(ctx, prime(m), d.ligne.droite, y + 38, 11, C.accent, 700, w - 178)
    ctx.textAlign = 'center'
    rect(ctx, x + 16, y + 52, w - 32, 8, ton(C.panneau, -0.45))
    rect(ctx, x + 16, y + 52, (w - 32) * k2, 8, k2 >= 1 ? C.vert : C.accent)
    texte(ctx, `${Math.floor(k2 * 100)} %`, d.ligne.centre, y + 72, 12, k2 >= 1 ? C.vert : C.faible, 700)
  })

  if (e.boost > 0) {
    texte(ctx, `prime en cours : tout ×2 pendant ${L.duree(e.boost)}`, d.ligne.centre, d.pied, 12, C.accent, 700, w)
  }
}

const prime = (m) => (m.prime === 'lingot' ? 'lingots' : m.prime === 'multi' ? 'tout ×2' : 'minerai')
