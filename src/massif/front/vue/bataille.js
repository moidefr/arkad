/**
 * L'écran de bataille : le bandeau, le champ, et le panneau d'ordres.
 *
 * Le panneau est **la seule chose qui change** selon ce qu'on est en train de
 * faire. Repos, troupe choisie, ciblage, prévision : quatre états, quatre
 * panneaux, et la main ne quitte jamais le même coin de l'écran. Le champ, lui,
 * ne sert qu'à désigner — jamais à lire un menu.
 *
 * Debout ce coin est la moitié basse ; couché c'est la colonne de droite, et
 * le champ prend enfin la forme de la carte qu'il montre. Aucun des quatre
 * panneaux ne sait dans quel sens il travaille : tout vient de `dispo.js`, et
 * toutes les zones tactiles sont produites ici, à côté de leur dessin.
 */
import { C, ton } from '../../../palette.js'
import { rect, cadre, texte, largeurTexte, lueur, px, PX } from '../../../dessin.js'
import * as B from '../bataille.js'
import { CL, GRADES, TYPE } from '../donnees/classes.js'
import { nomComplet, titre as titreDe, fiche as ficheBase } from '../unites.js'
import { terrainA } from '../carte.js'
import { panneau, bouton, barre, teinteVie, tronque, paragraphe } from './pieces.js'

// --- Bandeau du haut ---------------------------------------------------------------

export function bandeau(ctx, d, bat, vue) {
  const b = d.bandeau
  rect(ctx, b.x, b.y, b.w, b.h, ton(C.panneau, -0.3))
  rect(ctx, b.x, b.y + b.h - PX, b.w, PX, C.bord)
  ctx.textAlign = 'left'
  texte(
    ctx,
    tronque(ctx, B.etatObjectif(bat), 11, d.objectif.max),
    d.objectif.x,
    b.y + d.objectif.dy,
    11,
    C.accent,
    700,
  )
  texte(ctx, `TOUR ${bat.tour}/${bat.toursMax}`, d.tour.x, b.y + d.tour.dy, 10, C.faible, 700, d.tour.max)

  // Passer le tour est joignable **depuis n'importe quel état** : sans ce
  // bouton en haut, il fallait d'abord lâcher la troupe choisie pour retrouver
  // celui du panneau d'ordres.
  bouton(ctx, d.zoom, vue.zoom ? 'TOUT' : 'ZOOM', { petit: true })
  const reste = B.restantes(bat, 0).length
  bouton(ctx, d.fin, reste ? `FIN DE TOUR · ${reste}` : 'FIN DE TOUR', { primaire: !reste, petit: true })
  ctx.textAlign = 'left'
  return [d.zoom, d.fin]
}

// --- Le panneau d'ordres -------------------------------------------------------------

/**
 * Le panneau, et les zones qui vont avec. `sel` est l'état du doigt, tenu par
 * `front.js` : rien n'est décidé ici, on ne fait que montrer et proposer.
 */
export function panneauBas(ctx, d, bat, sel) {
  const p = d.panneau
  rect(ctx, p.x, p.y, p.w, p.h, C.panneau)
  rect(ctx, p.x, p.y, p.w, PX, C.bord)
  // Couché, le panneau est une colonne : son liseré de gauche remplace celui
  // du haut, qui ne borde plus rien.
  if (p.x > 0) rect(ctx, p.x, p.y, PX, p.h, C.bord)
  if (sel.visee) return previsionPanneau(ctx, d, bat, sel)
  if (sel.unite) return unitePanneau(ctx, d, bat, sel)
  if (sel.inspect) return inspectPanneau(ctx, d, bat, sel)
  return reposPanneau(ctx, d, bat, sel)
}

