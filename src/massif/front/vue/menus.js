/**
 * Tous les écrans hors bataille : le titre, le camp, la carte des
 * engagements, la caserne, l'état-major, la compagnie, la fiche, le bilan.
 *
 * Chaque fonction dessine **et** rend ses zones tactiles. Une zone n'existe
 * que si quelque chose a été dessiné au même endroit, ce qui interdit
 * structurellement le bouton invisible et le bouton décalé.
 */
import { C, ton } from '../../../palette.js'
import { rect, cadre, texte, largeurTexte, lueur, ombre, px, PX, bandeTramee } from '../../../dessin.js'
import * as U from '../unites.js'
import * as Cie from '../compagnie.js'
import { CL, TYPE, TYPES, EFFICACITE, GRADES } from '../donnees/classes.js'
import { UQ, RAR } from '../donnees/uniques.js'
import { APT } from '../donnees/aptitudes.js'
import { BIOMES } from '../terrain.js'
import { OBJ } from '../carte.js'
import { panneau, bouton, barre, teinteVie, tronque, paragraphe, entete, bourse, lignes } from './pieces.js'

const M = 20
const LARGE = 320

// --- Liste défilante ------------------------------------------------------------------

/**
 * Une liste qui défile au doigt. Les zones renvoyées portent la position
 * **réellement dessinée** : c'est la leçon du bug de l'usine, où l'appui
 * reconstruisait la liste et ne retrouvait donc jamais la ligne touchée.
 */
export function liste(ctx, cadreListe, elements, hauteur, defile, dessineLigne) {
  const zones = []
  const ecart = 4
  let y = cadreListe.y - defile
  for (const el of elements) {
    if (y + hauteur > cadreListe.y - 2 && y < cadreListe.y + cadreListe.h + 2) {
      const z = { x: cadreListe.x, y, w: cadreListe.w, h: hauteur }
      dessineLigne(ctx, z, el)
      zones.push({ ...z, el })
    }
    y += hauteur + ecart
  }
  const total = elements.length * (hauteur + ecart) - ecart
  return { zones, max: Math.max(0, total - cadreListe.h) }
}

// --- Titre --------------------------------------------------------------------------

export function titre(ctx, reprise, meta) {
  bandeTramee(ctx, 0, 96, 360, 180, ton(C.accent, -0.55), 0.35, 0)
  ctx.textAlign = 'center'
  lueur(ctx, 60, 120, 240, 44, C.accent, 3, 0.8)
  texte(ctx, 'FRONT', 180, 146, 46, C.accent, 700, 320, 6)
  texte(ctx, 'une compagnie · un terrain · des hexagones', 180, 186, 12, C.faible, 700, 330)

  if (meta?.meilleurNiveau) {
    texte(ctx, `MEILLEURE COMPAGNIE : NIVEAU ${meta.meilleurNiveau}`, 180, 214, 12, C.vert, 700, 330)
    texte(ctx, `${meta.batailles ?? 0} engagements livrés`, 180, 232, 11, C.faible, 700, 330)
  }
  ctx.textAlign = 'left'

  const zones = []
  if (reprise) {
    const z = { x: 50, y: 300, w: 260, h: 56, quoi: 'reprendre' }
    bouton(ctx, z, 'REPRENDRE', { primaire: true })
    zones.push(z)
  }
  const z = { x: 50, y: reprise ? 368 : 300, w: 260, h: 56, quoi: 'nouvelle' }
  bouton(ctx, z, reprise ? 'NOUVELLE CAMPAGNE' : 'LEVER UNE COMPAGNIE', {
    primaire: !reprise,
    teinte: reprise ? C.rouge : undefined,
  })
  zones.push(z)

  ctx.textAlign = 'center'
  texte(ctx, 'les troupes sont persistantes : ce qui tombe ne revient pas', 180, 470, 11, C.faible, 700, 330)
  texte(ctx, 'les batailles s’agrandissent à mesure que la compagnie monte', 180, 490, 11, C.faible, 700, 330)
  ctx.textAlign = 'left'
  return zones
}

