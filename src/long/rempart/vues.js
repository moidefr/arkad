import { C, ton } from '../../palette.js'
import { texte, rect, cadre, bloc, lueur, pastille, borne } from '../../dessin.js'
import { ENNEMIS, TOURS, CARTES, AMELIORATIONS_META } from './donnees.js'
import * as L from './logique.js'
import { zoneTourBoutique, zoneOnglet, zoneCarte, zoneLigne, toursBoutique } from './dispo.js'

/**
 * Rien ici ne décide : on lit `logique.js`, on dessine, et `index.js` relit
 * les mêmes zones de `dispo.js` pour savoir ce qui a été touché. Comme dans
 * USINE, une position écrite ici et nulle part ailleurs serait une position
 * qui ne répond pas au doigt.
 */

const teinteVie = (frac) => (frac > 0.5 ? C.vert : frac > 0.2 ? C.accent : C.rouge)

/** Un segment du chemin est toujours horizontal ou vertical : le rectangle qui l'occupe. */
function segRect(a, b, ep) {
  if (a.y === b.y) return { x: Math.min(a.x, b.x), y: a.y - ep / 2, w: Math.abs(b.x - a.x), h: ep }
  return { x: a.x - ep / 2, y: Math.min(a.y, b.y), w: ep, h: Math.abs(b.y - a.y) }
}

// --- La défense en cours ------------------------------------------------------------

export function dessinePlateau(ctx, d, carte, etat, selection) {
  const ox = d.plateau.x
  const oy = d.plateau.y
  rect(ctx, d.plateau.x, d.plateau.y, d.plateau.w, d.plateau.h, C.fond)

  for (let i = 0; i < carte.chemin.length - 1; i++) {
    const r = segRect(carte.chemin[i], carte.chemin[i + 1], 22)
    rect(ctx, ox + r.x, oy + r.y, r.w, r.h, C.panneau)
  }
  const rempart = carte.chemin[carte.chemin.length - 1]
  lueur(ctx, ox + rempart.x - 14, oy + rempart.y - 14, 28, 28, teinteVie(etat.vie / etat.vieMax), 2)
  bloc(ctx, ox + rempart.x - 14, oy + rempart.y - 14, 28, 28, teinteVie(etat.vie / etat.vieMax), 3)

  // Les emplacements libres, en cadre creux : ce qu'on peut poser dessus se
  // lit avant même d'avoir choisi une tour en boutique.
  const occupes = new Set(etat.tours.map((t) => t.emplacement))
  const def = selection ? L.tourParId(selection) : null
  carte.emplacements.forEach((e, i) => {
    if (occupes.has(i)) return
    const actif = def && etat.ferraille >= def.cout
    cadre(ctx, ox + e.x - 12, oy + e.y - 12, 24, 24, actif ? C.accent : C.bord)
  })

  for (const tour of etat.tours) {
    const tdef = L.tourParId(tour.tourId)
    const pos = carte.emplacements[tour.emplacement]
    lueur(ctx, ox + pos.x - 12, oy + pos.y - 12, 24, 24, tdef.couleur, 1, 0.5)
    bloc(ctx, ox + pos.x - 12, oy + pos.y - 12, 24, 24, tdef.couleur, 3)
    for (let n = 0; n < tour.niveau; n++) pastille(ctx, ox + pos.x - 6 + n * 7, oy + pos.y + 16, 2, C.texte)
  }

  for (const en of etat.ennemis) {
    const p = L.positionSur(carte, en.d)
    const edef = ENNEMIS[en.type]
    const taille = en.type === 'blinde' ? 14 : en.type === 'essaim' ? 8 : 11
    const x = ox + p.x
    const y = oy + p.y
    bloc(ctx, x - taille / 2, y - taille / 2, taille, taille, en.ralentiReste > 0 ? ton(edef.couleur, -0.3) : edef.couleur, 2)
    const frac = borne(en.vie / en.vieMax, 0, 1)
    if (frac < 1) {
      rect(ctx, x - taille / 2, y - taille / 2 - 5, taille, 3, ton(C.panneau, -0.4))
      rect(ctx, x - taille / 2, y - taille / 2 - 5, taille * frac, 3, teinteVie(frac))
    }
  }

  for (const proj of etat.projectiles) pastille(ctx, ox + proj.x, oy + proj.y, 3, C.texte)
}

