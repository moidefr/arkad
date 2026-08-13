/**
 * Tous les écrans hors bataille : le titre, le camp, la carte des
 * engagements, la caserne, l'état-major, la compagnie, la fiche, le bilan.
 *
 * Chaque fonction lit ses rectangles dans `dispo.js` et rend les zones
 * tactiles **au même endroit qu'elle a dessiné**. Une zone n'existe que si
 * quelque chose a été peint dessus, ce qui interdit structurellement le bouton
 * invisible et le bouton décalé — et vaut dans les deux gabarits, puisque
 * personne ici ne sait dans quel sens il travaille.
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
import * as D from './dispo.js'

// --- Liste défilante ------------------------------------------------------------------

/**
 * Une liste qui défile au doigt, sur une ou deux colonnes. Les zones renvoyées
 * portent la position **réellement dessinée** : c'est la leçon du bug de
 * l'usine, où l'appui reconstruisait la liste et ne retrouvait donc jamais la
 * ligne touchée.
 *
 * Elles sont en plus **rognées au cadre**. Rien ici ne découpe le dessin : une
 * ligne à cheval sur le bord déborde, le bouton dessiné après la recouvre, et
 * sa zone restait touchable dessous. On voyait RETOUR, on touchait la recrue,
 * et l'or partait.
 */
export function liste(ctx, cadreListe, elements, hauteur, defile, dessineLigne, cols = 1) {
  const zones = []
  const ecart = 4
  const w = Math.floor((cadreListe.w - (cols - 1) * ecart) / cols)
  const bas = cadreListe.y + cadreListe.h
  elements.forEach((el, i) => {
    const y = cadreListe.y + Math.floor(i / cols) * (hauteur + ecart) - defile
    if (y + hauteur <= cadreListe.y - 2 || y >= bas + 2) return
    const z = { x: cadreListe.x + (i % cols) * (w + ecart), y, w, h: hauteur }
    dessineLigne(ctx, z, el)
    const haut = Math.max(y, cadreListe.y)
    const fin = Math.min(y + hauteur, bas)
    if (fin - haut >= 24) zones.push({ ...z, y: haut, h: fin - haut, el })
  })
  const rangs = Math.ceil(elements.length / cols)
  const total = rangs * (hauteur + ecart) - ecart
  return { zones, max: Math.max(0, total - cadreListe.h) }
}

// --- Titre --------------------------------------------------------------------------

export function titre(ctx, j, reprise, meta) {
  const d = D.titre(j, reprise)
  bandeTramee(ctx, d.bande.x, d.bande.y, d.bande.w, d.bande.h, ton(C.accent, -0.55), 0.35, 0)
  ctx.textAlign = 'center'
  lueur(ctx, d.lueur.x, d.lueur.y, d.lueur.w, d.lueur.h, C.accent, 3, 0.8)
  texte(ctx, 'FRONT', d.nom.x, d.nom.y, 46, C.accent, 700, d.nom.max, 6)
  texte(ctx, 'une compagnie · un terrain · des hexagones', d.sous.x, d.sous.y, 12, C.faible, 700, d.sous.max)

  if (meta?.meilleurNiveau) {
    const [a, b] = d.meta
    texte(ctx, `MEILLEURE COMPAGNIE : NIVEAU ${meta.meilleurNiveau}`, a.x, a.y, 12, C.vert, 700, 330)
    texte(ctx, `${meta.batailles ?? 0} engagements livrés`, b.x, b.y, 11, C.faible, 700, 330)
  }
  ctx.textAlign = 'left'

  const zones = []
  if (reprise) {
    bouton(ctx, d.reprendre, 'REPRENDRE', { primaire: true })
    zones.push(d.reprendre)
  }
  bouton(ctx, d.nouvelle, reprise ? 'NOUVELLE CAMPAGNE' : 'LEVER UNE COMPAGNIE', {
    primaire: !reprise,
    teinte: reprise ? C.rouge : undefined,
  })
  zones.push(d.nouvelle)

  ctx.textAlign = 'center'
  const [p1, p2] = d.pied
  texte(ctx, 'les troupes sont persistantes : ce qui tombe ne revient pas', p1.x, p1.y, 11, C.faible, 700, 330)
  texte(ctx, 'les batailles s’agrandissent à mesure que la compagnie monte', p2.x, p2.y, 11, C.faible, 700, 330)
  ctx.textAlign = 'left'
  return zones
}

