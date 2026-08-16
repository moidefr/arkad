import { TOTAL_COMBOS, COLONNES_GRILLE } from './donnees.js'

/**
 * La géométrie partagée entre le dessin et le tap. VIVIER reste portrait —
 * comme EXPÉDITION — donc une seule disposition, calée sur `j.W`.
 */
export function dispo(j) {
  const marge = 20
  const largeur = j.W - marge * 2

  const bassin = { x: marge, y: 132, w: largeur, h: 82, cases: 8 } // deux rangées de huit

  const lignes = Math.ceil(TOTAL_COMBOS / COLONNES_GRILLE)
  const cote = Math.floor(largeur / COLONNES_GRILLE)
  const grille = {
    x: marge,
    y: 232,
    w: largeur,
    cote,
    colonnes: COLONNES_GRILLE,
    lignes,
    h: lignes * cote,
  }

  const bouton = { x: marge, y: j.H - 56, w: largeur, h: 40 }

  return {
    jauge: { x: marge, y: 108, w: largeur, h: 10 },
    bassin,
    grille,
    bouton,
  }
}

/** La case de la créature `i` dans le panneau du bassin (huit par rangée). */
export function zoneCreature(d, i) {
  const col = i % d.bassin.cases
  const rangee = Math.floor(i / d.bassin.cases)
  const cote = d.bassin.w / d.bassin.cases
  return { x: d.bassin.x + col * cote, y: d.bassin.y + rangee * (d.bassin.h / 2), w: cote, h: d.bassin.h / 2 }
}

/** La case `i` de la grille de collection, dans l'ordre des combinaisons. */
export function zoneCase(d, i) {
  const col = i % d.grille.colonnes
  const rangee = Math.floor(i / d.grille.colonnes)
  return { x: d.grille.x + col * d.grille.cote, y: d.grille.y + rangee * d.grille.cote, w: d.grille.cote, h: d.grille.cote }
}

export const dans = (p, z) => z && p.x >= z.x && p.x <= z.x + z.w && p.y >= z.y && p.y <= z.y + z.h

/** L'indice de la créature du bassin sous le doigt, ou -1. Reste à vérifier contre `e.bassin.length`. */
export function creatureIndexDe(d, p) {
  const b = d.bassin
  if (!dans(p, b)) return -1
  const cote = b.w / b.cases
  const col = Math.min(b.cases - 1, Math.floor((p.x - b.x) / cote))
  const rangee = Math.min(1, Math.floor((p.y - b.y) / (b.h / 2)))
  return rangee * b.cases + col
}

/** L'indice de la case de collection sous le doigt, ou -1 si hors grille. */
export function caseIndexDe(d, p) {
  const g = d.grille
  if (p.x < g.x || p.x >= g.x + g.w || p.y < g.y || p.y >= g.y + g.h) return -1
  const col = Math.floor((p.x - g.x) / g.cote)
  const rangee = Math.floor((p.y - g.y) / g.cote)
  const i = rangee * g.colonnes + col
  return i >= 0 && i < TOTAL_COMBOS ? i : -1
}
