/**
 * Tous les écrans hors bataille : le titre, la carte des engagements, la
 * caserne, l'état-major, la compagnie, la fiche, le bilan. Le village vivant
 * lui-même a sa propre vue (`village.js`) — la scène a besoin du temps de
 * jeu pour bouger, ce qu'aucun autre écran d'ici ne lit.
 *
 * Chaque fonction lit ses rectangles dans `dispo.js` et rend les zones
 * tactiles **au même endroit qu'elle a dessiné**. Une zone n'existe que si
 * quelque chose a été peint dessus, ce qui interdit structurellement le bouton
 * invisible et le bouton décalé — et vaut dans les deux gabarits, puisque
 * personne ici ne sait dans quel sens il travaille.
 */
import { C, ton } from '../../../palette.js'
import { rect, cadre, texte, largeurTexte, lueur, ombre, pastille, px, PX, bandeTramee } from '../../../dessin.js'
import * as U from '../unites.js'
import * as Cie from '../compagnie.js'
import * as V from '../ville.js'
import { CL, TYPE, TYPES, EFFICACITE, GRADES } from '../donnees/classes.js'
import { UQ, RAR } from '../donnees/uniques.js'
import { APT } from '../donnees/aptitudes.js'
import { OBJ as OBJET, EMPLACEMENTS, nomObjet, prixAmelioration, TIER_MAX } from '../donnees/objets.js'
import { ligneApt } from './aptitudes-ui.js'
import { BIOMES } from '../terrain.js'
import { OBJ } from '../carte.js'
import { panneau, bouton, barre, teinteVie, tronque, paragraphe, entete, bourse, lignes, hexagone } from './pieces.js'
import * as D from './dispo.js'

// --- Liste défilante ------------------------------------------------------------------

/** Le plancher du doigt : sous cette hauteur visible, une ligne n'existe pas. */
const PLANCHER = 30

/**
 * Une liste qui défile au doigt, sur une ou deux colonnes. Les zones renvoyées
 * portent la position **réellement dessinée** : c'est la leçon du bug de
 * l'usine, où l'appui reconstruisait la liste et ne retrouvait donc jamais la
 * ligne touchée.
 *
 * Une ligne à cheval sur le bord est **découpée à la fenêtre**, et sa zone
 * s'arrête au même endroit. C'est le seul découpage du jeu, et il paie deux
 * fois : sans lui, la ligne débordante restait peinte en entier — le bouton
 * dessiné ensuite la traversait, et couché c'étaient quatre-vingt-six pixels
 * de carte visible dont pas un ne répondait au doigt.
 *
 * En dessous du plancher tactile, elle n'est ni peinte ni proposée : une
 * lisière qu'on voit sans pouvoir la toucher est la même faute, en plus petit.
 */