// --- Le camp ------------------------------------------------------------------------

export function camp(ctx, j, c) {
  const ch = D.chassis(j)
  const d = D.camp(j)
  entete(ctx, ch.entete, 'LE CAMP', `ENGAGEMENT ${c.engagements + 1}`)

  const r = d.resume
  const droite = r.x + r.w - 10
  panneau(ctx, r.x, r.y, r.w, r.h)
  texte(ctx, `NIVEAU ${c.niveau}`, r.x + 10, r.y + 22, 20, C.accent, 700, 150)
  ctx.textAlign = 'right'
  texte(ctx, `${c.victoires} victoires · ${c.pertes} perdus`, droite, r.y + 22, 11, C.faible, 700, 160)
  ctx.textAlign = 'left'
  const k = c.renom / Cie.seuilRenom(c.niveau)
  barre(ctx, r.x + 10, r.y + 34, r.w - 20, 7, k, C.accent, C.bord)
  texte(ctx, `RENOM ${c.renom}/${Cie.seuilRenom(c.niveau)}`, r.x + 10, r.y + 54, 11, C.faible, 700, 140)
  ctx.textAlign = 'right'
  texte(
    ctx,
    `${Cie.alignees(c).length}/${Cie.places(c.niveau)} EN LIGNE`,
    droite,
    r.y + 54,
    11,
    Cie.alignees(c).length ? C.vert : C.rouge,
    700,
    160,
  )
  ctx.textAlign = 'left'

  const libelles = {
    campagne: { nom: 'PARTIR EN ENGAGEMENT', sous: c.plan?.length ? `${c.plan.length} offres` : '', primaire: true },
    caserne: { nom: 'CASERNE', sous: `${c.offre?.caserne.length ?? 0} recrues à l’étal` },
    uniques: { nom: 'ÉTAT-MAJOR', sous: `${c.offre?.uniques.length ?? 0} dossiers`, teinte: C.violet },
    compagnie: { nom: 'LA COMPAGNIE', sous: `${c.troupes.length} troupes au dépôt`, teinte: C.cyan },
  }
  for (const z of d.items) {
    const it = libelles[z.quoi]
    bouton(ctx, z, it.nom, { primaire: it.primaire, teinte: it.teinte })
    ctx.textAlign = 'right'
    texte(ctx, it.sous, z.x + z.w - 10, z.y + z.h - 12, 10, C.faible, 700, 180)
    ctx.textAlign = 'left'
  }

  if (c.dernier) {
    texte(
      ctx,
      `DERNIER : ${c.dernier.gagne ? 'VICTOIRE' : 'REVERS'} · ${c.dernier.titre ?? ''}`,
      d.dernier.x,
      d.dernier.y,
      11,
      c.dernier.gagne ? C.vert : C.rouge,
      700,
      ch.L,
    )
  }
  if (!Cie.alignees(c).length)
    texte(ctx, 'AUCUNE TROUPE EN LIGNE — VOIR LA COMPAGNIE', d.alerte.x, d.alerte.y, 11, C.rouge, 700, ch.L)

  bourse(ctx, c, D.bourse(j))
  return d.items
}

// --- Les engagements ------------------------------------------------------------------