/** Rien de choisi : la liste des troupes, et le bouton qui fait avancer le tour. */
function reposPanneau(ctx, d, bat, sel) {
  const zones = []
  const { px: M, pw: LARGE } = d
  const y0 = d.panneau.y
  const droite = M + LARGE
  const miennes = B.vivantes(bat, 0)
  const reste = B.restantes(bat, 0).length

  ctx.textAlign = 'left'
  texte(ctx, `${miennes.length} EN LIGNE · ${B.vivantes(bat, 1).length} EN FACE`, M, y0 + 16, 12, C.faible, 700, 210)
  ctx.textAlign = 'right'
  texte(ctx, reste ? `${reste} À JOUER` : 'TOUT A JOUÉ', droite, y0 + 16, 12, reste ? C.accent : C.vert, 700, 130)
  ctx.textAlign = 'left'

  // Les vignettes : un appui choisit la troupe **et** recentre la caméra
  // dessus. C'est ce qui évite de chercher un pion sur une carte de dix-neuf
  // colonnes.
  const cols = d.vignettes.cols
  const w = Math.floor((LARGE - (cols - 1) * 4) / cols)
  const h = d.vignettes.h
  miennes.slice(0, 12).forEach((u, i) => {
    const z = {
      x: M + (i % cols) * (w + 4),
      y: y0 + 26 + Math.floor(i / cols) * (h + 4),
      w,
      h,
      quoi: 'troupe',
      ref: u.ref,
    }
    vignette(ctx, z, u, B.aFini(u))
    zones.push(z)
  })

  // Les boutons suivent les vignettes au lieu d'attendre à une hauteur fixe :
  // à trois troupes en ligne, le panneau était vide au milieu.
  const rangs = Math.max(1, Math.ceil(Math.min(miennes.length, 12) / cols))
  const yb = y0 + 26 + rangs * (h + 4) + 4
  const fin = { x: M, y: yb, w: LARGE - 126, h: 40, quoi: 'finTour' }
  bouton(ctx, fin, reste ? `FIN DE TOUR (${reste})` : 'FIN DE TOUR', { primaire: true })
  const rompre = { x: droite - 118, y: yb, w: 118, h: 40, quoi: 'retraite' }
  // Rompre le combat abandonne les tombés : le bouton le demande deux fois.
  bouton(ctx, rompre, sel.confirmeRetraite ? 'SÛR ?' : 'ROMPRE', {
    teinte: C.rouge,
    primaire: sel.confirmeRetraite,
    petit: true,
  })
  zones.push(fin, rompre)

  journal(ctx, d, bat, yb + 54, Math.floor((d.panneau.y + d.panneau.h - yb - 54) / 13))
  return zones
}

function vignette(ctx, z, u, fini) {
  const k = u.pv / u.pvMax
  const a = ctx.globalAlpha
  if (fini) ctx.globalAlpha = a * 0.42
  rect(ctx, z.x, z.y, z.w, z.h, ton(C.panneau, 0.35))
  cadre(ctx, z.x, z.y, z.w, z.h, fini ? C.bord : C.faible)
  rect(ctx, z.x, z.y, z.w, 3, TYPE[CL[u.cl].type].couleur)
  ctx.textAlign = 'center'
  texte(ctx, CL[u.cl].court, z.x + z.w / 2, z.y + 17, 12, C.texte, 700, z.w - 4)
  barre(ctx, z.x + 4, z.y + z.h - 12, z.w - 8, 5, k, teinteVie(k), C.bord)
  texte(ctx, u.grade ? GRADES[u.grade].court : String(u.niv), z.x + z.w / 2, z.y + 30, 9, C.faible, 700, z.w - 4)
  ctx.globalAlpha = a
  ctx.textAlign = 'left'
}