export function dessinePanneau(ctx, d, meta, etat, selection) {
  const p = d.panneau
  rect(ctx, p.x, p.y, p.w, p.h, C.panneau)

  const frac = etat.vie / etat.vieMax
  rect(ctx, d.vie.x, d.vie.y, d.vie.w, d.vie.h, C.fond)
  if (frac > 0) rect(ctx, d.vie.x, d.vie.y, d.vie.w * frac, d.vie.h, teinteVie(frac))
  cadre(ctx, d.vie.x, d.vie.y, d.vie.w, d.vie.h, C.bord)

  ctx.textAlign = 'left'
  texte(ctx, `VAGUE ${etat.vague}`, d.info.x, d.info.y, 15, C.texte, 700)
  texte(ctx, `FERRAILLE  ${Math.floor(etat.ferraille)}`, d.info.x, d.info.y + 18, 12, C.accent, 700)
  ctx.textAlign = 'center'

  toursBoutique(meta).forEach((t, k) => {
    const z = zoneTourBoutique(d, k)
    const choisie = selection === t.id
    const possible = etat.ferraille >= t.cout
    rect(ctx, z.x, z.y, z.w, z.h, choisie ? ton(t.couleur, -0.55) : C.fond)
    cadre(ctx, z.x, z.y, z.w, z.h, choisie ? t.couleur : possible ? C.bord : ton(C.bord, -0.3))
    ctx.textAlign = 'left'
    texte(ctx, t.nom, z.x + 8, z.y + 12, 11, possible ? C.texte : C.faible, 700, z.w - 60)
    ctx.textAlign = 'right'
    texte(ctx, String(t.cout), z.x + z.w - 8, z.y + 12, 11, possible ? t.couleur : C.faible, 700)
    ctx.textAlign = 'center'
  })

  if (etat.phase === 'attente') {
    const l = d.lancer
    rect(ctx, l.x, l.y, l.w, l.h, C.fond)
    cadre(ctx, l.x, l.y, l.w, l.h, C.accent)
    texte(ctx, `LANCER (${Math.ceil(etat.minuteur)})`, l.x + l.w / 2, l.y + l.h / 2, 13, C.accent, 700)
  } else if (etat.phase === 'vague') {
    const l = d.lancer
    texte(ctx, `${etat.ennemis.length + etat.aVenir.length} restants`, l.x + l.w / 2, l.y + l.h / 2, 12, C.faible, 700)
  }
}

export function dessineDefaite(ctx, j, etat) {
  rect(ctx, j.W / 2 - 130, j.H / 2 - 42, 260, 84, ton(C.fond, 0.1))
  cadre(ctx, j.W / 2 - 130, j.H / 2 - 42, 260, 84, C.rouge)
  texte(ctx, 'LE REMPART TOMBE', j.W / 2, j.H / 2 - 14, 18, C.rouge, 700)
  texte(ctx, `vague ${etat.vague} · +${etat.eclatsGagnes} éclats gagnés`, j.W / 2, j.H / 2 + 8, 12, C.accent, 700)
  texte(ctx, 'appuie pour revenir au campement', j.W / 2, j.H / 2 + 28, 11, C.faible, 700)
}

// --- Le campement, entre deux défenses -----------------------------------------------

export const ONGLETS_MENU = [
  { id: 'tours', nom: 'TOURS' },
  { id: 'ameliorations', nom: 'AMÉLIORATIONS' },
]

export function dessineMenu(ctx, d, meta, onglet) {
  ctx.textAlign = 'left'
  texte(ctx, `${meta.eclats} ÉCLATS`, d.info.x, d.panneau.y - 6, 15, C.accent, 700)
  ctx.textAlign = 'center'

  dessineCartes(ctx, d, meta)
  dessineOnglets(ctx, d, onglet)
  if (onglet === 'tours') dessineTours(ctx, d, meta)
  else dessineAmeliorations(ctx, d, meta)
}

