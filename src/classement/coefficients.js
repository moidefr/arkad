/**
 * Ce qui rend deux jeux comparables.
 *
 * Un point de PAIRES et un point de CARAVANE ne valent pas la même chose :
 * l'un se gagne trente fois par partie, l'autre se compte en dizaines de
 * milliers. Un classement général qui additionnerait les scores bruts
 * couronnerait celui qui a joué à CARAVANE, pas le meilleur joueur.
 *
 * Alors on ne compare pas des scores, on compare des **fractions de
 * référence**. Chaque jeu déclare le score d'un très bon joueur ; l'atteindre
 * vaut 1000 points, quel que soit le jeu. Une pondération par catégorie
 * corrige ce que la référence ne dit pas : une partie de MOYEN demande dix
 * minutes, une partie de COURT en demande deux, et une partie de LONG peut en
 * demander dix heures.
 *
 *     points = ponderation × 1000 × min(score / reference, PLAFOND)
 *
 * Le plafond existe pour que le général reste un classement de joueur et non
 * de record isolé : un score dix fois au-dessus de la référence ne rapporte
 * pas dix fois plus que la référence. Le classement **par jeu**, lui, ne
 * connaît pas ces points — il trie sur le score brut, celui que le joueur a
 * sous les yeux pendant sa partie.
 *
 * Ce fichier est la seule source de vérité : `supabase/schema.sql` en recopie
 * les valeurs pour les recalculer côté serveur (un client ne se croit pas sur
 * parole), et un test vérifie que les deux ne divergent jamais.
 */

/** Atteindre la référence d'un jeu vaut ça, avant pondération. */
export const BASE = 1000

/** Au-delà, un score de plus ne rapporte plus rien au général. */
export const PLAFOND = 2.5

/**
 * Ce que vaut une partie, catégorie par catégorie. C'est du temps de joueur :
 * une grille de MOYEN coûte dix minutes, une partie de COURT deux, et une
 * partie de LONG s'étale sur des jours.
 */
export const PONDERATIONS = {
  court: 1,
  moyen: 1.4,
  long: 2,
  massif: 2,
}

/**
 * Le score d'un très bon joueur, jeu par jeu — pas un record du monde, pas une
 * moyenne : ce qu'on atteint quand on sait vraiment y jouer.
 *
 * Les jeux `sansScore` (USINE, RUÉE, COLONIE, GRIMOIRE, REMPART, FRONT)
 * n'apparaissent pas : ils ne produisent aucun nombre à classer, et leur en
 * inventer un serait mentir sur ce qu'ils sont.
 */
export const REFERENCES = {
  // COURT — deux à trois minutes, une seule touche.
  esquive: 600,
  voltige: 700,
  grimpe: 400,
  slalom: 60,
  fusee: 1500,
  'casse-brique': 3000,
  serpent: 300,
  orbite: 400,
  balance: 900,
  pile: 40,
  corde: 120,
  cibles: 800,
  rythme: 900,
  gardien: 40,
  tri: 500,
  memoire: 400,
  couleur: 600,
  calcul: 500,
  visee: 60,
  geste: 60,
  trace: 400,
  eclair: 40,
  paires: 30,
  dedale: 25,

  // MOYEN — une grille, une solution.
  demineur: 12000,
  mille: 20000,
  taquin: 2200,
  picross: 3000,
  sudoku: 3200,
  lumieres: 1600,
  code: 2000,
  solitaire: 1000,
  flux: 3000,

  // LONG — ça continue quand on ferme.
  expedition: 4000,
  breche: 2000,
  abyme: 60,
  caravane: 20000,
  vivier: 40,
}

/** Vrai si ce jeu peut figurer à un classement. */
export function classable(def) {
  return !def?.sansScore && REFERENCES[def?.id] !== undefined
}

/**
 * Les points que vaut ce score à ce jeu. `0` si le jeu n'est pas classable —
 * on ne devine pas une référence absente, on refuse de compter.
 */
export function points(id, score, categorie) {
  const reference = REFERENCES[id]
  if (!reference || !(score > 0)) return 0
  const ponderation = PONDERATIONS[categorie] ?? 1
  return Math.round(ponderation * BASE * Math.min(score / reference, PLAFOND))
}

/**
 * Combien de jeux comptent au général.
 *
 * Additionner les points de trente-quatre jeux ferait du général un classement
 * d'assiduité : celui qui a tout essayé battrait celui qui joue mieux. N'en
 * garder que cinq laisse le choix — cinq jeux tenus à fond, ou trente joués
 * assez bien pour que les cinq meilleurs pèsent.
 */
export const RETENUS = 5

/** Le total général d'un joueur, à partir de ses points jeu par jeu. */
export function general(pointsParJeu) {
  return [...pointsParJeu]
    .sort((a, b) => b - a)
    .slice(0, RETENUS)
    .reduce((t, p) => t + p, 0)
}
