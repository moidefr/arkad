/**
 * RUÉE — le dessin, et les rectangles qu'on peut toucher.
 *
 * Une seule fonction de disposition, `dispo(j)`, lue par le dessin **et** par
 * l'appui. C'est la règle de la maison, et elle a déjà coûté cher deux fois
 * dans ce projet pour ne pas la tenir ici.
 *
 * Particularité de ce jeu : la quasi-totalité de l'écran est **une seule zone
 * tactile**. On ne vise rien, on appuie — donc les rectangles ne servent
 * qu'aux menus, et le champ de jeu est un grand rectangle unique. C'est
 * précisément ce qui rend le jeu jouable d'une main sur un téléphone.
 */
import { C, ton } from '../../palette.js'
import { rect, cadre, bloc, lueur, texte, pastille, trame, px, PX } from '../../dessin.js'
import { CASE, TAILLE } from './logique.js'
import { RANGEES, NIVEAUX } from './donnees.js'

export function dispo(j) {
  const haut = j.HUD
  const dispo = j.H - haut
  const hauteurNiveau = RANGEES * CASE
  return {
    // Le champ est calé sur le bas : c'est le sol qui sert de repère à l'œil,
    // pas le plafond. Centrer verticalement ferait sauter le sol d'un format
    // à l'autre.
    champ: { x: 0, y: haut, w: j.W, h: dispo },
    solY: haut + Math.min(dispo - 12, Math.max(hauteurNiveau, dispo * 0.86)),
    barre: { x: 20, y: haut + 10, w: j.W - 40, h: 10 },
    // Le menu de choix de niveau : une carte par niveau, en colonne.
    carte: (i, n) => {
      const cols = j.paysage ? 2 : 1
      const w = Math.floor((j.W - 40 - (cols - 1) * 12) / cols)
      const h = j.paysage ? 52 : 60
      return {
        x: 20 + (i % cols) * (w + 12),
        y: haut + 56 + Math.floor(i / cols) * (h + 10),
        w,
        h,
      }
    },
    retour: { x: 20, y: j.H - 52, w: j.W - 40, h: 40 },
    entrainement: { x: 20, y: j.H - 100, w: j.W - 40, h: 40 },
  }
}

/** Le décor : un ciel tramé, un sol, et rien qui distraie de la trajectoire. */
function fond(ctx, d, j, teinte) {
  rect(ctx, 0, d.champ.y, j.W, d.champ.h, C.fond)
  trame(ctx, 0, d.champ.y, j.W, d.champ.h - 8, 24, ton(teinte, -0.62))
}

/**
 * Le niveau. On ne dessine que les colonnes visibles — un niveau fait des
 * centaines de cases, et les parcourir toutes à chaque image se voit sur un
 * téléphone.
 */
export function niveau(ctx, d, j, e, teinte) {
  fond(ctx, d, j, teinte)
  const base = d.solY
  // La caméra ne recule jamais avant le début du niveau : sinon le premier
  // tiers d'écran est vide au départ, le sol commence au milieu de nulle part,
  // et le joueur croit que le niveau a mal chargé.
  const camera = Math.max(0, e.x - j.W * 0.28)
  const c0 = Math.max(0, Math.floor(camera / CASE) - 1)
  const c1 = Math.min(e.long - 1, Math.ceil((camera + j.W) / CASE) + 1)

  for (let cx = c0; cx <= c1; cx++) {
    const col = e.grille[cx]
    if (!col) continue
    const X = cx * CASE - camera
    for (let cy = 0; cy < RANGEES; cy++) {
      const q = col[cy]
      if (q === '.') continue
      const Y = base - (RANGEES - cy) * CASE
      if (q === '#') bloc(ctx, X, Y, CASE, CASE, ton(teinte, -0.3), 3)
      else if (q === '^') pic(ctx, X, Y, teinte)
      else if (q === 'o') orbe(ctx, X + CASE / 2, Y + CASE / 2, e)
      else if (q === '_') tremplin(ctx, X, Y)
      else if (q === 'S' || q === 'C') portail(ctx, X, Y, q === 'S' ? C.cyan : C.accent)
      else if (q === '>' || q === '<') portail(ctx, X, Y, q === '>' ? C.vert : C.violet)
    }
  }
  joueur(ctx, d, j, e, camera, teinte)
}

/** Un pic : un triangle en marches, parce qu'on ne lisse rien ici. */
function pic(ctx, X, Y, teinte) {
  const n = Math.floor(CASE / PX)
  ctx.fillStyle = C.rouge
  for (let i = 0; i < n; i++) {
    const larg = CASE * (1 - i / n)
    ctx.fillRect(px(X + (CASE - larg) / 2), px(Y + CASE - (i + 1) * PX), px(larg), PX)
  }
  ctx.fillStyle = ton(C.rouge, 0.4)
  ctx.fillRect(px(X + CASE / 2 - PX), px(Y + 4), PX * 2, PX * 2)
}