export function campagne(ctx, j, c, choix) {
  const ch = D.chassis(j)
  const offres = c.plan ?? []
  const d = D.campagne(j, offres.length)
  entete(ctx, ch.entete, 'LE FRONT', `NIVEAU ${c.niveau}`)
  const zones = []
  const dims = Cie.dimensions(c.niveau)

  offres.forEach((e, i) => {
    const z = d.offres[i]
    const pris = choix === i
    const teinte = pris ? C.accent : C.bord
    if (pris) lueur(ctx, z.x, z.y, z.w, z.h, C.accent, 2, 0.5)
    panneau(ctx, z.x, z.y, z.w, z.h, teinte)
    rect(ctx, z.x, z.y, 5, z.h, difficulteTeinte(e.difficulte))

    texte(ctx, tronque(ctx, e.nom, 15, z.w - 24), z.x + 12, z.y + d.dy.nom, 15, C.texte, 700)
    const o = OBJ[e.objectif]
    texte(ctx, o.nom, z.x + 12, z.y + d.dy.obj, 12, C.accent, 700, Math.min(200, z.w - 24))
    paragraphe(ctx, o.texte, z.x + 12, z.y + d.dy.para, 10, z.w - 24, C.faible, 12)

    texte(ctx, `${dims.cols}×${dims.rows} · ${e.toursMax} TOURS`, z.x + 12, z.y + d.dy.dims, 10, C.cyan, 700, 150)
    texte(
      ctx,
      `${difficulteNom(e.difficulte)}${e.penchant ? ' · ' + TYPE[e.penchant].nom : ''}`,
      z.x + 12,
      z.y + d.dy.diff,
      10,
      difficulteTeinte(e.difficulte),
      700,
      Math.min(190, z.w - 24),
    )
    ctx.textAlign = 'right'
    texte(ctx, `${e.or} OR`, z.x + z.w - 10, z.y + d.dy.or, 13, C.accent, 700, 110)
    texte(ctx, `+${e.renom} RENOM`, z.x + z.w - 10, z.y + d.dy.renom, 10, C.faible, 700, 110)
    ctx.textAlign = 'left'
    zones.push(z)
  })

  const pret = choix != null && Cie.alignees(c).length > 0
  bouton(ctx, d.engager, Cie.alignees(c).length ? 'ENGAGER' : 'AUCUNE TROUPE EN LIGNE', { primaire: pret, actif: pret })
  bouton(ctx, d.retour, 'RETOUR', { petit: true })
  zones.push(d.engager, d.retour)
  bourse(ctx, c, D.bourse(j))
  return zones
}

const difficulteNom = (d) =>
  d < 0.9 ? 'ESCARMOUCHE' : d < 1.05 ? 'ENGAGEMENT ÉGAL' : d < 1.2 ? 'ADVERSAIRE SUPÉRIEUR' : 'BATAILLE RANGÉE'
const difficulteTeinte = (d) => (d < 0.9 ? C.vert : d < 1.05 ? C.accent : C.rouge)

// --- La caserne ------------------------------------------------------------------------

export function caserne(ctx, j, c, defile) {
  const ch = D.chassis(j)
  const d = D.caserne(j)
  entete(ctx, ch.entete, 'CASERNE', `${c.offre.caserne.length} À L’ÉTAL`)
  texte(
    ctx,
    'recrutement générique · le prix suit le niveau de la compagnie',
    d.legende.x,
    d.legende.y,
    10,
    C.faible,
    700,
    ch.L,
  )

  const r = liste(
    ctx,
    d.zone,
    c.offre.caserne,
    d.ligne,
    defile,
    (ctx, z, l) => {
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
    },
    d.cols,
  )
  const zones = r.zones.map((z) => ({ ...z, quoi: 'recrute', cl: z.el.cl }))

  if (!c.offre.caserne.length)
    texte(ctx, 'L’ÉTAL EST VIDE — IL SE REMPLIT APRÈS CHAQUE ENGAGEMENT', d.vide.x, d.vide.y, 11, C.faible, 700, ch.L)
  if (c.troupes.length >= Cie.depotMax(c.niveau))
    texte(ctx, 'DÉPÔT PLEIN', d.plein.x, d.plein.y, 11, C.rouge, 700, ch.L)

  bouton(ctx, d.retour, 'RETOUR', { petit: true })
  zones.push(d.retour)
  bourse(ctx, c, D.bourse(j))
  return { zones, max: r.max, rect: d.zone }
}

// --- L'état-major -----------------------------------------------------------------------

