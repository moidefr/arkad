import { C, ton } from '../../palette.js'
import { rect, bloc, cadre, texte, bandeTramee, lueur, borne } from '../../dessin.js'
import { MACHINES, etageDe } from './donnees.js'
import * as L from './logique.js'

/**
 * L'atelier vivant.
 *
 * Le reproche fait à la version précédente était juste : rien ne bougeait à
 * l'écran à part des nombres, et un incrémental sans spectacle est une file
 * d'attente. Cette scène est la moitié haute du jeu — un front de taille, deux
 * étages de machines qui tournent, des ouvriers qui font la navette, un
 * convoyeur, et un ciel qui bascule du jour à la nuit.
 *
 * Tout est calculé à partir du temps de jeu : aucun état à conserver, donc
 * rien à sauvegarder, et une reprise après huit heures d'absence ne fait pas
 * apparaître un atelier figé.
 */

export const SCENE = { y: 116, h: 186 }
const CIEL = { y: 116, h: 48 }
const JOUR = 300 // une journée complète en cinq minutes

/** Deux étages. Le rez porte les cinq premières machines, l'étage les cinq autres. */
const ETAGES = [
  { sol: 276, haut: 232 },
  { sol: 218, haut: 176 },
]
/**
 * Le front de taille est large et légendé : c'est le seul geste par lequel une
 * partie neuve démarre — sans lui on ne peut pas s'offrir la première pioche —
 * et il a remplacé un gros bouton CREUSER. Un joueur doit le trouver sans
 * qu'on le lui explique.
 */
const ROCHE = { x: 6, y: 120, w: 50, h: 156 }
const CASE_W = 40
const caseX = (k) => 62 + k * 58
const BANDE = { y: 284, h: 10 }

/** Les zones tactiles de la scène. Le dessin et l'appui lisent la même table. */
export function zones(e) {
  const out = [{ quoi: 'roche', ...ROCHE }]
  MACHINES.forEach((_, i) => {
    if (!e.n[i]) return
    const et = ETAGES[etageDe(i)]
    out.push({
      quoi: 'machine',
      i,
      x: caseX(i % 5),
      y: et.haut - 4,
      w: CASE_W,
      h: et.sol - et.haut + 8,
    })
  })
  return out
}

export function dessine(j, ctx) {
  const e = j.e
  const t = j.t
  const jour = 0.5 + 0.5 * Math.cos((t / JOUR) * Math.PI * 2)

  ciel(ctx, jour)
  frontDeTaille(ctx, e, t, jour)

  // L'étage supérieur n'existe qu'une fois qu'on a de quoi le remplir : sinon
  // c'est une passerelle vide, et une usine vide n'impressionne personne.
  const haut = MACHINES.some((_, i) => etageDe(i) === 1 && e.n[i] > 0)
  if (haut) passerelle(ctx, jour)
  rect(ctx, 0, ETAGES[0].sol, 360, 4, ton(C.panneau, 0.2))

  MACHINES.forEach((m, i) => {
    if (!e.n[i]) return
    machine(ctx, e, i, t)
  })

  ouvriers(ctx, e, t, haut)
  convoyeur(ctx, e, t)
}

// --- Décor ---------------------------------------------------------------------

function ciel(ctx, jour) {
  // Assez pour qu'on sente l'heure, pas assez pour manger la scène : le
  // tramage est un fond, pas un motif.
  const teinte = ton(C.violet, -0.62 + jour * 0.3)
  rect(ctx, 0, SCENE.y, 360, SCENE.h, ton(C.fond, 0.05))
  bandeTramee(ctx, 0, CIEL.y, 360, CIEL.h, teinte, 0.08 + jour * 0.42, 0)
  // La nuit, quelques lampes s'allument sur la charpente.
  if (jour < 0.45) {
    const force = (0.45 - jour) / 0.45
    for (const x of [70, 170, 270, 330]) lueur(ctx, x, CIEL.y + 8, 4, 4, C.accent, 2, force)
    for (const x of [70, 170, 270, 330]) rect(ctx, x, CIEL.y + 8, 4, 4, ton(C.accent, force * 0.4))
  }
}

