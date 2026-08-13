/**
 * L'armée d'en face.
 *
 * Elle est bâtie sur un budget, pas sur une liste : on donne des points, on
 * achète des troupes tant qu'il en reste, on nomme un gradé. C'est ce qui
 * fait qu'une bataille de niveau 3 et une bataille de niveau 15 sortent du
 * même code, avec plus de monde et de meilleures troupes.
 */
import { melange32, derive, entre, pondere } from './rng.js'
import { CLASSES, CL, GRADES } from './donnees/classes.js'
import { UNIQUES } from './donnees/uniques.js'
import { creeGenerique, creeUnique, NOMS, INITIALES, fiche } from './unites.js'

/** Les noms d'unité adverse : une compagnie ennemie a aussi une identité. */
export const BANNIERES = [
  'LA COMPAGNIE NOIRE',
  'LES FRANCS DE VALCROS',
  'LA BANDE DU GUÉ',
  'LES ROUTIERS GRIS',
  'LA GARNISON DE PEYRE',
  'LES PIQUES DE MALRIC',
  'LA HORDE DE SAHUC',
  'LES CENDRES DE LAUTREC',
  'LA COLONNE DE FER',
  'LES CHIENS DE CAUSSE',
  'LA LEVÉE DES BORDES',
  'LES FILS DU ROC',
  'LA MEUTE D’ARNAUT',
  'LES LANCES DE VABRE',
  'LA MAIN ROUGE',
  'LES BOUCLIERS DE PONS',
]

/** Ce que « vaut » une troupe pour le budget adverse : sa fiche, pas son prix. */
export const valeur = (u) => {
  const f = fiche(u)
  return Math.round(f.pvMax * 0.9 + f.att * 4 + f.def * 2.5 + f.mvt * 2 + f.portee[1] * 5)
}

/**
 * Le budget d'un engagement se mesure sur **la compagnie qu'on aligne**, pas
 * sur une courbe fixe. Dans un jeu à troupes persistantes, une courbe fixe
 * punit deux fois celui qui vient de perdre ses vétérans et endort celui qui
 * les a gardés. Ici, la difficulté annoncée sur l'écran de campagne est le
 * rapport de forces réel — et c'est elle qui fixe la récompense.
 */
export const budgetDe = (forceAlliee, difficulte = 1) => Math.max(90, Math.round(forceAlliee * difficulte))

export const forceDe = (troupes) => troupes.reduce((s, u) => s + valeur(u), 0)

/**
 * Compose une armée. `penchant` pousse vers un type dominant : une bande de
 * cavalerie ne se joue pas comme une ligne d'arbalétriers, et c'est ce qui
 * rend le choix de l'engagement intéressant sur l'écran de campagne.
 */
export function armee(graine, niveau, budget, penchant = null, combien = null) {
  const rng = melange32(derive(graine, 401, niveau, Math.round(budget)))
  const dispo = CLASSES.filter((c) => c.rang <= niveau + 1)
  const max = combien ?? Math.min(14, 3 + Math.floor(niveau * 0.7))

  const troupes = []
  let reste = budget
  for (let i = 0; i < max; i++) {
    const cl = pondere(rng, dispo, (c) => {
      const nivC = Math.max(1, niveau + entre(rng, -1, 1))
      const u = creeGenerique(c.id, nivC)
      if (valeur(u) > reste) return 0
      // Une classe récente pèse plus lourd dans le sac : l'ennemi progresse.
      const fraicheur = 1 + c.rang / Math.max(1, niveau)
      return (penchant && c.type === penchant ? 3 : 1) * fraicheur
    })
    if (!cl) break
    const nivU = Math.max(1, niveau + entre(rng, -1, 1))
    const u = creeGenerique(
      cl.id,
      nivU,
      NOMS[Math.floor(rng() * NOMS.length)],
      INITIALES[Math.floor(rng() * INITIALES.length)],
    )
    if (valeur(u) > reste) break
    reste -= valeur(u)
    troupes.push(u)
  }

  if (!troupes.length) troupes.push(creeGenerique(dispo[0].id, Math.max(1, niveau)))

  // Un officier : le plus solide de la bande monte en grade. C'est lui que
  // vise l'objectif DÉCAPITER, et c'est son aura qui tient la ligne adverse.
  const chef = troupes.reduce((a, b) => (valeur(b) > valeur(a) ? b : a))
  const grade = Math.min(4, 1 + Math.floor(niveau / 6))
  chef.grade = grade
  chef.pv = fiche(chef).pvMax
  return troupes
}

/**
 * À partir du huitième engagement, l'ennemi peut aligner un unique. C'est le
 * même vivier que l'état-major du joueur : on croise ceux qu'on n'a pas
 * recrutés, et les battre les remet dans le sac.
 */
export function championAdverse(graine, niveau, exclus = []) {
  if (niveau < 6) return null
  const rng = melange32(derive(graine, 733, niveau))
  const bassin = UNIQUES.filter((u) => u.rang <= niveau && !exclus.includes(u.id))
  const choisi = pondere(rng, bassin, (u) => (u.rarete >= 3 ? 2 : 1))
  if (!choisi) return null
  return creeUnique(choisi.id, Math.max(choisi.rang, niveau))
}

export { CL }