// --- Le camp ------------------------------------------------------------------------

export function camp(ctx, c) {
  entete(ctx, 'LE CAMP', `ENGAGEMENT ${c.engagements + 1}`)

  panneau(ctx, M, 100, LARGE, 66)
  texte(ctx, `NIVEAU ${c.niveau}`, M + 10, 122, 20, C.accent, 700, 150)
  ctx.textAlign = 'right'
  texte(ctx, `${c.victoires} victoires · ${c.pertes} perdus`, 340 - 10, 122, 11, C.faible, 700, 160)
  ctx.textAlign = 'left'
  const k = c.renom / Cie.seuilRenom(c.niveau)
  barre(ctx, M + 10, 134, LARGE - 20, 7, k, C.accent, C.bord)
  texte(ctx, `RENOM ${c.renom}/${Cie.seuilRenom(c.niveau)}`, M + 10, 154, 11, C.faible, 700, 140)
  ctx.textAlign = 'right'
  texte(
    ctx,
    `${Cie.alignees(c).length}/${Cie.places(c.niveau)} EN LIGNE`,
    330,
    154,
    11,
    Cie.alignees(c).length ? C.vert : C.rouge,
    700,
    160,
  )
  ctx.textAlign = 'left'

  const zones = []
  const items = [
    {
      quoi: 'campagne',
      nom: 'PARTIR EN ENGAGEMENT',
      sous: c.plan?.length ? `${c.plan.length} offres` : '',
      primaire: true,
    },
    { quoi: 'caserne', nom: 'CASERNE', sous: `${c.offre?.caserne.length ?? 0} recrues à l’étal` },
    { quoi: 'uniques', nom: 'ÉTAT-MAJOR', sous: `${c.offre?.uniques.length ?? 0} dossiers`, teinte: C.violet },
    { quoi: 'compagnie', nom: 'LA COMPAGNIE', sous: `${c.troupes.length} troupes au dépôt`, teinte: C.cyan },
  ]
  items.forEach((it, i) => {
    const z = { x: M, y: 180 + i * 68, w: LARGE, h: 58, quoi: it.quoi }
    bouton(ctx, z, it.nom, { primaire: it.primaire, teinte: it.teinte })
    ctx.textAlign = 'right'
    texte(ctx, it.sous, 330, z.y + z.h - 12, 10, C.faible, 700, 180)
    ctx.textAlign = 'left'
    zones.push(z)
  })

  if (c.dernier) {
    texte(
      ctx,
      `DERNIER : ${c.dernier.gagne ? 'VICTOIRE' : 'REVERS'} · ${c.dernier.titre ?? ''}`,
      M,
      476,
      11,
      c.dernier.gagne ? C.vert : C.rouge,
      700,
      LARGE,
    )
  }
  if (!Cie.alignees(c).length) texte(ctx, 'AUCUNE TROUPE EN LIGNE — VOIR LA COMPAGNIE', M, 496, 11, C.rouge, 700, LARGE)

  bourse(ctx, c)
  return zones
}

// --- Les engagements ------------------------------------------------------------------

