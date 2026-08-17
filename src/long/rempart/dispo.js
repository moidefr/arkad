/**
 * La géométrie partagée entre le dessin et le tap. REMPART reste couché —
 * comme USINE — parce qu'un plateau de tower defense veut de la largeur : le
 * chemin d'un bord à l'autre, et un panneau à côté pour poser les tours sans
 * couvrir le champ de bataille du doigt.
 */
import { EMPLACEMENT_RAYON, PLATEAU_W, TOURS } from './donnees.js'

export function dispo(j) {
  // REMPART est pensé couché, où PLATEAU_W (490) laisse toujours 150px de
  // panneau sur les 640 de large. Un joueur qui n'a pas tourné son téléphone
  // (360 de large) doit quand même obtenir un panneau qui tient sur l'écran :
  // le plateau cède la place plutôt que de pousser le panneau en largeur
  // négative.
  const largeurPlateau = Math.min(PLATEAU_W, Math.max(0, j.W - 150))
  const plateau = { x: 0, y: j.HUD, w: largeurPlateau, h: j.H - j.HUD }
  const panneau = { x: largeurPlateau, y: j.HUD, w: j.W - largeurPlateau, h: j.H - j.HUD }
  const pX = panneau.x + 10
  const pW = panneau.w - 20

  return {
    plateau,
    panneau,
    vie: { x: pX, y: panneau.y + 8, w: pW, h: 10 },
    info: { x: pX, y: panneau.y + 30 },
    boutique: { x: pX, y0: panneau.y + 66, w: pW, h: 30, pas: 34 },
    lancer: { x: pX, y: j.H - 36, w: pW, h: 30 },

    // Le menu, entre deux défenses : des cartes à gauche, une boutique à
    // onglets à droite — la même coupure verticale que le plateau/panneau,
    // pour que l'œil reconnaisse tout de suite qu'on est ailleurs.
    onglets: { x: pX, y: j.HUD + 8, w: pW, h: 26, pas: 30 },
    cartes: { x0: 16, y0: j.HUD + 12, w: 220, h: 96, pasX: 236, pasY: 108, cols: 2 },
    lignes: { x: pX, y0: j.HUD + 44, w: pW, h: 40, pas: 44 },
  }
}

export const dans = (p, z) => z && p.x >= z.x && p.x <= z.x + z.w && p.y >= z.y && p.y <= z.y + z.h

const INSPECT_W = 300
const INSPECT_H = 148
const INSPECT_BOUTON_H = 32

/**
 * La fiche d'inspection d'une tour posée (stats en survol, proposition
 * d'amélioration en appui court) : centrée sur l'écran, comme l'écran de
 * défaite — indépendante de la position de la tour, pour ne jamais déborder
 * du plateau ni se cacher derrière le panneau.
 */
export function zoneInspect(j) {
  const x = Math.round(j.W / 2 - INSPECT_W / 2)
  const y = Math.round(j.H / 2 - INSPECT_H / 2)
  return {
    box: { x, y, w: INSPECT_W, h: INSPECT_H },
    bouton: { x: x + 20, y: y + INSPECT_H - INSPECT_BOUTON_H - 14, w: INSPECT_W - 40, h: INSPECT_BOUTON_H },
  }
}

export const zoneTourBoutique = (d, k) => ({ x: d.boutique.x, y: d.boutique.y0 + k * d.boutique.pas, w: d.boutique.w, h: d.boutique.h })
export const zoneOnglet = (d, k) => ({ x: d.onglets.x + k * d.onglets.pas, y: d.onglets.y, w: d.onglets.pas - 4, h: d.onglets.h })
export const zoneCarte = (d, k) => ({
  x: d.cartes.x0 + (k % d.cartes.cols) * d.cartes.pasX,
  y: d.cartes.y0 + Math.floor(k / d.cartes.cols) * d.cartes.pasY,
  w: d.cartes.w,
  h: d.cartes.h,
})
export const zoneLigne = (d, k) => ({ x: d.lignes.x, y: d.lignes.y0 + k * d.lignes.pas, w: d.lignes.w, h: d.lignes.h })

/** L'emplacement le plus proche du tap, dans son rayon de tolérance — ou -1. */
export function emplacementSous(carte, d, p) {
  const lx = p.x - d.plateau.x
  const ly = p.y - d.plateau.y
  let meilleur = -1
  let meilleureDist = EMPLACEMENT_RAYON
  carte.emplacements.forEach((e, i) => {
    const dist = Math.hypot(e.x - lx, e.y - ly)
    if (dist <= meilleureDist) {
      meilleureDist = dist
      meilleur = i
    }
  })
  return meilleur
}

/** Les tours affichables en boutique pendant une défense : seulement celles débloquées. */
export const toursBoutique = (meta) => TOURS.filter((t) => meta.toursDeblocs.includes(t.id))