function orbe(ctx, cx, cy, e) {
  const prise = e.orbesPrises.has(`${Math.floor(cx / CASE)}:${Math.floor(cy / CASE)}`)
  const teinte = prise ? C.faible : C.vert
  lueur(ctx, cx - 8, cy - 8, 16, 16, teinte, 3, 1.2)
  pastille(ctx, cx, cy, 9, teinte)
  pastille(ctx, cx, cy, 5, C.fond)
}

function tremplin(ctx, X, Y) {
  lueur(ctx, X + 3, Y + CASE - 10, CASE - 6, 8, C.violet, 2, 1.2)
  bloc(ctx, X + 3, Y + CASE - 10, CASE - 6, 8, C.violet, 2)
}

function portail(ctx, X, Y, teinte) {
  lueur(ctx, X + 6, Y - CASE, CASE - 12, CASE * 2, teinte, 3, 1)
  rect(ctx, X + 8, Y - CASE, CASE - 16, CASE * 2, teinte)
  rect(ctx, X + 11, Y - CASE + 3, CASE - 22, CASE * 2 - 6, ton(teinte, -0.55))
}

/** Le joueur, tourné : la rotation dit d'un coup d'œil si on est en l'air. */
function joueur(ctx, d, j, e, camera, teinte) {
  const X = e.x - camera
  const Y = d.solY - (RANGEES * CASE - e.y)
  ctx.save()
  ctx.translate(px(X), px(Y))
  ctx.rotate((e.rotation * Math.PI) / 180)
  const h = TAILLE
  lueur(ctx, -h / 2, -h / 2, h, h, teinte, 3, 1.4)
  if (e.mode === 'cube') {
    bloc(ctx, -h / 2, -h / 2, h, h, teinte, 3)
    rect(ctx, -4, -4, 8, 8, C.fond)
  } else {
    // Le vaisseau : plus large que haut, pour qu'on lise sa pente.
    bloc(ctx, -h / 2 - 3, -h / 2 + 3, h + 6, h - 6, teinte, 2)
    rect(ctx, -2, -3, 8, 6, C.fond)
  }
  ctx.restore()
}

/** La barre d'avancement — le score du jeu, montré en permanence. */
export function barre(ctx, d, part, record, teinte) {
  const b = d.barre
  rect(ctx, b.x, b.y, b.w, b.h, C.panneau)
  if (record > 0) {
    // Le record est un repère, pas un remplissage : un trait, pour qu'on voie
    // l'instant exact où on le dépasse.
    rect(ctx, b.x + b.w * record - 1, b.y - 3, 3, b.h + 6, C.faible)
  }
  if (part > 0) {
    rect(ctx, b.x, b.y, b.w * part, b.h, teinte)
    lueur(ctx, b.x, b.y, b.w * part, b.h, teinte, 2, 0.9)
  }
  cadre(ctx, b.x, b.y, b.w, b.h, C.bord)
}

/** Le menu : les niveaux, leur record, et ce qui reste fermé. */
export function menu(ctx, d, j, p, ouvert) {
  ctx.textAlign = 'left'
  texte(ctx, 'RUÉE', 20, j.HUD + 30, 24, C.accent, 700, undefined, 3)
  ctx.textAlign = 'right'
  texte(ctx, `${p.finis.size} / ${NIVEAUX.length}`, j.W - 20, j.HUD + 30, 14, C.faible)

  NIVEAUX.forEach((n, i) => {
    const z = d.carte(i, n)
    const libre = ouvert(p, n.id)
    const record = p.records[n.id] ?? 0
    const fini = p.finis.has(n.id)
    const teinte = fini ? C.vert : libre ? C.cyan : C.bord

    rect(ctx, z.x, z.y, z.w, z.h, C.panneau)
    rect(ctx, z.x, z.y, 4, z.h, teinte)
    // La barre de record est peinte dans la carte : on voit d'un coup d'œil
    // où on en est de chaque niveau sans avoir à l'ouvrir.
    if (libre && record > 0) {
      ctx.globalAlpha = 0.16
      rect(ctx, z.x + 4, z.y, (z.w - 4) * record, z.h, teinte)
      ctx.globalAlpha = 1
    }
    cadre(ctx, z.x, z.y, z.w, z.h, libre ? teinte : C.bord)

    ctx.textAlign = 'left'
    texte(ctx, libre ? n.nom : '— — —', z.x + 14, z.y + 22, 14, libre ? C.texte : C.faible)
    texte(ctx, libre ? `${p.essais[n.id] ?? 0} essais` : 'finis le précédent', z.x + 14, z.y + 42, 11, C.faible)
    ctx.textAlign = 'right'
    if (libre) texte(ctx, fini ? 'FINI' : `${Math.round(record * 100)} %`, z.x + z.w - 14, z.y + 30, 15, teinte)
  })
  ctx.textAlign = 'center'
}

/** Un bouton de menu, dessiné là où `dispo` l'a mis. */
export function bouton(ctx, z, libelle, teinte = C.faible, allume = false) {
  rect(ctx, z.x, z.y, z.w, z.h, allume ? ton(teinte, -0.6) : C.panneau)
  cadre(ctx, z.x, z.y, z.w, z.h, teinte)
  ctx.textAlign = 'center'
  texte(ctx, libelle, z.x + z.w / 2, z.y + z.h / 2, 13, allume ? teinte : C.texte)
}