/** Le front de taille : c'est lui qu'on frappe pour creuser à la main. */
function frontDeTaille(ctx, e, t, jour) {
  const chaud = e.coup > 0
  bloc(ctx, ROCHE.x, ROCHE.y, ROCHE.w, ROCHE.h, ton(C.panneau, -0.25 + jour * 0.12), 3)
  // Des veines de minerai, toujours aux mêmes endroits : c'est une paroi, pas
  // du bruit qui scintille.
  for (let k = 0; k < 9; k++) {
    const x = ROCHE.x + 6 + ((k * 13) % (ROCHE.w - 14))
    const y = ROCHE.y + 22 + k * 15
    const vif = chaud && k % 2 === 0
    rect(ctx, x, y, 6, 4, vif ? C.accent : ton(C.accent, -0.55))
  }
  // Tant que le geste rapporte plus que quelques secondes d'usine, la paroi
  // respire pour se signaler. Passé ce stade elle s'éteint toute seule : un
  // rappel qui ne s'arrête jamais devient du bruit.
  const utile = L.gainMain(e) > Math.max(1, L.production(e)) * 0.25
  if (chaud) {
    lueur(ctx, ROCHE.x, ROCHE.y, ROCHE.w, ROCHE.h, C.accent, 3, e.coup * 0.8)
    cadre(ctx, ROCHE.x, ROCHE.y, ROCHE.w, ROCHE.h, C.accent)
  } else if (utile) {
    const souffle = 0.35 + 0.3 * Math.sin(t * 2.2)
    lueur(ctx, ROCHE.x, ROCHE.y, ROCHE.w, ROCHE.h, C.accent, 2, souffle)
    cadre(ctx, ROCHE.x, ROCHE.y, ROCHE.w, ROCHE.h, ton(C.accent, -0.3))
  } else {
    cadre(ctx, ROCHE.x, ROCHE.y, ROCHE.w, ROCHE.h, ton(C.bord, -0.2))
  }
  texte(ctx, 'CREUSER', ROCHE.x + ROCHE.w / 2, ROCHE.y + 8, 10, utile ? C.accent : C.bord, 700, ROCHE.w - 6)
  // Le pic, planté dans la paroi, qui recule à chaque coup.
  const recul = e.coup * 6
  rect(ctx, ROCHE.x + ROCHE.w + 2 + recul, ROCHE.y + 70, 12, 3, ton(C.faible, 0.2))
  rect(ctx, ROCHE.x + ROCHE.w + 12 + recul, ROCHE.y + 66, 4, 11, C.faible)
}

function passerelle(ctx, jour) {
  const et = ETAGES[1]
  rect(ctx, 48, et.sol, 306, 4, ton(C.panneau, 0.25))
  rect(ctx, 48, et.sol + 4, 306, 2, ton(C.panneau, -0.4))
  for (const x of [64, 158, 252, 340]) rect(ctx, x, et.sol + 6, 4, ETAGES[0].sol - et.sol - 6, ton(C.panneau, -0.15))
  // Une rambarde, sinon l'étage a l'air d'une étagère.
  for (let x = 52; x < 352; x += 22) rect(ctx, x, et.haut - 12, 2, 12, ton(C.bord, jour * 0.2))
  rect(ctx, 48, et.haut - 14, 306, 2, ton(C.bord, 0.1))
}

// --- Machines --------------------------------------------------------------------

/**
 * Chaque ligne achetée existe à l'écran, et son animation bat au rythme de sa
 * production : une usine qui vient de doubler se voit avant de se lire.
 */