/** Une troupe choisie : sa fiche, et ce qu'elle peut faire. */
function unitePanneau(ctx, d, bat, sel) {
  const u = sel.unite
  const zones = []
  const { px: M, pw: LARGE } = d
  const y0 = d.panneau.y
  const droite = M + LARGE
  const g = d.unite
  const f = B.fiche(bat, u)
  const t = terrainA(bat.carte, u.q, u.r)

  ctx.textAlign = 'left'
  texte(ctx, tronque(ctx, nomComplet(u), 16, 210), M, y0 + g.nom, 16, C.texte, 700)
  ctx.textAlign = 'right'
  texte(ctx, `PM ${arrondi(u.pm)}/${arrondi(f.mvt)}`, droite, y0 + g.nom, 13, u.pm > 0 ? C.cyan : C.faible, 700, 90)

  ctx.textAlign = 'left'
  const gr = GRADES[u.grade]
  const sous = `${gr.id ? gr.nom + ' · ' : ''}${CL[u.cl].nom} ${u.niv} · ${t?.nom ?? ''}`
  texte(ctx, tronque(ctx, sous, 11, 230), M, y0 + g.sous, 11, C.faible, 700)
  ctx.textAlign = 'right'
  const cv = B.couvertDeUnite(bat, u)
  texte(
    ctx,
    cv ? `COUVERT ${cv > 0 ? '+' : ''}${Math.round(cv * 100)} %` : 'À DÉCOUVERT',
    droite,
    y0 + g.sous,
    11,
    cv > 0 ? C.vert : C.rouge,
    700,
    110,
  )

  const k = u.pv / u.pvMax
  const bw = LARGE - 120
  barre(ctx, M, y0 + g.pv, bw, 8, k, teinteVie(k), C.bord)
  ctx.textAlign = 'right'
  texte(ctx, `${u.pv}/${u.pvMax}`, droite, y0 + g.pvTexte, 11, C.faible, 700, 80)
  barre(ctx, M, y0 + g.moral, bw, 5, u.moral / B.MORAL_PLEIN, B.ebranle(u) ? C.rouge : C.violet, C.bord)
  ctx.textAlign = 'left'
  texte(
    ctx,
    B.enDeroute(u) ? 'EN DÉROUTE' : B.ebranle(u) ? 'ÉBRANLÉ' : 'MORAL',
    droite - 112,
    y0 + g.moralTexte,
    10,
    B.ebranle(u) ? C.rouge : C.faible,
    700,
    110,
  )

  // Rangée 1 : frapper ou tenir.
  const y1 = y0 + g.y1
  const demi = Math.floor((LARGE - 6) / 2)
  const peut = sel.ciblesUnite?.length > 0
  const zAtt = { x: M, y: y1, w: demi, h: g.h1, quoi: 'attaquer' }
  bouton(ctx, zAtt, peut ? `ATTAQUER (${sel.ciblesUnite.length})` : 'AUCUNE CIBLE', { primaire: peut, actif: peut })
  const zTenir = { x: M + demi + 6, y: y1, w: demi, h: g.h1, quoi: 'tenir' }
  bouton(ctx, zTenir, 'TENIR', { actif: !u.aAgi })
  zones.push(zAtt, zTenir)

  // Rangée 2 : les ordres. Trois au plus — aucune fiche n'en porte davantage.
  const ordres = sel.ordres ?? []
  const y2 = y1 + g.pas2
  if (ordres.length) {
    const w = Math.floor((LARGE - (ordres.length - 1) * 6) / ordres.length)
    ordres.forEach((o, i) => {
      const froid = B.froidDe(u, o.id)
      const z = { x: M + i * (w + 6), y: y2, w, h: g.h2, quoi: 'ordre', id: o.id }
      bouton(ctx, z, froid > 0 ? `${o.court} ${froid}` : o.court, {
        teinte: C.violet,
        actif: froid <= 0 && !u.aAgi,
        petit: true,
      })
      zones.push(z)
    })
  } else {
    texte(ctx, 'AUCUN ORDRE DISPONIBLE', M, y2 + 20, 11, C.bord, 700, LARGE)
  }

  // Rangée 3 : revenir en arrière. C'est ce bouton qui rend le doigt sûr.
  const y3 = y2 + g.pas3
  const bouge = u.q !== u.depart.q || u.r !== u.depart.r
  const zAnn = { x: M, y: y3, w: demi, h: g.h3, quoi: 'annuler' }
  bouton(ctx, zAnn, 'REVENIR', { actif: bouge && !u.aAgi, petit: true })
  const zFerme = { x: M + demi + 6, y: y3, w: demi, h: g.h3, quoi: 'ferme' }
  bouton(ctx, zFerme, 'LÂCHER', { petit: true })
  zones.push(zAnn, zFerme)

  if (sel.mode === 'cible') {
    rect(ctx, d.panneau.x, y0, d.panneau.w, 22, ton(C.rouge, -0.6))
    texte(ctx, 'CHOISIS UNE CIBLE SUR LE CHAMP', M, y0 + 12, 12, C.rouge, 700, LARGE)
  }
  if (sel.mode === 'ordre') {
    rect(ctx, d.panneau.x, y0, d.panneau.w, 22, ton(C.violet, -0.6))
    texte(ctx, `${sel.apt?.nom ?? ''} : CHOISIS UN HEXAGONE`, M, y0 + 12, 12, C.violet, 700, LARGE)
  }
  return zones
}

