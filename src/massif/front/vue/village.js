/**
 * Le village vivant — le spawn qui remplace l'ancien camp aux quatre
 * boutons empilés. Huit emplacements fixes, une scène qui bouge, et
 * strictement aucune position stockée : tout se dérive du temps de jeu `t`
 * et d'un index `k`, la même technique que l'atelier de l'usine
 * (`src/long/usine/scene.js`) — une onde triangulaire pour les allers-retours,
 * un corps en quatre rectangles, un cycle de marche à deux images. Reprendre
 * la partie huit heures plus tard ne montre pas un village figé, et rien
 * ici n'a besoin d'être sauvegardé.
 *
 * Chaque emplacement réagit à l'état réel de la compagnie — jamais
 * décoratif. `qg`/`campement`/`porte` routent vers des écrans déjà
 * existants ; les bâtiments ouvrent l'écran `batiment()` du lot 3 ; les
 * échoppes (marché + forge, et tout ce que le village ne représente pas
 * lui-même) ouvrent la liste complète des neuf bâtiments.
 */
import { C, ton } from '../../../palette.js'
import { rect, bloc, texte, lueur, pastille, bandeTramee } from '../../../dessin.js'
import * as Cie from '../compagnie.js'
import * as U from '../unites.js'
import * as V from '../ville.js'
import { entete, bourse } from './pieces.js'
import * as D from './dispo.js'

export const PLOTS = [
  { id: 'qg', nom: 'ÉTAT-MAJOR', quoi: 'uniques' },
  { id: 'caserne', nom: 'CASERNE', quoi: 'caserne' },
  { id: 'campement', nom: 'CAMPEMENT', quoi: 'compagnie' },
  { id: 'porte', nom: 'LA ROUTE', quoi: 'campagne' },
  { id: 'infirmerie', nom: 'INFIRMERIE', quoi: 'batiment', bat: 'infirmerie' },
  { id: 'taverne', nom: 'TAVERNE', quoi: 'batiment', bat: 'taverne' },
  { id: 'grenier', nom: 'GRENIER', quoi: 'batiment', bat: 'grenier' },
  { id: 'echoppes', nom: 'ÉCHOPPES', quoi: 'ville' },
]

/**
 * L'heure du village, en 0..1 (0 = minuit, 0.5 = midi). Pure : elle ne lit
 * que le jour compté par la ville et le temps de jeu écoulé, jamais un état
 * caché — revenir un autre jour à la même seconde de jeu ne montre pas la
 * même heure, sans qu'aucune valeur n'ait été mise de côté pour s'en
 * souvenir.
 */
export const phaseJour = (c, t) => ((c.ville?.jour ?? 1) * 0.37 + t / 90) % 1

/** Un texte centré sur `cx` : pose et repose l'alignement, jamais laissé traîner. */
function centre(ctx, s, cx, y, taille, couleur, largeurMax) {
  ctx.textAlign = 'center'
  texte(ctx, s, cx, y, taille, couleur, 700, largeurMax)
  ctx.textAlign = 'left'
}

/** Un corps en quatre rectangles, deux images de marche — celui de l'usine. */
function silhouette(ctx, x, y, pas, habit) {
  rect(ctx, x + 1, y - 2, 6, 5, ton(C.texte, -0.15))
  rect(ctx, x, y + 3, 8, 7, habit)
  rect(ctx, x, y + 3, 8, 2, ton(habit, 0.35))
  rect(ctx, x + (pas ? 0 : 2), y + 10, 3, 4, ton(C.texte, -0.45))
  rect(ctx, x + (pas ? 5 : 3), y + 10, 3, 4, ton(C.texte, -0.45))
}

/** `n` silhouettes en aller-retour dans la largeur du terrain, cadence normalisée sur 84 px. */
function marcheurs(ctx, terrain, n, t, cadenceBase, habit) {
  const cadence = cadenceBase * (84 / terrain.w)
  const A = terrain.x + 16
  const B = terrain.x + terrain.w - 16
  for (let k = 0; k < n; k++) {
    const phase = (t * cadence + k * 0.37) % 1
    const u = phase < 0.5 ? phase * 2 : (1 - phase) * 2
    const x = A + u * (B - A)
    const pas = Math.floor(t * 5.5 + k) % 2
    silhouette(ctx, x, terrain.y + terrain.h - 18, pas, habit)
  }
}

