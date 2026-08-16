import { C, ton } from '../../palette.js'
import { texte, rect, bloc, cadre, pastille } from '../../dessin.js'
import { LARGEUR, HAUTEUR, ECHO_MAX, MONSTRES, RELIQUES } from './donnees.js'
import * as L from './logique.js'

const GLYPHES = { haut: '▲', bas: '▼', gauche: '◀', droite: '▶', attendre: '●' }

export function dessine(ctx, d, j, e) {
  ctx.textAlign = 'left'
  texte(ctx, `ÉTAGE ${e.profondeur}`, 20, 74, 16, C.violet, 700)
  ctx.textAlign = 'right'
  texte(ctx, `${Math.max(0, Math.round(e.vie))} / ${e.vieMax} PV`, j.W - 20, 74, 13, C.texte, 700)
  ctx.textAlign = 'left'

  rect(ctx, d.vie.x, d.vie.y, d.vie.w, d.vie.h, C.panneau)
  const fracVie = Math.max(0, e.vie) / e.vieMax
  if (fracVie > 0) bloc(ctx, d.vie.x, d.vie.y, d.vie.w * fracVie, d.vie.h, fracVie > 0.3 ? C.vert : C.rouge, 2)

  if (e.echo > 0 || L.aRelique(e, 'symbiose')) {
    rect(ctx, d.echo.x, d.echo.y, d.echo.w, d.echo.h, C.panneau)
    const fracEcho = Math.min(1, e.echo / ECHO_MAX)
    if (fracEcho > 0) bloc(ctx, d.echo.x, d.echo.y, d.echo.w * fracEcho, d.echo.h, C.cyan, 2)
  }

  e.reliques.forEach((_, i) => pastille(ctx, d.reliques.x + 6 + i * 14, d.reliques.y, 5, C.accent))

  grille(ctx, d, e)

  ctx.textAlign = 'center'
  texte(ctx, j.e.dernier ?? '', j.W / 2, d.message.y, 12, C.faible, 700, d.message.w)

  if (e.offre) offre(ctx, d, e)
  else dpad(ctx, d)
  ctx.textAlign = 'left'
}

function grille(ctx, d, e) {
  const { x, y, cell } = d.grille
  rect(ctx, x, y, d.grille.w, d.grille.h, C.panneau)

  for (let gy = 0; gy < HAUTEUR; gy++) {
    for (let gx = 0; gx < LARGEUR; gx++) {
      const cx = x + gx * cell
      const cy = y + gy * cell
      if (e.salle.murs[gy * LARGEUR + gx]) rect(ctx, cx, cy, cell, cell, ton(C.bord, -0.2))
      else rect(ctx, cx + 1, cy + 1, cell - 2, cell - 2, ton(C.fond, 0.05))
    }
  }

  const s = e.salle.sortie
  const ouverte = e.monstres.every((m) => m.camp === 'allie')
  cadre(ctx, x + s.x * cell + 2, y + s.y * cell + 2, cell - 4, cell - 4, ouverte ? C.accent : C.faible)

  for (const p of e.salle.pieges) {
    if (!p.revele) continue
    pastille(ctx, x + (p.x + 0.5) * cell, y + (p.y + 0.5) * cell, 4, C.rouge)
  }

  for (const m of e.monstres) {
    const info = MONSTRES[m.type]
    const couleur = m.camp === 'allie' ? C.vert : info.couleur
    bloc(ctx, x + m.x * cell + 3, y + m.y * cell + 3, cell - 6, cell - 6, couleur, 2)
    if (m.etourdi) cadre(ctx, x + m.x * cell + 2, y + m.y * cell + 2, cell - 4, cell - 4, C.accent)
  }

  pastille(ctx, x + (e.joueur.x + 0.5) * cell, y + (e.joueur.y + 0.5) * cell, cell * 0.32, C.texte)
}

function dpad(ctx, d) {
  ctx.textAlign = 'center'
  for (const [k, z] of Object.entries(d.dpad)) {
    rect(ctx, z.x, z.y, z.w, z.h, C.panneau)
    cadre(ctx, z.x, z.y, z.w, z.h, C.bord)
    texte(ctx, GLYPHES[k], z.x + z.w / 2, z.y + z.h / 2, 18, C.texte, 700)
  }
}

function offre(ctx, d, e) {
  const centre = d.grille.x + d.grille.w / 2
  ctx.textAlign = 'center'
  texte(ctx, 'UNE RELIQUE T’ATTEND', centre, d.offre[0].y - 12, 13, C.violet, 700)
  e.offre.forEach((id, i) => {
    const r = RELIQUES.find((x) => x.id === id)
    const z = d.offre[i]
    rect(ctx, z.x, z.y, z.w, z.h, C.panneau)
    cadre(ctx, z.x, z.y, z.w, z.h, C.violet)
    texte(ctx, r.nom, centre, z.y + 24, 15, C.texte, 700, z.w - 20)
    texte(ctx, r.dit, centre, z.y + 46, 11, C.faible, 700, z.w - 24)
  })
}
