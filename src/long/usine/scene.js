import { C, ton } from '../../palette.js'
import { rect, bloc, cadre, texte, bandeTramee, lueur, borne, px } from '../../dessin.js'
import { MACHINES, etageDe } from './donnees.js'
import { dispo } from './dispo.js'
import * as L from './logique.js'

/**
 * L'atelier vivant.
 *
 * Le reproche fait à la version précédente était juste : rien ne bougeait à
 * l'écran à part des nombres, et un incrémental sans spectacle est une file
 * d'attente. Cette scène est la moitié du jeu — un front de taille, deux étages
 * de machines qui tournent, des ouvriers qui font la navette, un convoyeur, et
 * un ciel qui bascule du jour à la nuit. La moitié haute debout, la moitié
 * gauche couché : `dispo.js` sait laquelle, ce fichier ne le sait pas.
 *
 * Tout est calculé à partir du temps de jeu : aucun état à conserver, donc
 * rien à sauvegarder, et une reprise après huit heures d'absence ne fait pas
 * apparaître un atelier figé.
 */

const JOUR = 300 // une journée complète en cinq minutes

/**
 * Cinq machines de front au sol, dix au premier étage — les cinq d'origine
 * puis les cinq du troisième palier, à la queue leu leu sur des postes plus
 * étroits (`posteHaut`) pour tenir dans la même largeur d'étage.
 */
const posteDe = (d, i) => (etageDe(i) === 0 ? d.poste : d.posteHaut)
const posteX = (d, i) => {
  const p = posteDe(d, i)
  const idx = etageDe(i) === 0 ? i : i - 5
  return p.x0 + idx * p.pas
}

/** Les zones tactiles de la scène. Le dessin et l'appui lisent la même table. */
export function zones(j) {
  const d = dispo(j)
  const out = [{ quoi: 'roche', ...d.roche }]
  MACHINES.forEach((_, i) => {
    if (!j.e.n[i]) return
    const et = d.etages[etageDe(i)]
    out.push({
      quoi: 'machine',
      i,
      x: posteX(d, i),
      y: et.haut - 4,
      w: posteDe(d, i).w,
      h: et.sol - et.haut + 8,
    })
  })
  return out
}

export function dessine(j, ctx, d = dispo(j)) {
  const e = j.e
  const t = j.t
  const jour = 0.5 + 0.5 * Math.cos((t / JOUR) * Math.PI * 2)

  ciel(ctx, d, jour)
  frontDeTaille(ctx, d, e, t, jour)

  // L'étage supérieur n'existe qu'une fois qu'on a de quoi le remplir : sinon
  // c'est une passerelle vide, et une usine vide n'impressionne personne.
  const haut = MACHINES.some((_, i) => etageDe(i) === 1 && e.n[i] > 0)
  if (haut) passerelle(ctx, d, jour)
  rect(ctx, d.scene.x, d.etages[0].sol, d.scene.w, 4, ton(C.panneau, 0.2))

  MACHINES.forEach((m, i) => {
    if (!e.n[i]) return
    machine(ctx, d, e, i, t)
  })

  ouvriers(ctx, d, e, t, haut)
  convoyeur(ctx, d, e, t)
}

// --- Décor ---------------------------------------------------------------------

function ciel(ctx, d, jour) {
  // Assez pour qu'on sente l'heure, pas assez pour manger la scène : le
  // tramage est un fond, pas un motif.
  const teinte = ton(C.violet, -0.62 + jour * 0.3)
  rect(ctx, d.scene.x, d.scene.y, d.scene.w, d.scene.h, ton(C.fond, 0.05))
  bandeTramee(ctx, d.scene.x, d.ciel.y, d.scene.w, d.ciel.h, teinte, 0.08 + jour * 0.42, 0)
  // La nuit, quelques lampes s'allument sur la charpente.
  if (jour < 0.45) {
    const force = (0.45 - jour) / 0.45
    for (const x of d.lampes) lueur(ctx, x, d.ciel.y + 8, 4, 4, C.accent, 2, force)
    for (const x of d.lampes) rect(ctx, x, d.ciel.y + 8, 4, 4, ton(C.accent, force * 0.4))
  }
}

/**
 * Le front de taille : c'est lui qu'on frappe pour creuser à la main.
 *
 * Il est large et légendé parce que c'est le seul geste par lequel une partie
 * neuve démarre — sans lui on ne peut pas s'offrir la première pioche — et
 * qu'il a remplacé un gros bouton CREUSER. Un joueur doit le trouver sans
 * qu'on le lui explique.
 */