export function uniques(ctx, j, c, defile) {
  const ch = D.chassis(j)
  const d = D.uniques(j)
  entete(ctx, ch.entete, 'ÉTAT-MAJOR', `${c.offre.uniques.length} DOSSIERS`, C.violet)
  texte(
    ctx,
    'des gens qui ont un nom · un seul exemplaire, jamais deux',
    d.legende.x,
    d.legende.y,
    10,
    C.faible,
    700,
    ch.L,
  )

  const r = liste(
    ctx,
    d.zone,
    c.offre.uniques,
    d.ligne,
    defile,
    (ctx, z, l) => {
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
    },
    d.cols,
  )
  const zones = r.zones.map((z) => ({ ...z, quoi: 'recruteUnique', uq: z.el.uq }))

  if (!c.offre.uniques.length)
    texte(ctx, 'AUCUN DOSSIER — MONTE EN NIVEAU POUR EN VOIR PASSER', d.vide.x, d.vide.y, 11, C.faible, 700, ch.L)

  bouton(ctx, d.retour, 'RETOUR', { petit: true })
  zones.push(d.retour)
  bourse(ctx, c, D.bourse(j))
  return { zones, max: r.max, rect: d.zone }
}

// --- La compagnie -------------------------------------------------------------------------

export function compagnie(ctx, j, c, sel, defile) {
  const ch = D.chassis(j)
  const peutOuvrir = c.escouades.length < Cie.escouadesMax(c.niveau)
  const d = D.compagnie(j, c.escouades.length + 1, peutOuvrir)
  entete(ctx, ch.entete, 'LA COMPAGNIE', `${Cie.alignees(c).length}/${Cie.places(c.niveau)} EN LIGNE`, C.cyan)

  const resume = c.escouades
    .map((e, i) => `${i + 1}${i ? 'e' : 're'} ${e.membres.length}/${Cie.tailleEscouade(c.niveau)}`)
    .join(' · ')
  texte(ctx, resume || 'aucune escouade', d.legende.x, d.legende.y, 10, C.faible, 700, ch.L)

  const trie = [...c.troupes].sort((a, b) => {
    const ea = c.escouades.findIndex((e) => e.membres.includes(a.id))
    const eb = c.escouades.findIndex((e) => e.membres.includes(b.id))
    return (ea < 0 ? 9 : ea) - (eb < 0 ? 9 : eb) || b.niv - a.niv
  })
  const r = liste(
    ctx,
    d.zone,
    trie,
    d.ligne,
    defile,
    (ctx, z, u) => {
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
    },
    d.cols,
  )
  const zones = r.zones.map((z) => ({ ...z, quoi: 'troupe', id: z.el.id }))

  // Les boutons d'affectation n'apparaissent qu'une fois une troupe choisie :
  // un appui suffit ensuite pour la faire monter en ligne.
  if (sel) {
    c.escouades.forEach((e, i) => {
      const dedans = e.membres.includes(sel)
      const z = { ...d.escouades[i], quoi: 'affecte', k: i }
      bouton(ctx, z, `${i + 1}${i ? 'e' : 're'}`, { teinte: dedans ? C.vert : undefined, petit: true })
      zones.push(z)
    })
    const zDepot = { ...d.escouades[c.escouades.length], quoi: 'depot' }
    bouton(ctx, zDepot, 'DÉPÔT', { petit: true })
    bouton(ctx, d.fiche, 'FICHE DÉTAILLÉE', { primaire: true, petit: true })
    zones.push(zDepot, d.fiche)
  } else {
    texte(ctx, 'choisis une troupe pour l’affecter à une escouade', d.invite.x, d.invite.y, 11, C.faible, 700, ch.L)
  }

  const zones2 = []
  if (peutOuvrir) {
    bouton(ctx, d.ouvrir, '+ ESCOUADE', { teinte: C.vert, petit: true })
    zones2.push(d.ouvrir)
  }
  // Sans escouade à ouvrir, RETOUR prend toute la place au lieu de flotter à
  // droite d'un vide.
  bouton(ctx, d.retour, 'RETOUR', { petit: true })
  zones2.push(d.retour)

  bourse(ctx, c, D.bourse(j, true))
  return { zones: [...zones, ...zones2], max: r.max, rect: d.zone }
}