export function campagne(ctx, c, choix) {
  entete(ctx, 'LE FRONT', `NIVEAU ${c.niveau}`)
  const zones = []
  const dims = Cie.dimensions(c.niveau)

  ;(c.plan ?? []).forEach((e, i) => {
    const y = 100 + i * 126
    const pris = choix === i
    const teinte = pris ? C.accent : C.bord
    if (pris) lueur(ctx, M, y, LARGE, 118, C.accent, 2, 0.5)
    panneau(ctx, M, y, LARGE, 118, teinte)
    rect(ctx, M, y, 5, 118, difficulteTeinte(e.difficulte))

    texte(ctx, tronque(ctx, e.nom, 15, LARGE - 24), M + 12, y + 20, 15, C.texte, 700)
    const o = OBJ[e.objectif]
    texte(ctx, o.nom, M + 12, y + 38, 12, C.accent, 700, 200)
    paragraphe(ctx, o.texte, M + 12, y + 54, 10, LARGE - 24, C.faible, 12)

    texte(ctx, `${dims.cols}×${dims.rows} · ${e.toursMax} TOURS`, M + 12, y + 88, 10, C.cyan, 700, 150)
    texte(
      ctx,
      `${difficulteNom(e.difficulte)}${e.penchant ? ' · ' + TYPE[e.penchant].nom : ''}`,
      M + 12,
      y + 104,
      10,
      difficulteTeinte(e.difficulte),
      700,
      190,
    )
    ctx.textAlign = 'right'
    texte(ctx, `${e.or} OR`, 330, y + 88, 13, C.accent, 700, 110)
    texte(ctx, `+${e.renom} RENOM`, 330, y + 104, 10, C.faible, 700, 110)
    ctx.textAlign = 'left'
    zones.push({ x: M, y, w: LARGE, h: 118, quoi: 'offre', k: i })
  })

  const pret = choix != null && Cie.alignees(c).length > 0
  const zEng = { x: M, y: 490, w: LARGE, h: 46, quoi: 'engager' }
  bouton(ctx, zEng, Cie.alignees(c).length ? 'ENGAGER' : 'AUCUNE TROUPE EN LIGNE', { primaire: pret, actif: pret })
  const zRet = { x: M, y: 544, w: LARGE, h: 38, quoi: 'retour' }
  bouton(ctx, zRet, 'RETOUR', { petit: true })
  zones.push(zEng, zRet)
  bourse(ctx, c)
  return zones
}

const difficulteNom = (d) =>
  d < 0.9 ? 'ESCARMOUCHE' : d < 1.05 ? 'ENGAGEMENT ÉGAL' : d < 1.2 ? 'ADVERSAIRE SUPÉRIEUR' : 'BATAILLE RANGÉE'
const difficulteTeinte = (d) => (d < 0.9 ? C.vert : d < 1.05 ? C.accent : C.rouge)

// --- La caserne ------------------------------------------------------------------------

export function caserne(ctx, c, defile) {
  entete(ctx, 'CASERNE', `${c.offre.caserne.length} À L’ÉTAL`)
  texte(ctx, 'recrutement générique · le prix suit le niveau de la compagnie', M, 106, 10, C.faible, 700, LARGE)

  const zone = { x: M, y: 118, w: LARGE, h: 396 }
  const r = liste(ctx, zone, c.offre.caserne, 62, defile, (ctx, z, l) => {
    const cl = CL[l.cl]
    const cher = l.prix > c.or
    const a = ctx.globalAlpha
    if (cher) ctx.globalAlpha = a * 0.45
    panneau(ctx, z.x, z.y, z.w, z.h)
    rect(ctx, z.x, z.y, 4, z.h, TYPE[cl.type].couleur)
    texte(ctx, cl.nom, z.x + 12, z.y + 18, 14, C.texte, 700, 190)
    texte(ctx, `${TYPE[cl.type].nom} · NIVEAU ${l.niv}`, z.x + 12, z.y + 34, 10, C.faible, 700, 190)
    texte(
      ctx,
      `PV ${Math.round(cl.pv * U.ENDURANCE)} · ATT ${cl.att} · DEF ${cl.def} · MVT ${cl.mvt} · P${cl.portee[1]}`,
      z.x + 12,
      z.y + 50,
      10,
      C.cyan,
      700,
      230,
    )
    ctx.textAlign = 'right'
    texte(ctx, `${l.prix}`, z.x + z.w - 12, z.y + 22, 16, cher ? C.rouge : C.accent, 700, 80)
    texte(ctx, 'OR', z.x + z.w - 12, z.y + 40, 10, C.faible, 700, 40)
    ctx.textAlign = 'left'
    ctx.globalAlpha = a
  })
  const zones = r.zones.map((z) => ({ ...z, quoi: 'recrute', cl: z.el.cl }))

  if (!c.offre.caserne.length)
    texte(ctx, 'L’ÉTAL EST VIDE — IL SE REMPLIT APRÈS CHAQUE ENGAGEMENT', M, 160, 11, C.faible, 700, LARGE)
  if (c.troupes.length >= Cie.depotMax(c.niveau)) texte(ctx, 'DÉPÔT PLEIN', M, 528, 11, C.rouge, 700, LARGE)

  const zRet = { x: M, y: 544, w: LARGE, h: 38, quoi: 'retour' }
  bouton(ctx, zRet, 'RETOUR', { petit: true })
  zones.push(zRet)
  bourse(ctx, c)
  return { zones, max: r.max, rect: zone }
}