function machine(ctx, e, i, t) {
  const m = MACHINES[i]
  const et = ETAGES[etageDe(i)]
  const x = caseX(i % 5)
  const h = et.sol - et.haut
  const y = et.haut
  const casse = L.enPanne(e, i)
  const teinte = casse ? C.rouge : m.couleur
  // Le rythme suit le nombre de machines, pas la production brute : sinon tout
  // sature au bout d'une heure et plus rien ne varie.
  const v = casse ? 0 : borne(0.5 + Math.log10(1 + e.n[i]) * 0.9, 0.5, 3.2)
  const bat = Math.sin(t * v * Math.PI * 2)

  bloc(ctx, x, y + h - 16, CASE_W, 16, ton(teinte, -0.55), 2)
  bloc(ctx, x + 4, y + 10, CASE_W - 8, h - 24, ton(teinte, casse ? -0.35 : -0.1), 3)

  if (i % 4 === 0) {
    // Un piston qui bat.
    const dy = (bat * 0.5 + 0.5) * 10
    rect(ctx, x + CASE_W / 2 - 3, y + 2 + dy, 6, 12, ton(teinte, 0.3))
    rect(ctx, x + CASE_W / 2 - 7, y + 12 + dy, 14, 4, teinte)
  } else if (i % 4 === 1) {
    // Une roue à quatre rayons.
    const cx = x + CASE_W / 2
    const cy = y + h / 2 - 2
    const a = t * v * 2.2
    for (let k = 0; k < 4; k++) {
      const b = a + (k * Math.PI) / 2
      rect(ctx, cx + Math.cos(b) * 8 - 2, cy + Math.sin(b) * 8 - 2, 4, 4, teinte)
    }
    rect(ctx, cx - 3, cy - 3, 6, 6, ton(teinte, 0.35))
  } else if (i % 4 === 2) {
    // Un bras qui va et vient au-dessus du tapis.
    const dx = bat * 9
    rect(ctx, x + CASE_W / 2 - 2 + dx, y + 6, 4, h - 26, ton(teinte, 0.25))
    rect(ctx, x + CASE_W / 2 - 6 + dx, y + h - 22, 12, 5, teinte)
  } else {
    // Un four : la flamme respire et la fumée monte.
    const feu = 0.5 + 0.5 * bat
    const hf = 6 + feu * 8
    rect(ctx, x + 10, y + h - 14 - hf, CASE_W - 20, hf, ton(C.accent, feu * 0.4 - 0.1))
    if (!casse) {
      for (let k = 0; k < 3; k++) {
        const p = (t * 0.35 + k * 0.34) % 1
        const s = 3 + p * 6
        ctx.globalAlpha = (1 - p) * 0.35
        rect(ctx, x + CASE_W / 2 - s / 2, y - 2 - p * 26, s, s, ton(C.panneau, 0.5))
        ctx.globalAlpha = 1
      }
    }
  }

  // Le compteur, posé sur le socle. C'est la seule légende de la scène.
  texte(ctx, `×${e.n[i]}`, x + CASE_W / 2, y + h - 8, 11, casse ? C.rouge : ton(teinte, 0.75), 700, CASE_W - 6)

  if (casse) {
    const clign = Math.sin(t * 9) > 0
    lueur(ctx, x, y, CASE_W, h, C.rouge, 3, clign ? 0.9 : 0.4)
    cadre(ctx, x, y, CASE_W, h, C.rouge)
    if (clign) texte(ctx, '!', x + CASE_W / 2, y + h / 2, 22, C.rouge, 700)
  }
}

// --- Ouvriers ----------------------------------------------------------------------

/**
 * Des gens, enfin. Ils font la navette entre le front de taille et les
 * machines, portent un caillou à l'aller, reviennent les mains vides. Six au
 * maximum : au-delà, on ne voit plus qu'une foule qui grouille.
 */
function ouvriers(ctx, e, t, haut) {
  const total = Math.min(6, e.ouvriers)
  if (!total) return
  const etages = haut ? 2 : 1
  const cadence = 0.06 + L.couverture(e) * 0.05

  for (let k = 0; k < total; k++) {
    const et = ETAGES[k % etages]
    const phase = (t * cadence + k * 0.37 + (k % etages) * 0.19) % 1
    const aller = phase < 0.5
    const u = aller ? phase * 2 : (1 - phase) * 2
    const x = 50 + u * 268
    const y = et.sol - 14
    const pas = Math.floor(t * 5.5 + k) % 2

    // Le corps : quatre rectangles, deux images de marche. Il n'en faut pas plus.
    const habit = k % 3 === 0 ? C.cyan : k % 3 === 1 ? C.vert : C.accent
    rect(ctx, x + 1, y - 2, 6, 5, ton(C.texte, -0.15))
    rect(ctx, x, y + 3, 8, 7, habit)
    rect(ctx, x, y + 3, 8, 2, ton(habit, 0.35))
    rect(ctx, x + (pas ? 0 : 2), y + 10, 3, 4, ton(C.texte, -0.45))
    rect(ctx, x + (pas ? 5 : 3), y + 10, 3, 4, ton(C.texte, -0.45))
    // À l'aller, il porte. Au retour, il a les mains vides.
    if (aller) rect(ctx, x + 1, y - 8, 6, 5, ton(C.accent, 0.15))
  }
}

// --- Convoyeur ----------------------------------------------------------------------

function convoyeur(ctx, e, t) {
  const p = L.production(e)
  rect(ctx, 0, BANDE.y, 360, BANDE.h, ton(C.panneau, -0.3))
  rect(ctx, 0, BANDE.y, 360, 2, ton(C.panneau, 0.3))
  const glisse = (t * 46) % 14
  for (let x = -14; x < 366; x += 14) rect(ctx, x + glisse, BANDE.y + 4, 6, 3, ton(C.panneau, -0.55))

  if (p <= 0) return
  // Le nombre de cailloux dit la production sans écrire un chiffre : la bande
  // se remplit à mesure que l'usine grossit.
  const n = Math.min(14, 1 + Math.floor(Math.log10(1 + p) * 2.2))
  for (let k = 0; k < n; k++) {
    const x = ((t * 68 + (k * 360) / n) % 372) - 12
    const s = 4 + (k % 3)
    rect(ctx, x, BANDE.y - s + 1, s, s, ton(C.accent, -0.15 - (k % 3) * 0.12))
  }
}