/**
 * La prévision — le cœur de l'ergonomie du combat. Les chiffres affichés ici
 * sont **exactement** ceux qui tomberont : la résolution n'a aucun aléa, donc
 * confirmer, c'est choisir, pas parier.
 */
function previsionPanneau(ctx, d, bat, sel) {
  const u = sel.unite
  const c = sel.visee
  const p = B.prevision(bat, u, c)
  const zones = []
  const { px: M, pw: LARGE } = d
  const y0 = d.panneau.y
  const droite = M + LARGE
  const g = d.prevision

  ctx.textAlign = 'left'
  texte(ctx, tronque(ctx, `${nomComplet(u)} → ${nomComplet(c)}`, 13, LARGE), M, y0 + g.nom, 13, C.texte, 700)

  panneau(ctx, M, y0 + g.panneau, LARGE, g.hPanneau, C.rouge, ton(C.rouge, -0.78))
  texte(ctx, 'INFLIGE', M + 8, y0 + g.inflige, 11, C.faible, 700)
  texte(ctx, String(p.final), M + 74, y0 + g.chiffre, 22, C.rouge, 700)
  ctx.textAlign = 'right'
  texte(
    ctx,
    p.mortelle ? 'HORS DE COMBAT' : `IL LUI RESTE ${p.reste}`,
    droite - 8,
    y0 + g.chiffre,
    12,
    p.mortelle ? C.vert : C.faible,
    700,
    170,
  )
  ctx.textAlign = 'left'
  barre(ctx, M + 8, y0 + g.barre, LARGE - 16, 6, p.reste / c.pvMax, teinteVie(p.reste / c.pvMax), C.bord)

  const teinteR = p.riposte ? C.accent : C.faible
  panneau(ctx, M, y0 + g.riposte, LARGE, g.hRiposte, teinteR, ton(C.fond, 0.12))
  texte(ctx, 'RIPOSTE', M + 8, y0 + g.ripTexte, 11, C.faible, 700)
  texte(ctx, p.ripostePossible ? String(p.riposte) : '—', M + 74, y0 + g.ripTexte, 15, teinteR, 700)
  ctx.textAlign = 'right'
  texte(ctx, `IL VOUS RESTE ${p.resteSoi}`, droite - 8, y0 + g.ripTexte, 12, p.resteSoi ? C.faible : C.rouge, 700, 170)
  ctx.textAlign = 'left'

  // Le pourquoi du chiffre, en clair : c'est ce qui apprend le jeu sans texte
  // d'explication — on voit HAUTEUR +15 % en montant sur la colline.
  const colonne = LARGE / g.cols
  p.detail.slice(0, 4).forEach((det, i) => {
    const x = M + (i % g.cols) * colonne
    const y = y0 + g.detail + Math.floor(i / g.cols) * g.pas
    const vif = det.v > 0 ? C.vert : C.rouge
    texte(ctx, tronque(ctx, det.nom, 10, colonne - 46), x, y, 10, C.faible, 700)
    ctx.textAlign = 'right'
    texte(ctx, `${det.v > 0 ? '+' : ''}${Math.round(det.v * 100)} %`, x + colonne - 8, y, 10, vif, 700, 44)
    ctx.textAlign = 'left'
  })
  if (p.couvert)
    texte(ctx, `COUVERT DE LA CIBLE −${Math.round(p.couvert * 100)} %`, M, y0 + g.couvert, 10, C.cyan, 700, LARGE)

  const y = y0 + g.boutons
  const demi = Math.floor((LARGE - 6) / 2)
  const zOk = { x: M, y, w: demi, h: g.hBouton, quoi: 'confirme' }
  bouton(ctx, zOk, 'FRAPPER', { primaire: true })
  const zNon = { x: M + demi + 6, y, w: demi, h: g.hBouton, quoi: 'annuleCible' }
  bouton(ctx, zNon, 'RENONCER', {})
  zones.push(zOk, zNon)
  return zones
}