function dessineCartes(ctx, d, meta) {
  CARTES.forEach((c, k) => {
    const z = zoneCarte(d, k)
    const debloquee = meta.cartesDeblocs.includes(c.id)
    const possible = !debloquee && meta.eclats >= c.coutDeblocage
    rect(ctx, z.x, z.y, z.w, z.h, C.panneau)
    cadre(ctx, z.x, z.y, z.w, z.h, debloquee ? c.couleur : possible ? C.accent : C.bord)
    ctx.textAlign = 'left'
    texte(ctx, c.nom, z.x + 12, z.y + 22, 15, debloquee ? c.couleur : C.faible, 700, z.w - 24)
    texte(ctx, c.pitch, z.x + 12, z.y + 42, 11, C.faible, 700, z.w - 24)
    const meilleure = meta.meilleureVague[c.id]
    ctx.textAlign = 'right'
    if (debloquee) {
      texte(ctx, 'JOUER', z.x + z.w - 12, z.y + z.h - 24, 13, C.accent, 700)
      if (meilleure) texte(ctx, `meilleure vague : ${meilleure}`, z.x + z.w - 12, z.y + z.h - 8, 10, C.faible, 700)
    } else {
      texte(ctx, `${c.coutDeblocage} éclats`, z.x + z.w - 12, z.y + z.h - 12, 13, possible ? C.accent : C.faible, 700)
    }
    ctx.textAlign = 'center'
  })
}

function dessineOnglets(ctx, d, onglet) {
  ONGLETS_MENU.forEach((o, k) => {
    const z = zoneOnglet(d, k)
    const actif = onglet === o.id
    rect(ctx, z.x, z.y, z.w, z.h, C.fond)
    cadre(ctx, z.x, z.y, z.w, z.h, actif ? C.accent : C.bord)
    texte(ctx, o.nom, z.x + z.w / 2, z.y + z.h / 2, 11, actif ? C.accent : C.faible, 700, z.w - 6)
  })
}

function dessineTours(ctx, d, meta) {
  TOURS.forEach((t, k) => {
    const z = zoneLigne(d, k)
    const debloquee = meta.toursDeblocs.includes(t.id)
    const possible = !debloquee && meta.eclats >= t.coutDeblocage
    rect(ctx, z.x, z.y, z.w, z.h, C.fond)
    cadre(ctx, z.x, z.y, z.w, z.h, debloquee ? C.vert : possible ? C.accent : C.bord)
    ctx.textAlign = 'left'
    texte(ctx, t.nom, z.x + 8, z.y + 14, 12, debloquee ? C.texte : C.faible, 700, z.w - 90)
    texte(ctx, t.pitch, z.x + 8, z.y + 30, 10, C.faible, 700, z.w - 90)
    ctx.textAlign = 'right'
    texte(
      ctx,
      debloquee ? 'DÉBLOQUÉE' : `${t.coutDeblocage} éclats`,
      z.x + z.w - 8,
      z.y + 20,
      11,
      debloquee ? C.vert : possible ? C.accent : C.faible,
      700,
      90,
    )
    ctx.textAlign = 'center'
  })
}

function dessineAmeliorations(ctx, d, meta) {
  AMELIORATIONS_META.forEach((a, k) => {
    const z = zoneLigne(d, k)
    const niveau = L.niveauMeta(meta, a.id)
    const finie = niveau >= a.couts.length
    const cout = a.couts[niveau]
    const possible = !finie && meta.eclats >= cout
    rect(ctx, z.x, z.y, z.w, z.h, C.fond)
    cadre(ctx, z.x, z.y, z.w, z.h, finie ? C.vert : possible ? C.accent : C.bord)
    ctx.textAlign = 'left'
    texte(ctx, `${a.nom}  ${niveau}/${a.couts.length}`, z.x + 8, z.y + 14, 12, C.texte, 700, z.w - 90)
    texte(ctx, a.description, z.x + 8, z.y + 30, 10, C.faible, 700, z.w - 90)
    ctx.textAlign = 'right'
    texte(ctx, finie ? 'MAX' : `${cout} éclats`, z.x + z.w - 8, z.y + 20, 11, finie ? C.vert : possible ? C.accent : C.faible, 700, 90)
    ctx.textAlign = 'center'
  })
}
