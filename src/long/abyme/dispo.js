import { LARGEUR, HAUTEUR } from './donnees.js'

/**
 * La géométrie partagée entre le dessin et le tap. L'ABYME reste portrait —
 * comme EXPÉDITION — donc une seule disposition, calée sur `j.W`.
 */
const CELL = 32

export function dispo(j) {
  const gw = CELL * LARGEUR
  const gh = CELL * HAUTEUR
  const gx = Math.round((j.W - gw) / 2)
  const gy = 118

  const dpW = 66
  const dpH = 50
  const gap = 6
  const dpX0 = Math.round((j.W - (dpW * 3 + gap * 2)) / 2)
  const dpY0 = gy + gh + 40

  return {
    vie: { x: 20, y: 58, w: j.W - 40, h: 9 },
    echo: { x: 20, y: 72, w: j.W - 40, h: 5 },
    reliques: { x: 20, y: 100 },
    grille: { x: gx, y: gy, w: gw, h: gh, cell: CELL },
    message: { x: 20, y: gy + gh + 16, w: j.W - 40 },
    dpad: {
      haut: { x: dpX0 + dpW + gap, y: dpY0, w: dpW, h: dpH },
      gauche: { x: dpX0, y: dpY0 + dpH + gap, w: dpW, h: dpH },
      attendre: { x: dpX0 + dpW + gap, y: dpY0 + dpH + gap, w: dpW, h: dpH },
      droite: { x: dpX0 + 2 * (dpW + gap), y: dpY0 + dpH + gap, w: dpW, h: dpH },
      bas: { x: dpX0 + dpW + gap, y: dpY0 + 2 * (dpH + gap), w: dpW, h: dpH },
    },
    offre: [0, 1, 2].map((i) => ({ x: 20, y: gy + i * 82, w: j.W - 40, h: 72 })),
  }
}

export const dansZone = (p, z) => z && p.x >= z.x && p.x <= z.x + z.w && p.y >= z.y && p.y <= z.y + z.h