// --- L'état-major -----------------------------------------------------------------------

export function uniques(ctx, c, defile) {
  entete(ctx, 'ÉTAT-MAJOR', `${c.offre.uniques.length} DOSSIERS`, C.violet)
  texte(ctx, 'des gens qui ont un nom · un seul exemplaire, jamais deux', M, 106, 10, C.faible, 700, LARGE)

  const zone = { x: M, y: 118, w: LARGE, h: 396 }
  const r = liste(ctx, zone, c.offre.uniques, 130, defile, (ctx, z, l) => {
    const uq = UQ[l.uq]
    const rar = RAR[uq.rarete]
    const cher = l.prix > c.or
    const a = ctx.globalAlpha
    if (cher) ctx.globalAlpha = a * 0.5
    lueur(ctx, z.x, z.y, z.w, z.h, C.violet, 2, uq.rarete >= 3 ? 0.55 : 0.2)
    panneau(ctx, z.x, z.y, z.w, z.h, uq.rarete >= 3 ? C.violet : C.bord)

    texte(ctx, uq.nom, z.x + 12, z.y + 22, 18, C.texte, 700, 200)
    ctx.textAlign = 'right'
    texte(ctx, rar.nom, z.x + z.w - 12, z.y + 20, 11, uq.rarete >= 3 ? C.violet : C.faible, 700, 100)
    ctx.textAlign = 'left'
    texte(ctx, tronque(ctx, uq.titre, 11, z.w - 24), z.x + 12, z.y + 38, 11, C.accent, 700)
    texte(
      ctx,
      `${GRADES[Math.max(uq.grade, U.gradeAtteint({ uq: l.uq, niv: l.niv }))].nom} · ${CL[uq.cl].nom} ${l.niv}`,
      z.x + 12,
      z.y + 54,
      10,
      C.cyan,
      700,
      z.w - 24,
    )
    paragraphe(ctx, '« ' + uq.phrase + ' »', z.x + 12, z.y + 72, 10, z.w - 24, C.faible, 12)
    const apts = uq.apt.map((id) => APT[id]?.nom ?? id).join(' · ')
    texte(ctx, tronque(ctx, apts, 9, z.w - 24), z.x + 12, z.y + 104, 9, C.violet, 700)
    ctx.textAlign = 'right'
    texte(ctx, `${l.prix} OR`, z.x + z.w - 12, z.y + 104, 13, cher ? C.rouge : C.accent, 700, 110)
    ctx.textAlign = 'left'
    // Le taux d'apparition, écrit noir sur blanc : c'est une information de
    // jeu, pas un secret de conception.
    texte(ctx, `APPARITION ${(l.taux * 100).toFixed(1)} % À CE NIVEAU`, z.x + 12, z.y + 120, 9, C.faible, 700, 220)
    ctx.globalAlpha = a
  })
  const zones = r.zones.map((z) => ({ ...z, quoi: 'recruteUnique', uq: z.el.uq }))

  if (!c.offre.uniques.length)
    texte(ctx, 'AUCUN DOSSIER — MONTE EN NIVEAU POUR EN VOIR PASSER', M, 160, 11, C.faible, 700, LARGE)

  const zRet = { x: M, y: 544, w: LARGE, h: 38, quoi: 'retour' }
  bouton(ctx, zRet, 'RETOUR', { petit: true })
  zones.push(zRet)
  bourse(ctx, c)
  return { zones, max: r.max, rect: zone }
}

// --- La compagnie -------------------------------------------------------------------------