/** Une troupe adverse qu'on regarde : tout ce qu'on peut savoir avant de décider. */
function inspectPanneau(ctx, d, bat, sel) {
  const u = sel.inspect
  const { px: M, pw: LARGE } = d
  const y0 = d.panneau.y
  const droite = M + LARGE
  const g = d.inspect
  const f = B.fiche(bat, u)
  const t = terrainA(bat.carte, u.q, u.r)
  ctx.textAlign = 'left'
  texte(ctx, tronque(ctx, nomComplet(u), 16, LARGE), M, y0 + g.nom, 16, u.camp ? C.rouge : C.texte, 700)
  texte(
    ctx,
    tronque(ctx, `${titreDe(u)} · NIVEAU ${u.niv} · ${TYPE[f.type].nom}`, 11, LARGE),
    M,
    y0 + g.sous,
    11,
    C.faible,
    700,
  )

  const k = u.pv / u.pvMax
  barre(ctx, M, y0 + g.barre, LARGE, 8, k, teinteVie(k), C.bord)
  ctx.textAlign = 'right'
  texte(ctx, `${u.pv}/${u.pvMax}`, droite, y0 + g.stats, 11, C.faible, 700, 80)
  ctx.textAlign = 'left'
  texte(
    ctx,
    `ATT ${Math.round(f.att)} · DEF ${Math.round(f.def)} · MVT ${f.mvt} · PORTÉE ${f.portee[0]}-${f.portee[1]}`,
    M,
    y0 + g.stats,
    11,
    C.texte,
    700,
    250,
  )
  texte(
    ctx,
    `${t?.nom ?? ''} · COUVERT ${Math.round(B.couvertDeUnite(bat, u) * 100)} %`,
    M,
    y0 + g.terrain,
    11,
    C.cyan,
    700,
    LARGE,
  )
  const apts = (u.apt ?? []).map((id) => id.toUpperCase().replace(/_/g, ' ')).join(' · ')
  paragraphe(ctx, apts || 'AUCUNE APTITUDE', M, y0 + g.apt, 10, LARGE, C.violet, 13)

  const z = { x: M, y: y0 + g.fermer, w: LARGE, h: g.hFermer, quoi: 'ferme' }
  bouton(ctx, z, 'FERMER', { petit: true })
  return [z]
}

function journal(ctx, d, bat, y, combien = 2) {
  if (combien < 1) return
  ctx.textAlign = 'left'
  const dernieres = bat.journal.slice(-combien)
  dernieres.forEach((l, i) => texte(ctx, tronque(ctx, l, 10, d.pw), d.px, y + i * 13, 10, C.faible, 700))
}

const arrondi = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(1))

export { arrondi }