// --- La fiche d'une troupe -----------------------------------------------------------------

export function fiche(ctx, j, c, u) {
  const ch = D.chassis(j)
  const d = D.fiche(j)
  const f = U.fiche(u)
  entete(ctx, ch.entete, tronque(ctx, U.nomComplet(u), 20, 240), `NIVEAU ${u.niv}`, u.uq ? C.violet : C.accent)

  // Un fond plein derrière la fiche : le ciel tramé du moteur passe autrement
  // à travers le texte faible, et la moitié des lignes devient illisible.
  const p = d.panneau
  const ix = p.x + 10
  const iw = p.w - 20
  const droite = p.x + p.w - 10
  panneau(ctx, p.x, p.y, p.w, p.h)
  texte(ctx, U.titre(u), ix, p.y + 18, 12, C.accent, 700, iw)
  texte(ctx, `${GRADES[u.grade].nom} · ${TYPE[f.type].nom} · ${CL[u.cl].nom}`, ix, p.y + 34, 11, C.faible, 700, iw)

  const k = u.pv / f.pvMax
  barre(ctx, ix, p.y + 44, iw, 10, k, teinteVie(k), C.bord)
  ctx.textAlign = 'right'
  texte(ctx, `${u.pv}/${f.pvMax}`, droite, p.y + 66, 11, C.faible, 700, 90)
  ctx.textAlign = 'left'
  texte(ctx, `XP ${u.xp}/${U.besoinXp(u.niv)}`, ix, p.y + 66, 11, C.cyan, 700, 140)
  barre(ctx, ix, p.y + 74, iw, 5, u.xp / U.besoinXp(u.niv), C.cyan, C.bord)

  const stats = [
    ['ATTAQUE', Math.round(f.att)],
    ['DÉFENSE', Math.round(f.def)],
    ['MOUVEMENT', f.mvt],
    ['PORTÉE', `${f.portee[0]}–${f.portee[1]}`],
    ['VUE', f.vue],
    ['AURA', f.aura || '—'],
  ]
  const demi = iw / 2
  stats.forEach((s, i) => {
    const x = ix + (i % 2) * demi
    const y = p.y + 98 + Math.floor(i / 2) * 20
    texte(ctx, s[0], x, y, 10, C.faible, 700, 96)
    ctx.textAlign = 'right'
    texte(ctx, String(s[1]), x + demi - 18, y, 13, C.texte, 700, 46)
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
  texte(ctx, `FORT CONTRE ${fort || '—'}`, d.fort.x, d.fort.y, 10, C.vert, 700, 150)
  ctx.textAlign = 'right'
  texte(ctx, `FAIBLE CONTRE ${faible || '—'}`, d.faible.x, d.faible.y, 10, C.rouge, 700, 150)
  ctx.textAlign = 'left'

  const a = d.aptitudes
  texte(ctx, 'APTITUDES', a.x, a.y, 11, C.accent, 700, a.w)
  let y = a.debut
  for (const id of u.apt) {
    const apt = APT[id]
    if (!apt) continue
    texte(ctx, apt.nom, a.x, y, 11, apt.ordre ? C.violet : C.texte, 700, a.w)
    y += 14
    y += paragraphe(ctx, apt.texte, a.x + 10, y, 9, a.w - 10, C.faible, 11) + 6
    if (y > a.max) break
  }

  texte(
    ctx,
    `${u.batailles} engagements · ${u.tues} mises hors de combat`,
    d.compteurs.x,
    d.compteurs.y,
    10,
    C.faible,
    700,
    p.w,
  )

  const prix = Cie.coutSoin(c, u)
  bouton(ctx, d.soigne, prix ? `SOIGNER ${prix}` : 'INTACT', {
    teinte: C.vert,
    actif: prix > 0 && prix <= c.or,
    petit: true,
  })
  bouton(ctx, d.reforme, `RÉFORMER +${U.prixRevente(u, c.niveau)}`, { teinte: C.rouge, petit: true })
  bouton(ctx, d.retour, 'RETOUR', { petit: true })
  bourse(ctx, c, D.bourse(j, true))
  return [d.soigne, d.reforme, d.retour]
}

// --- Le bilan ------------------------------------------------------------------------------

export function bilan(ctx, j, c, r) {
  const d = D.bilan(j)
  const teinte = r.gagne ? C.vert : r.rompu ? C.accent : C.rouge
  const mot = r.gagne ? 'TERRAIN TENU' : r.rompu ? 'REPLI EN ORDRE' : 'REVERS'
  ctx.textAlign = 'center'
  lueur(ctx, d.lueur.x, d.lueur.y, d.lueur.w, d.lueur.h, teinte, 3, 0.7)
  texte(ctx, mot, d.mot.x, d.mot.y, 28, teinte, 700, d.mot.max, 2)
  texte(ctx, r.titre ?? '', d.titre.x, d.titre.y, 12, C.faible, 700, d.titre.max)
  ctx.textAlign = 'left'

  const p = d.panneau
  panneau(ctx, p.x, p.y, p.w, p.h)
  texte(ctx, `+${r.or} OR`, p.x + 12, d.or.y, 16, C.accent, 700, 140)
  ctx.textAlign = 'right'
  texte(
    ctx,
    r.renom ? `+${r.renom} RENOM` : 'AUCUN RENOM',
    p.x + p.w - 12,
    d.renom.y,
    13,
    r.renom ? C.vert : C.faible,
    700,
    150,
  )
  ctx.textAlign = 'left'
  if (r.niveaux > 0) texte(ctx, `LA COMPAGNIE PASSE NIVEAU ${c.niveau}`, p.x + 12, d.niveau.y, 12, C.accent, 700, 280)
  else texte(ctx, `RENOM ${c.renom}/${Cie.seuilRenom(c.niveau)}`, p.x + 12, d.niveau.y, 11, C.faible, 700, 280)

  const sections = []
  if (r.montees.length)
    sections.push({
      nom: 'PROMOTIONS ET NIVEAUX',
      teinte: C.accent,
      couleur: C.vert,
      lignes: r.montees
        .slice(0, 6)
        .map((m) => `${U.nomComplet(m.u)} → ${m.grade != null ? GRADES[m.grade].nom : `NIVEAU ${m.u.niv}`}`),
    })
  if (r.lignes.length)
    sections.push({
      nom: 'RAMASSÉS SUR LE TERRAIN',
      teinte: C.accent,
      couleur: C.accent,
      lignes: r.lignes.slice(0, 4).map((l) => U.nomComplet(l.u)),
    })
  if (r.perdus.length)
    sections.push({
      nom: 'NE SONT PAS RENTRÉS',
      teinte: C.rouge,
      couleur: C.rouge,
      lignes: r.perdus.slice(0, 6).map((u) => `${U.nomComplet(u)} · ${CL[u.cl].nom} ${u.niv}`),
    })

  // Debout les trois listes se suivent dans la même colonne ; couché chacune
  // tient la sienne, ce qui les empêche de descendre sur le bouton AU CAMP.
  const curseurs = d.colonnes.map(() => d.debut)
  sections.forEach((s, i) => {
    const k = Math.min(i, d.colonnes.length - 1)
    const x = d.colonnes[k]
    let y = curseurs[k]
    if (y > d.max) return
    texte(ctx, s.nom, x, y, 11, s.teinte, 700, d.largeur)
    y += 18
    for (const l of s.lignes) {
      if (y > d.max) break
      texte(ctx, tronque(ctx, l, 11, d.largeur), x + 8, y, 11, s.couleur, 700)
      y += 16
    }
    curseurs[k] = y + 8
  })

  bouton(ctx, d.suite, 'AU CAMP', { primaire: true })
  return [d.suite]
}

export { liste as listeDefilante }