export function compagnie(ctx, c, sel, defile) {
  entete(ctx, 'LA COMPAGNIE', `${Cie.alignees(c).length}/${Cie.places(c.niveau)} EN LIGNE`, C.cyan)

  const resume = c.escouades
    .map((e, i) => `${i + 1}${i ? 'e' : 're'} ${e.membres.length}/${Cie.tailleEscouade(c.niveau)}`)
    .join(' · ')
  texte(ctx, resume || 'aucune escouade', M, 106, 10, C.faible, 700, LARGE)

  const zone = { x: M, y: 116, w: LARGE, h: 348 }
  const trie = [...c.troupes].sort((a, b) => {
    const ea = c.escouades.findIndex((e) => e.membres.includes(a.id))
    const eb = c.escouades.findIndex((e) => e.membres.includes(b.id))
    return (ea < 0 ? 9 : ea) - (eb < 0 ? 9 : eb) || b.niv - a.niv
  })
  const r = liste(ctx, zone, trie, 46, defile, (ctx, z, u) => {
    const choisi = sel === u.id
    const esc = c.escouades.findIndex((e) => e.membres.includes(u.id))
    panneau(ctx, z.x, z.y, z.w, z.h, choisi ? C.accent : C.bord)
    rect(ctx, z.x, z.y, 4, z.h, TYPE[CL[u.cl].type].couleur)
    texte(ctx, tronque(ctx, U.nomComplet(u), 13, 168), z.x + 12, z.y + 17, 13, u.uq ? C.violet : C.texte, 700)
    texte(
      ctx,
      `${CL[u.cl].nom} ${u.niv}${u.grade ? ' · ' + GRADES[u.grade].nom : ''}`,
      z.x + 12,
      z.y + 33,
      10,
      C.faible,
      700,
      190,
    )
    const k = u.pv / U.fiche(u).pvMax
    barre(ctx, z.x + z.w - 92, z.y + 12, 80, 6, k, teinteVie(k), C.bord)
    ctx.textAlign = 'right'
    texte(
      ctx,
      esc >= 0 ? `${esc + 1}${esc ? 'e' : 're'} ESCOUADE` : 'DÉPÔT',
      z.x + z.w - 12,
      z.y + 32,
      10,
      esc >= 0 ? C.vert : C.faible,
      700,
      110,
    )
    ctx.textAlign = 'left'
  })
  const zones = r.zones.map((z) => ({ ...z, quoi: 'troupe', id: z.el.id }))

  // Les boutons d'affectation n'apparaissent qu'une fois une troupe choisie :
  // un appui suffit ensuite pour la faire monter en ligne.
  if (sel) {
    const n = c.escouades.length + 1
    const w = Math.floor((LARGE - (n - 1) * 6) / n)
    c.escouades.forEach((e, i) => {
      const dedans = e.membres.includes(sel)
      const z = { x: M + i * (w + 6), y: 472, w, h: 36, quoi: 'affecte', k: i }
      bouton(ctx, z, `${i + 1}${i ? 'e' : 're'}`, { teinte: dedans ? C.vert : undefined, petit: true })
      zones.push(z)
    })
    const zDepot = { x: M + c.escouades.length * (w + 6), y: 472, w, h: 36, quoi: 'depot' }
    bouton(ctx, zDepot, 'DÉPÔT', { petit: true })
    const zFiche = { x: M, y: 514, w: LARGE, h: 38, quoi: 'fiche' }
    bouton(ctx, zFiche, 'FICHE DÉTAILLÉE', { primaire: true, petit: true })
    zones.push(zDepot, zFiche)
  } else {
    texte(ctx, 'choisis une troupe pour l’affecter à une escouade', M, 492, 11, C.faible, 700, LARGE)
  }

  const zones2 = []
  if (c.escouades.length < Cie.escouadesMax(c.niveau)) {
    const z = { x: M, y: 556, w: 150, h: 34, quoi: 'nouvelleEscouade' }
    bouton(ctx, z, '+ ESCOUADE', { teinte: C.vert, petit: true })
    zones2.push(z)
  }
  const zRet = { x: M + 158, y: 556, w: LARGE - 158, h: 34, quoi: 'retour' }
  bouton(ctx, zRet, 'RETOUR', { petit: true })
  zones2.push(zRet)

  bourse(ctx, c, 616)
  return { zones: [...zones, ...zones2], max: r.max, rect: zone }
}