function frontDeTaille(ctx, d, e, t, jour) {
  const r = d.roche
  const chaud = e.coup > 0
  bloc(ctx, r.x, r.y, r.w, r.h, ton(C.panneau, -0.25 + jour * 0.12), 3)
  // Des veines de minerai, toujours aux mêmes endroits : c'est une paroi, pas
  // du bruit qui scintille. Elles sont espacées de 15 px quelle que soit la
  // hauteur de la paroi — une veine étirée n'est plus une veine.
  const veines = Math.floor((r.h - 30) / 15) + 1
  for (let k = 0; k < veines; k++) {
    const x = r.x + 6 + ((k * 13) % (r.w - 14))
    const y = r.y + 22 + k * 15
    const vif = chaud && k % 2 === 0
    rect(ctx, x, y, 6, 4, vif ? C.accent : ton(C.accent, -0.55))
  }
  // Tant que le geste rapporte plus que quelques secondes d'usine, la paroi
  // respire pour se signaler. Passé ce stade elle s'éteint toute seule : un
  // rappel qui ne s'arrête jamais devient du bruit.
  const utile = L.gainMain(e) > Math.max(1, L.production(e)) * 0.25
  if (chaud) {
    lueur(ctx, r.x, r.y, r.w, r.h, C.accent, 3, e.coup * 0.8)
    cadre(ctx, r.x, r.y, r.w, r.h, C.accent)
  } else if (utile) {
    const souffle = 0.35 + 0.3 * Math.sin(t * 2.2)
    lueur(ctx, r.x, r.y, r.w, r.h, C.accent, 2, souffle)
    cadre(ctx, r.x, r.y, r.w, r.h, ton(C.accent, -0.3))
  } else {
    cadre(ctx, r.x, r.y, r.w, r.h, ton(C.bord, -0.2))
  }
  texte(ctx, 'CREUSER', r.x + r.w / 2, r.y + 8, 10, utile ? C.accent : C.bord, 700, r.w - 6)
  // Le pic, planté à mi-paroi, qui recule à chaque coup.
  const recul = e.coup * 6
  const yp = r.y + Math.round(r.h * 0.45)
  rect(ctx, r.x + r.w + 2 + recul, yp, 12, 3, ton(C.faible, 0.2))
  rect(ctx, r.x + r.w + 12 + recul, yp - 4, 4, 11, C.faible)
}

function passerelle(ctx, d, jour) {
  const et = d.etages[1]
  const p = d.passerelle
  rect(ctx, p.x, et.sol, p.w, 4, ton(C.panneau, 0.25))
  rect(ctx, p.x, et.sol + 4, p.w, 2, ton(C.panneau, -0.4))
  for (const x of p.piliers) rect(ctx, x, et.sol + 6, 4, d.etages[0].sol - et.sol - 6, ton(C.panneau, -0.15))
  // Une rambarde, sinon l'étage a l'air d'une étagère.
  for (let x = p.x + 4; x < p.x + p.w - 2; x += 22) rect(ctx, x, et.haut - 12, 2, 12, ton(C.bord, jour * 0.2))
  rect(ctx, p.x, et.haut - 14, p.w, 2, ton(C.bord, 0.1))
}

// --- Machines --------------------------------------------------------------------

/**
 * Chaque ligne achetée existe à l'écran, et son animation bat au rythme de sa
 * production : une usine qui vient de doubler se voit avant de se lire.
 */
function machine(ctx, d, e, i, t) {
  const m = MACHINES[i]
  const et = d.etages[etageDe(i)]
  const larg = posteDe(d, i).w
  const x = posteX(d, i)
  const h = et.sol - et.haut
  const y = et.haut
  const casse = L.enPanne(e, i)
  const teinte = casse ? C.rouge : m.couleur
  // Le rythme suit le nombre de machines, pas la production brute : sinon tout
  // sature au bout d'une heure et plus rien ne varie.
  const v = casse ? 0 : borne(0.5 + Math.log10(1 + e.n[i]) * 0.9, 0.5, 3.2)
  const bat = Math.sin(t * v * Math.PI * 2)

  bloc(ctx, x, y + h - 16, larg, 16, ton(teinte, -0.55), 2)
  bloc(ctx, x + 4, y + 10, larg - 8, h - 24, ton(teinte, casse ? -0.35 : -0.1), 3)

  if (i % 4 === 0) {
    // Un piston qui bat.
    const dy = (bat * 0.5 + 0.5) * 10
    rect(ctx, x + larg / 2 - 3, y + 2 + dy, 6, 12, ton(teinte, 0.3))
    rect(ctx, x + larg / 2 - 7, y + 12 + dy, 14, 4, teinte)
  } else if (i % 4 === 1) {
    // Une roue à quatre rayons.
    const cx = x + larg / 2
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
    rect(ctx, x + larg / 2 - 2 + dx, y + 6, 4, h - 26, ton(teinte, 0.25))
    rect(ctx, x + larg / 2 - 6 + dx, y + h - 22, 12, 5, teinte)
  } else {
    // Un four : la flamme respire et la fumée monte.
    const feu = 0.5 + 0.5 * bat
    const hf = 6 + feu * 8
    rect(ctx, x + 10, y + h - 14 - hf, larg - 20, hf, ton(C.accent, feu * 0.4 - 0.1))
    if (!casse) {
      for (let k = 0; k < 3; k++) {
        const p = (t * 0.35 + k * 0.34) % 1
        const s = 3 + p * 6
        ctx.globalAlpha = (1 - p) * 0.35
        rect(ctx, x + larg / 2 - s / 2, y - 2 - p * 26, s, s, ton(C.panneau, 0.5))
        ctx.globalAlpha = 1
      }
    }
  }

  // Le compteur, posé sur le socle. C'est la seule légende de la scène.
  texte(ctx, `×${e.n[i]}`, x + larg / 2, y + h - 8, 11, casse ? C.rouge : ton(teinte, 0.75), 700, larg - 6)

  if (casse) {
    const clign = Math.sin(t * 9) > 0
    lueur(ctx, x, y, larg, h, C.rouge, 3, clign ? 0.9 : 0.4)
    cadre(ctx, x, y, larg, h, C.rouge)
    if (clign) texte(ctx, '!', x + larg / 2, y + h / 2, 22, C.rouge, 700)
  }
}