/** Le socle d'un emplacement : un bâtiment générique, teinté, avec son nom. */
function socle(ctx, z, teinte, construit) {
  const h = Math.round(z.h * 0.4)
  const y = z.y + z.h - h
  bloc(ctx, z.x + 6, y, z.w - 12, h, construit ? teinte : ton(C.bord, -0.2), 2)
  centre(ctx, z.nom, z.x + z.w / 2, z.y + z.h - 6, 8, C.faible, z.w - 8)
}

// --- La scène --------------------------------------------------------------------

export function village(ctx, j, c) {
  const ch = D.chassis(j)
  const d = D.village(j)
  const t = j.t ?? 0
  const jour = phaseJour(c, t)
  const nuit = jour < 0.22 || jour > 0.85
  const saison = V.saison(c)
  const hiver = saison.id === 'hiver'

  entete(ctx, ch.entete, 'LE VILLAGE', `JOUR ${c.ville?.jour ?? 1} · ${saison.nom}`)

  // Le ciel : la même bande tramée que partout ailleurs dans le jeu, teintée
  // par l'heure — sombre la nuit, ambrée au levant, claire en plein jour. En
  // hiver la même bande vire au froid, jamais une deuxième palette à tenir.
  const teinteCiel = nuit
    ? ton(C.violet, -0.6)
    : hiver
      ? ton(C.cyan, -0.5)
      : jour < 0.3 || jour > 0.75
        ? C.accent
        : ton(C.cyan, -0.3)
  bandeTramee(ctx, d.ciel.x, d.ciel.y, d.ciel.w, d.ciel.h, teinteCiel, nuit ? 0.5 : 0.2, 0)
  rect(ctx, d.ciel.x, d.ciel.y + d.ciel.h - 2, d.ciel.w, 2, ton(C.panneau, -0.3))
  // Une neige légère, seule trace au sol de la saison — rien qui ne bouge ni
  // ne se lise en combat, juste le village qui s'habille.
  if (hiver) {
    for (let k = 0; k < 6; k++) {
      const x = d.ciel.x + ((k + 0.5) / 6) * d.ciel.w
      pastille(ctx, x, d.ciel.y + d.ciel.h - 5, 1.5, ton(C.texte, 0.55))
    }
  }

  const zones = []
  const aligne = Cie.alignees(c)
  const blesses = c.troupes.filter((u) => u.pv < U.fiche(u).pvMax).length

  PLOTS.forEach((p, i) => {
    const z = { ...d.plots[i], nom: p.nom }
    // `id` et non `bat` : c'est le nom que lit le gestionnaire `batiment:` de
    // front.js, le même que celui que rend déjà l'écran `ville()` du lot 3.
    zones.push({ x: z.x, y: z.y, w: z.w, h: z.h, quoi: p.quoi, id: p.bat })

    if (p.id === 'qg') {
      socle(ctx, z, C.violet, true)
      const dossiers = c.offre?.uniques.length ?? 0
      rect(ctx, z.x + z.w / 2 - 1, z.y + 12, 2, z.h * 0.4, ton(C.faible, 0.1))
      if (dossiers > 0) {
        const souffle = 0.4 + 0.3 * Math.sin(t * 2)
        lueur(ctx, z.x + z.w / 2 - 8, z.y + 10, 16, 10, C.violet, 2, souffle)
        rect(ctx, z.x + z.w / 2, z.y + 12, 12, 8, C.violet)
      }
    } else if (p.id === 'caserne') {
      const n = Math.min(3, 1 + V.niveauBat(c, 'caserne'))
      socle(ctx, z, C.accent, true)
      marcheurs(ctx, z, n, t, 0.14, C.accent)
    } else if (p.id === 'campement') {
      const n = Math.min(4, aligne.length)
      socle(ctx, z, C.cyan, true)
      if (n) {
        const flamme = 0.5 + 0.5 * Math.sin(t * 3)
        lueur(ctx, z.x + z.w / 2 - 4, z.y + z.h - 26, 8, 8, C.accent, 2, flamme)
        marcheurs(ctx, z, n, t, 0.1, C.cyan)
      }
    } else if (p.id === 'porte') {
      const w = 8
      const h = z.h * 0.55
      const y = z.y + z.h - h
      bloc(ctx, z.x + 12, y, w, h, ton(C.bord, -0.1), 2)
      bloc(ctx, z.x + z.w - 12 - w, y, w, h, ton(C.bord, -0.1), 2)
      bloc(ctx, z.x + 12, y - 8, z.w - 24, 8, ton(C.bord, -0.1), 2)
      centre(ctx, p.nom, z.x + z.w / 2, z.y + z.h - 6, 8, C.faible, z.w - 8)
      const offres = c.plan?.length ?? 0
      if (offres) {
        const souffle = 0.35 + 0.35 * Math.sin(t * 1.6)
        lueur(ctx, z.x + z.w / 2 - w, y - 10, w * 2, h + 18, C.accent, 3, souffle)
      }
    } else if (p.id === 'infirmerie') {
      const construit = V.niveauBat(c, 'infirmerie') > 0
      socle(ctx, z, C.vert, construit)
      if (construit) pastille(ctx, z.x + z.w / 2, z.y + z.h - Math.round(z.h * 0.4) - 4, 3, C.vert)
      if (blesses > 0) marcheurs(ctx, z, 1, t, 0.09, C.vert)
    } else if (p.id === 'taverne') {
      const niveau = V.niveauBat(c, 'taverne')
      socle(ctx, z, C.accent, niveau > 0)
      const h = Math.round(z.h * 0.4)
      const y = z.y + z.h - h
      const allumees = niveau > 0 && nuit
      for (let f = 0; f < 3; f++) {
        const fx = z.x + 12 + f * ((z.w - 24) / 2)
        if (allumees) lueur(ctx, fx, y + 6, 6, 6, C.accent, 2, 0.7)
        rect(ctx, fx, y + 6, 6, 6, allumees ? C.accent : ton(C.panneau, -0.4))
      }
    } else if (p.id === 'grenier') {
      const niveau = V.niveauBat(c, 'grenier')
      const hSilo = 14 + niveau * 12
      const y = z.y + z.h - hSilo - 10
      bloc(ctx, z.x + z.w / 2 - 14, y, 28, hSilo, niveau > 0 ? C.accent : ton(C.bord, -0.2), 2)
      centre(ctx, p.nom, z.x + z.w / 2, z.y + z.h - 6, 8, C.faible, z.w - 8)
    } else if (p.id === 'echoppes') {
      const marche = V.niveauBat(c, 'marche') > 0
      const forge = V.niveauBat(c, 'forge') > 0
      socle(ctx, z, C.cyan, marche || forge)
      if (forge) {
        for (let k = 0; k < 3; k++) {
          const s = (t * 0.4 + k * 0.33) % 1
          ctx.globalAlpha = 1 - s
          rect(ctx, z.x + z.w / 2 - 2, z.y + z.h - 30 - s * 20, 3, 3, ton(C.accent, s * 0.5))
          ctx.globalAlpha = 1
        }
      } else if (!marche) {
        centre(ctx, 'TERRAIN VAGUE', z.x + z.w / 2, z.y + z.h / 2, 8, C.bord, z.w - 10)
      }
    }
  })

  const r = d.resume
  texte(
    ctx,
    `${aligne.length}/${Cie.places(c.niveau)} EN LIGNE`,
    r.x,
    r.y,
    11,
    aligne.length ? C.vert : C.rouge,
    700,
    r.w,
  )
  if (c.dernier) {
    // Le carnet de guerre, quand ce dernier engagement a laissé une ligne à
    // raconter — sinon le résumé nu, comme avant lui.
    const recit = c.dernier.carnet ?? `${c.dernier.gagne ? 'VICTOIRE' : 'REVERS'} · ${c.dernier.titre ?? ''}`
    texte(ctx, `DERNIER : ${recit}`, r.x, r.y + 16, 10, c.dernier.gagne ? C.vert : C.rouge, 700, r.w)
  }
  if (!aligne.length) texte(ctx, 'AUCUNE TROUPE EN LIGNE — VOIR LE CAMPEMENT', r.x, r.y + 32, 10, C.rouge, 700, r.w)

  bourse(ctx, c, D.bourse(j))
  return zones
}