// --- La fiche d'une troupe -----------------------------------------------------------------

export function fiche(ctx, c, u) {
  const f = U.fiche(u)
  entete(ctx, tronque(ctx, U.nomComplet(u), 20, 240), `NIVEAU ${u.niv}`, u.uq ? C.violet : C.accent)

  // Un fond plein derrière la fiche : le ciel tramé du moteur passe autrement
  // à travers le texte faible, et la moitié des lignes devient illisible.
  panneau(ctx, M, 98, LARGE, 156)
  texte(ctx, U.titre(u), M + 10, 116, 12, C.accent, 700, LARGE - 20)
  texte(ctx, `${GRADES[u.grade].nom} · ${TYPE[f.type].nom} · ${CL[u.cl].nom}`, M + 10, 132, 11, C.faible, 700, LARGE - 20)

  const k = u.pv / f.pvMax
  barre(ctx, M + 10, 142, LARGE - 20, 10, k, teinteVie(k), C.bord)
  ctx.textAlign = 'right'
  texte(ctx, `${u.pv}/${f.pvMax}`, 330, 164, 11, C.faible, 700, 90)
  ctx.textAlign = 'left'
  texte(ctx, `XP ${u.xp}/${U.besoinXp(u.niv)}`, M + 10, 164, 11, C.cyan, 700, 140)
  barre(ctx, M + 10, 172, LARGE - 20, 5, u.xp / U.besoinXp(u.niv), C.cyan, C.bord)

  const stats = [
    ['ATTAQUE', Math.round(f.att)],
    ['DÉFENSE', Math.round(f.def)],
    ['MOUVEMENT', f.mvt],
    ['PORTÉE', `${f.portee[0]}–${f.portee[1]}`],
    ['VUE', f.vue],
    ['AURA', f.aura || '—'],
  ]
  stats.forEach((s, i) => {
    const x = M + 10 + (i % 2) * ((LARGE - 20) / 2)
    const y = 196 + Math.floor(i / 2) * 20
    texte(ctx, s[0], x, y, 10, C.faible, 700, 96)
    ctx.textAlign = 'right'
    texte(ctx, String(s[1]), x + (LARGE - 20) / 2 - 18, y, 13, C.texte, 700, 46)
    ctx.textAlign = 'left'
  })

  // Le triangle des types, en clair. C'est la seule chose qu'un joueur doit
  // savoir avant de choisir qui frappe qui, et elle n'est écrite nulle part
  // ailleurs dans le jeu.
  const fort = TYPES.filter((t) => EFFICACITE[f.type][t.id] >= 1.25)
    .map((t) => t.court)
    .join(' ')
  const faible = TYPES.filter((t) => EFFICACITE[f.type][t.id] <= 0.85)
    .map((t) => t.court)
    .join(' ')
  texte(ctx, `FORT CONTRE ${fort || '—'}`, M + 10, 262, 10, C.vert, 700, 150)
  ctx.textAlign = 'right'
  texte(ctx, `FAIBLE CONTRE ${faible || '—'}`, 330, 262, 10, C.rouge, 700, 150)
  ctx.textAlign = 'left'

  texte(ctx, 'APTITUDES', M, 278, 11, C.accent, 700, LARGE)
  let y = 298
  for (const id of u.apt) {
    const a = APT[id]
    if (!a) continue
    texte(ctx, a.nom, M, y, 11, a.ordre ? C.violet : C.texte, 700, LARGE)
    y += 14
    y += paragraphe(ctx, a.texte, M + 10, y, 9, LARGE - 10, C.faible, 11) + 6
    if (y > 470) break
  }

  texte(ctx, `${u.batailles} engagements · ${u.tues} mises hors de combat`, M, 492, 10, C.faible, 700, LARGE)

  const zones = []
  const prix = Cie.coutSoin(c, u)
  const demi = Math.floor((LARGE - 6) / 2)
  const zSoin = { x: M, y: 508, w: demi, h: 38, quoi: 'soigne' }
  bouton(ctx, zSoin, prix ? `SOIGNER ${prix}` : 'INTACT', {
    teinte: C.vert,
    actif: prix > 0 && prix <= c.or,
    petit: true,
  })
  const zRef = { x: M + demi + 6, y: 508, w: demi, h: 38, quoi: 'reforme' }
  bouton(ctx, zRef, `RÉFORMER +${U.prixRevente(u, c.niveau)}`, { teinte: C.rouge, petit: true })
  const zRet = { x: M, y: 552, w: LARGE, h: 36, quoi: 'retour' }
  bouton(ctx, zRet, 'RETOUR', { petit: true })
  zones.push(zSoin, zRef, zRet)
  bourse(ctx, c, 616)
  return zones
}

