/**
 * La géométrie partagée entre le dessin et le tap. GRIMOIRE reste portrait,
 * comme EXPÉDITION — une seule disposition, calée sur `j.W`/`j.H`.
 *
 * La main de combat et les cartes de récompense partagent la même rangée en
 * bas d'écran (les deux phases ne se recouvrent jamais) : `zoneCarte` prend
 * le nombre de cases à répartir et centre la rangée, qu'elle porte cinq
 * cartes de main ou trois propositions de récompense plus une case « aucune ».
 */
export function dispo(j) {
  return {
    ennemi: { x: 20, y: 108, w: j.W - 40, h: 96 },
    joueur: { x: 20, y: 240, w: j.W - 40, h: 22 },
    main: { y: j.H - 188, h: 148 },
    finTour: { x: j.W - 96, y: j.H - 36, w: 80, h: 30 },
  }
}

export function zoneCarte(d, j, i, total) {
  const marge = 16
  const ecart = 6
  // Une carte qui pioche peut gonfler la main bien au-delà de MAIN_TAILLE en
  // plein tour : la largeur se resserre plutôt que de déborder, avec un
  // plancher pour rester tapable même à dix cartes en main.
  const n = Math.max(1, total)
  const w = Math.max(20, Math.min(76, (j.W - marge * 2 - ecart * (n - 1)) / n))
  const largeur = n * w + (n - 1) * ecart
  const x0 = (j.W - largeur) / 2
  return { x: x0 + i * (w + ecart), y: d.main.y, w, h: d.main.h }
}

export const dans = (p, z) => p && z && p.x >= z.x && p.x <= z.x + z.w && p.y >= z.y && p.y <= z.y + z.h