export function liste(ctx, cadreListe, elements, hauteur, defile, dessineLigne, cols = 1) {
  const zones = []
  const ecart = 4
  const w = Math.floor((cadreListe.w - (cols - 1) * ecart) / cols)
  const bas = cadreListe.y + cadreListe.h
  ctx.save()
  ctx.beginPath()
  ctx.rect(cadreListe.x, cadreListe.y, cadreListe.w, cadreListe.h)
  ctx.clip()
  elements.forEach((el, i) => {
    // Sur la grille de deux pixels, comme tout le reste : sinon la ligne est
    // peinte arrondie et sa zone ne l'est pas, et les deux se décalent d'un
    // pixel à chaque défilement impair.
    const y = px(cadreListe.y + Math.floor(i / cols) * (hauteur + ecart) - defile)
    const haut = Math.max(y, cadreListe.y)
    const fin = Math.min(y + hauteur, bas)
    if (fin - haut < PLANCHER) return
    const z = { x: cadreListe.x + (i % cols) * (w + ecart), y, w, h: hauteur }
    dessineLigne(ctx, z, el)
    zones.push({ ...z, y: haut, h: fin - haut, el })
  })
  ctx.restore()
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

// --- Les bâtiments ----------------------------------------------------------------------

export function ville(ctx, j, c, defile) {
  const ch = D.chassis(j)
  const d = D.ville(j)
  entete(
    ctx,
    ch.entete,
    'LA VILLE',
    `${V.BATIMENTS.filter((b) => V.niveauBat(c, b.id) > 0).length}/${V.BATIMENTS.length}`,
  )
  texte(
    ctx,
    'neuf lieux, chacun fait une seule chose — tapez pour construire',
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
    V.BATIMENTS,
    d.ligne,
    defile,
    (ctx, z, b) => {
      const n = V.niveauBat(c, b.id)
      const bloque = c.niveau < b.rang
      const a = ctx.globalAlpha
      if (bloque) ctx.globalAlpha = a * 0.4
      panneau(ctx, z.x, z.y, z.w, z.h, n > 0 ? C.accent : C.bord)
      texte(ctx, b.nom, z.x + 12, z.y + 20, 13, C.texte, 700, z.w - 90)
      texte(
        ctx,
        bloque ? `RANG ${b.rang} REQUIS` : n > 0 ? `NIVEAU ${n}/${V.NIVEAU_MAX}` : 'PAS ENCORE CONSTRUIT',
        z.x + 12,
        z.y + 38,
        10,
        n > 0 ? C.vert : C.faible,
        700,
        z.w - 24,
      )
      for (let i = 0; i < V.NIVEAU_MAX; i++) {
        rect(ctx, z.x + z.w - 70 + i * 16, z.y + 16, 10, 10, i < n ? C.accent : C.bord)
      }
      ctx.globalAlpha = a
    },
    d.cols,
  )
  const zones = r.zones.map((z) => ({ ...z, quoi: 'batiment', id: z.el.id }))
  bouton(ctx, d.retour, 'RETOUR', { petit: true })
  zones.push(d.retour)
  bourse(ctx, c, D.bourse(j))
  return { zones, max: r.max, rect: d.zone }
}

/**
 * Ce qu'un bâtiment ajoute à sa fiche : une liste propre à lui, dans le même
 * moule que la caserne ou l'état-major — une ligne, un prix, un bouton.
 * Un bâtiment qui n'a rien de propre (l'infirmerie, la taverne, le grenier,
 * le poste de guet, les fortifications) rend une liste vide : sa fiche et
 * son bouton CONSTRUIRE suffisent à raconter ce qu'il fait.
 */
function extrasDe(c, id) {
  if (id === 'caserne') {
    return V.SESSIONS.filter((s) => V.sessionOuverte(c, s)).map((s) => ({
      id: s.id,
      nom: s.nom,
      sous: `${s.jours} JOURS · +${s.xp} XP CHACUN`,
      prix: s.prix,
      quoi: 'entraine',
    }))
  }
  if (id === 'marche') {
    return (c.offre.objets ?? []).map((l, i) => {
      const o = OBJET[l.id]
      return {
        id: i,
        nom: o.nom,
        sous: `${o.emplacement.toUpperCase()} · RANG ${o.rang}`,
        prix: l.prix,
        quoi: 'achete',
      }
    })
  }
  if (id === 'forge') {
    const plafond = V.niveauBat(c, 'forge') + 1
    const lignes = []
    for (const t of c.troupes) {
      for (const emp of ['arme', 'armure', 'accessoire']) {
        const inst = t.equip[emp]
        if (!inst) continue
        const tierVise = (inst.tier ?? 1) + 1
        if (tierVise > TIER_MAX) continue
        const objet = OBJET[inst.id]
        const prix = prixAmelioration(objet, tierVise, c.niveau, U.echelle)
        lignes.push({
          id: t.id,
          emp,
          nom: `${U.nomComplet(t)} · ${nomObjet(inst)}`,
          sous: tierVise > plafond ? `→ TIER ${tierVise} · FORGE TROP FAIBLE` : `→ TIER ${tierVise}`,
          prix,
          quoi: 'ameliore',
          hors: tierVise > plafond,
        })
      }
    }
    return lignes
  }
  if (id === 'entrainement') {
    const foc = V.focusEntrainement(c)
    return TYPES.map((t) => ({
      id: t.id,
      nom: t.nom,
      sous: foc === t.id ? 'ACCENT ACTUEL — TAPEZ POUR CHANGER' : 'TAPEZ POUR CHOISIR CET ACCENT',
      prix: 0,
      quoi: 'focus',
    }))
  }
  return []
}

export function batiment(ctx, j, c, id, defile) {
  const ch = D.chassis(j)
  const d = D.batiment(j)
  const b = V.BAT[id]
  const n = V.niveauBat(c, id)
  entete(ctx, ch.entete, b.nom, n > 0 ? `NIVEAU ${n}/${V.NIVEAU_MAX}` : 'PAS ENCORE CONSTRUIT')

  panneau(ctx, d.fiche.x, d.fiche.y, d.fiche.w, d.fiche.h)
  paragraphe(ctx, b.quoi, d.fiche.x + 12, d.fiche.y + 20, 11, d.fiche.w - 24, C.faible, 14)
  for (let i = 0; i < V.NIVEAU_MAX; i++) {
    rect(ctx, d.fiche.x + 12 + i * 20, d.fiche.y + d.fiche.h - 20, 14, 14, i < n ? C.accent : C.bord)
  }
  const manque = (V.PREREQUIS[id] ?? []).filter(([bid, niv]) => V.niveauBat(c, bid) < niv)
  const peut = V.constructible(c, id)
  if (manque.length) {
    ctx.textAlign = 'right'
    texte(
      ctx,
      `REQUIERT ${manque.map(([bid, niv]) => `${V.BAT[bid].nom} ${niv}`).join(', ')}`,
      d.fiche.x + d.fiche.w - 12,
      d.fiche.y + d.fiche.h - 14,
      10,
      C.rouge,
      700,
      d.fiche.w - 40,
    )
    ctx.textAlign = 'left'
  }

  const complet = n >= V.NIVEAU_MAX
  bouton(ctx, d.construire, complet ? 'NIVEAU MAXIMUM' : `CONSTRUIRE — ${b.cout(n)} OR`, {
    primaire: peut,
    actif: peut,
  })

  const extras = extrasDe(c, id)
  texte(ctx, extras.length ? 'PROPRE À CE BÂTIMENT' : '', d.legende.x, d.legende.y, 10, C.faible, 700, ch.L)
  const r = liste(
    ctx,
    d.zone,
    extras,
    d.ligne,
    defile,
    (ctx, z, l) => {
      const cher = l.prix > c.or
      const a = ctx.globalAlpha
      if (cher || l.hors) ctx.globalAlpha = a * 0.45
      panneau(ctx, z.x, z.y, z.w, z.h)
      texte(ctx, tronque(ctx, l.nom, 12, z.w - 24), z.x + 12, z.y + 20, 12, C.texte, 700, z.w - 24)
      texte(ctx, l.sous, z.x + 12, z.y + 38, 9, C.faible, 700, z.w - 24)
      if (l.prix) {
        ctx.textAlign = 'right'
        texte(ctx, `${l.prix} OR`, z.x + z.w - 12, z.y + 24, 12, cher ? C.rouge : C.accent, 700, 100)
        ctx.textAlign = 'left'
      }
      ctx.globalAlpha = a
    },
    d.cols,
  )
  const zones = r.zones.map((z) => ({ ...z, quoi: z.el.quoi, id: z.el.id, emp: z.el.emp }))
  if (!extras.length && !manque.length)
    texte(ctx, 'RIEN DE PLUS À FAIRE ICI — LE NIVEAU SUFFIT', d.zone.x, d.zone.y + 20, 10, C.faible, 700, ch.L)

  bouton(ctx, d.retour, 'RETOUR', { petit: true })
  zones.push(d.construire, d.retour)
  bourse(ctx, c, D.bourse(j))
  return { zones, max: r.max, rect: d.zone }
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

/**
 * La fiche d'une troupe — refondue autour de quatre bandes lisibles d'un
 * regard plutôt qu'une grille de six cases en toutes lettres : les
 * statistiques en pastilles-couleur, l'équipement en trois emplacements
 * tapotables, le triangle des types en puces hexagonales, et les aptitudes
 * en lignes qui se déplient au tap (`aptitudes-ui.js`, partagé avec le
 * panneau de combat du lot 5).
 *
 * `selEquip` (un emplacement, ou `null`) fait basculer la bande du bas entre
 * les aptitudes et le sélecteur du dépôt filtré sur cet emplacement — les
 * deux occupent le même rectangle, jamais en même temps.
 */
export function fiche(ctx, j, c, u, defile, selEquip, aptOuvertes) {
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

  // La bande de statistiques : une pastille-couleur par chiffre, sur une
  // seule ligne — ce qu'était la grille de six cases en toutes lettres.
  const STATS = [
    ['ATT', Math.round(f.att), C.rouge],
    ['DÉF', Math.round(f.def), C.cyan],
    ['MVT', f.mvt, C.vert],
    ['POR', `${f.portee[0]}–${f.portee[1]}`, C.accent],
    ['VUE', f.vue, C.violet],
    ['AUR', f.aura || '—', C.faible],
  ]
  const st = d.stats
  const stW = st.w / STATS.length
  STATS.forEach(([nom, val, teinte], i) => {
    const x = st.x + i * stW
    pastille(ctx, x + 8, st.y + st.h / 2, 4, teinte)
    texte(ctx, nom, x + 16, st.y + st.h / 2 - 6, 8, C.faible, 700, stW - 18)
    texte(ctx, String(val), x + 16, st.y + st.h / 2 + 9, 12, C.texte, 700, stW - 18)
  })

  // Les trois emplacements d'équipement : un contour seul quand ils sont
  // vides, tapotables dans les deux cas. Un tap ouvre le sélecteur du dépôt,
  // filtré sur ce seul emplacement.
  d.equip.forEach((z, i) => {
    const slot = EMPLACEMENTS[i]
    const inst = u.equip?.[slot]
    const ouvert = selEquip === slot
    const teinte = inst ? C.accent : C.faible
    if (ouvert) lueur(ctx, z.x, z.y, z.w, z.h, C.accent, 2, 0.4)
    panneau(ctx, z.x, z.y, z.w, z.h, teinte)
    ctx.textAlign = 'center'
    texte(ctx, slot.toUpperCase().slice(0, 4), z.x + z.w / 2, z.y + 14, 8, C.faible, 700, z.w - 8)
    texte(
      ctx,
      inst ? tronque(ctx, nomObjet(inst), 9, z.w - 8) : 'VIDE',
      z.x + z.w / 2,
      z.y + z.h - 10,
      9,
      inst ? C.texte : C.faible,
      700,
      z.w - 8,
    )
    ctx.textAlign = 'left'
  })

  // Le triangle des types, en puces hexagonales : ▲ sur ce qu'on domine, ▼
  // sur ce qui nous domine, la puce grisée sinon. Plus vite lu que deux
  // lignes de sigles, et c'est la seule chose qu'un joueur doit savoir avant
  // de choisir qui frappe qui.
  const ty = d.types
  const tyW = ty.w / TYPES.length
  const cy = ty.y + ty.h / 2 - 5
  const R = Math.min(11, tyW / 2 - 5, ty.h / 2 - 5)
  TYPES.forEach((t, i) => {
    const eff = EFFICACITE[f.type][t.id]
    const neutre = eff > 0.85 && eff < 1.25
    const x = ty.x + i * tyW + tyW / 2
    const a = ctx.globalAlpha
    if (neutre) ctx.globalAlpha = a * 0.35
    hexagone(ctx, x, cy, R, t.couleur)
    ctx.globalAlpha = a
    ctx.textAlign = 'center'
    if (!neutre) texte(ctx, eff >= 1.25 ? '▲' : '▼', x, cy + 3, 10, C.fond, 700, 20)
    texte(ctx, t.court, x, ty.y + ty.h - 2, 8, C.faible, 700, tyW)
    ctx.textAlign = 'left'
  })

  const az = d.apZone
  const zones = []
  let max = 0
  if (selEquip) {
    // Le sélecteur : les objets du dépôt qui vont dans cet emplacement, plus
    // « RETIRER » en tête si la troupe en porte déjà un.
    texte(ctx, `CHOISIR — ${selEquip.toUpperCase()}`, d.apTitre.x, d.apTitre.y, 11, C.accent, 700, az.w)
    const options = c.objets.map((inst, i) => ({ i, inst })).filter((x) => OBJET[x.inst.id]?.emplacement === selEquip)
    const lignesEq = [...(u.equip?.[selEquip] ? [{ retirer: true }] : []), ...options]
    const r = liste(ctx, az, lignesEq, 44, defile, (ctx, z, l) => {
      panneau(ctx, z.x, z.y, z.w, z.h, l.retirer ? C.rouge : C.bord)
      if (l.retirer) {
        texte(ctx, 'RETIRER L’ÉQUIPEMENT', z.x + 10, z.y + z.h / 2 + 4, 11, C.rouge, 700, z.w - 20)
      } else {
        const info = OBJET[l.inst.id]
        texte(ctx, nomObjet(l.inst), z.x + 10, z.y + 18, 11, C.texte, 700, z.w - 20)
        texte(ctx, info?.nom ?? '', z.x + 10, z.y + 34, 9, C.faible, 700, z.w - 20)
      }
    })
    zones.push(...r.zones.map((z) => ({ ...z, quoi: z.el.retirer ? 'deposeEquip' : 'poseEquip', i: z.el.i })))
    max = r.max
    if (!lignesEq.length)
      texte(ctx, 'RIEN DANS LE DÉPÔT POUR CET EMPLACEMENT', az.x, az.y + 20, 10, C.faible, 700, az.w)
  } else {
    texte(ctx, 'APTITUDES', d.apTitre.x, d.apTitre.y, 11, C.accent, 700, az.w)
    let y = az.y
    for (const id of U.aptEffectives(u)) {
      const apt = APT[id]
      if (!apt) continue
      const ouverte = !!aptOuvertes?.has(id)
      const h = ligneApt(ctx, az.x, y, az.w, apt, ouverte)
      zones.push({ x: az.x, y, w: az.w, h, quoi: 'aptToggle', id })
      y += h + 4
      if (y > az.y + az.h) break
    }
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
  zones.push(...d.equip.map((z, i) => ({ ...z, slot: EMPLACEMENTS[i] })), d.soigne, d.reforme, d.retour)
  return { zones, max, rect: selEquip ? az : null }
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
  // tient la sienne, ce qui les empêche de descendre sur le bouton AU VILLAGE.
  // Le curseur se range donc par **abscisse** et non par rang de section :
  // indexé par rang, debout où les trois abscisses sont la même, chaque section
  // repartait du haut et écrivait sur la précédente.
  const curseurs = new Map()
  sections.forEach((s, i) => {
    const x = d.colonnes[Math.min(i, d.colonnes.length - 1)]
    let y = curseurs.get(x) ?? d.debut
    if (y > d.max) return
    texte(ctx, s.nom, x, y, 11, s.teinte, 700, d.largeur)
    y += 18
    for (const l of s.lignes) {
      if (y > d.max) break
      texte(ctx, tronque(ctx, l, 11, d.largeur), x + 8, y, 11, s.couleur, 700)
      y += 16
    }
    curseurs.set(x, y + 8)
  })

  bouton(ctx, d.suite, 'AU VILLAGE', { primaire: true })
  return [d.suite]
}

export { liste as listeDefilante }