// --- Le bilan ------------------------------------------------------------------------------

export function bilan(ctx, c, r) {
  const teinte = r.gagne ? C.vert : r.rompu ? C.accent : C.rouge
  const mot = r.gagne ? 'TERRAIN TENU' : r.rompu ? 'REPLI EN ORDRE' : 'REVERS'
  ctx.textAlign = 'center'
  lueur(ctx, 60, 96, 240, 40, teinte, 3, 0.7)
  texte(ctx, mot, 180, 118, 28, teinte, 700, 330, 2)
  texte(ctx, r.titre ?? '', 180, 146, 12, C.faible, 700, 330)
  ctx.textAlign = 'left'

  panneau(ctx, M, 164, LARGE, 54)
  texte(ctx, `+${r.or} OR`, M + 12, 186, 16, C.accent, 700, 140)
  ctx.textAlign = 'right'
  texte(ctx, r.renom ? `+${r.renom} RENOM` : 'AUCUN RENOM', 328, 186, 13, r.renom ? C.vert : C.faible, 700, 150)
  ctx.textAlign = 'left'
  if (r.niveaux > 0) texte(ctx, `LA COMPAGNIE PASSE NIVEAU ${c.niveau}`, M + 12, 208, 12, C.accent, 700, 280)
  else texte(ctx, `RENOM ${c.renom}/${Cie.seuilRenom(c.niveau)}`, M + 12, 208, 11, C.faible, 700, 280)

  let y = 240
  if (r.montees.length) {
    texte(ctx, 'PROMOTIONS ET NIVEAUX', M, y, 11, C.accent, 700, LARGE)
    y += 18
    for (const m of r.montees.slice(0, 6)) {
      const bout = m.grade != null ? GRADES[m.grade].nom : `NIVEAU ${m.u.niv}`
      texte(ctx, tronque(ctx, `${U.nomComplet(m.u)} → ${bout}`, 11, LARGE), M + 8, y, 11, C.vert, 700)
      y += 16
    }
    y += 8
  }
  if (r.lignes.length) {
    texte(ctx, 'RAMASSÉS SUR LE TERRAIN', M, y, 11, C.accent, 700, LARGE)
    y += 18
    for (const l of r.lignes.slice(0, 4)) {
      texte(ctx, tronque(ctx, U.nomComplet(l.u), 11, LARGE), M + 8, y, 11, C.accent, 700)
      y += 16
    }
    y += 8
  }
  if (r.perdus.length) {
    texte(ctx, 'NE SONT PAS RENTRÉS', M, y, 11, C.rouge, 700, LARGE)
    y += 18
    for (const u of r.perdus.slice(0, 6)) {
      texte(ctx, tronque(ctx, `${U.nomComplet(u)} · ${CL[u.cl].nom} ${u.niv}`, 11, LARGE), M + 8, y, 11, C.rouge, 700)
      y += 16
    }
  }

  const z = { x: M, y: 552, w: LARGE, h: 44, quoi: 'suite' }
  bouton(ctx, z, 'AU CAMP', { primaire: true })
  return [z]
}

export { liste as listeDefilante }