// --- Ouvriers ----------------------------------------------------------------------

/**
 * Des gens, enfin. Ils font la navette entre le front de taille et les
 * machines, portent un caillou à l'aller, reviennent les mains vides. Six au
 * maximum : au-delà, on ne voit plus qu'une foule qui grouille.
 */
function ouvriers(ctx, d, e, t, haut) {
  const total = Math.min(6, e.ouvriers)
  if (!total) return
  const etages = haut ? 2 : 1
  const allee = d.ouvriers
  // La cadence est un nombre d'allers-retours par seconde : à travée plus
  // courte, elle doit monter, sinon les ouvriers traînent. Le facteur ramène
  // tout à la marche réglée debout, sur une travée de 268 px — l'ouvrier garde
  // son pas dans les deux gabarits, et son pas est ce qui dit s'il y a du monde.
  const cadence = (0.06 + L.couverture(e) * 0.05) * (268 / allee.larg)

  for (let k = 0; k < total; k++) {
    const et = d.etages[k % etages]
    const phase = (t * cadence + k * 0.37 + (k % etages) * 0.19) % 1
    const aller = phase < 0.5
    const u = aller ? phase * 2 : (1 - phase) * 2
    const x = allee.x0 + u * allee.larg
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

/**
 * Un morceau de convoyeur, rogné aux deux bords de l'atelier.
 *
 * Debout, l'écran rognait tout seul : ce qui dépassait tombait dans le vide.
 * Couché, au-delà du bord commence la colonne de la liste, et un taquet qui
 * passe dessous fait un débris. On rogne sur la grille de PX et pas au pixel
 * près, sinon l'arrondi repousse le dernier taquet d'un cran **au-delà** du
 * bord — exactement ce qu'on voulait éviter.
 */
function tapis(ctx, d, x, y, w, h, couleur) {
  const a = Math.max(px(d.scene.x), px(x))
  const fin = Math.min(px(d.scene.x + d.scene.w), px(x) + px(w))
  if (fin > a) rect(ctx, a, y, fin - a, h, couleur)
}

function convoyeur(ctx, d, e, t) {
  const p = L.production(e)
  const b = d.bande
  const x0 = d.scene.x
  const w = d.scene.w
  rect(ctx, x0, b.y, w, b.h, ton(C.panneau, -0.3))
  rect(ctx, x0, b.y, w, 2, ton(C.panneau, 0.3))
  // La bande garde sa vitesse en pixels par seconde : c'est un tapis, il ne
  // ralentit pas parce que l'atelier est moins large.
  const glisse = (t * 46) % 14
  for (let x = x0 - 14; x < x0 + w; x += 14) tapis(ctx, d, x + glisse, b.y + 4, 6, 3, ton(C.panneau, -0.55))

  if (p <= 0) return
  // Le nombre de cailloux dit la production sans écrire un chiffre : la bande
  // se remplit à mesure que l'usine grossit.
  const n = Math.min(14, 1 + Math.floor(Math.log10(1 + p) * 2.2))
  for (let k = 0; k < n; k++) {
    const x = x0 + (((t * 68 + (k * w) / n) % (w + 12)) - 12)
    const s = 4 + (k % 3)
    tapis(ctx, d, x, b.y - s + 1, s, s, ton(C.accent, -0.15 - (k % 3) * 0.12))
  }
}
