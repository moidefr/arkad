import { C } from '../../../palette.js'

/**
 * Les états.
 *
 * **Règle d'admission, non négociable** : un état est soit *(a)* un nombre que
 * la formule de dégâts consomme, soit *(b)* un drapeau que la boucle de tour
 * lit. S'il demande du code particulier à plus de deux endroits, il est
 * refusé. C'est cette règle, et elle seule, qui empêche le moteur de combat de
 * devenir une collection de cas particuliers.
 *
 * **Chaque état a un plafond.** Le réappliquer rafraîchit jusqu'au plafond, il
 * ne s'additionne jamais au-delà. C'est ce qui tue la plupart des exploits
 * d'empilement, et un test vérifie qu'aucun état n'existe sans plafond.
 *
 * `duree` dit si les piles sont une quantité (un pare-feu de 20 points) ou un
 * nombre de tours (trois tours de lenteur). `camp` dit sur qui l'état a un
 * sens, pour que le tirage des compétences ne pose pas un pare-feu sur un
 * ennemi.
 */
export const ETATS = [
  // --- Sur les opérateurs -----------------------------------------------------
  {
    id: 'pare',
    nom: 'PARE-FEU',
    glyphe: '⌸',
    couleur: C.cyan,
    camp: 'ami',
    duree: false,
    plafond: 40,
    dit: 'absorbe les dégâts avant l’intégrité',
  },
  {
    id: 'surcadence',
    nom: 'SURCADENCE',
    glyphe: '»',
    couleur: C.accent,
    camp: 'ami',
    duree: true,
    plafond: 3,
    dit: 'joue plus souvent',
  },
  {
    id: 'regenere',
    nom: 'RÉGÉNÈRE',
    glyphe: '+',
    couleur: C.vert,
    camp: 'ami',
    duree: true,
    plafond: 4,
    dit: 'récupère de l’intégrité à chaque tour',
  },
  {
    id: 'cache',
    nom: 'CACHE',
    glyphe: '○',
    couleur: C.cyan,
    camp: 'ami',
    duree: true,
    plafond: 2,
    dit: 'la prochaine attaque le rate',
  },
  {
    id: 'priorite',
    nom: 'PRIORITÉ',
    glyphe: '!',
    couleur: C.accent,
    camp: 'ami',
    duree: true,
    plafond: 1,
    dit: 'la prochaine action ne coûte pas de tempo',
  },

  // --- Sur les processus ------------------------------------------------------
  {
    id: 'fuite',
    nom: 'FUITE',
    glyphe: '≈',
    couleur: C.violet,
    camp: 'adverse',
    duree: false,
    plafond: 12,
    dit: 'perd des points en fin de tour, rien ne l’arrête',
  },
  {
    id: 'marque',
    nom: 'MARQUE',
    glyphe: '×',
    couleur: C.rouge,
    camp: 'adverse',
    // Une quantité, pas une durée : les marques s'accumulent jusqu'à trois et
    // ne s'effacent que consommées par un finisseur. C'est ce qui en fait une
    // monnaie de combo plutôt qu'un compte à rebours.
    duree: false,
    plafond: 3,
    dit: 'encaisse 20 % de plus par pile, jusqu’à trois',
  },
  {
    id: 'latence',
    nom: 'LATENCE',
    glyphe: '«',
    couleur: C.cyan,
    camp: 'adverse',
    duree: true,
    plafond: 3,
    dit: 'joue moins souvent',
  },
  {
    id: 'fragment',
    nom: 'FRAGMENT',
    glyphe: '/',
    couleur: C.accent,
    camp: 'adverse',
    duree: false,
    plafond: 4,
    dit: 'perd 2 de blindage par pile, jusqu’à quatre',
  },
  {
    id: 'silence',
    nom: 'SILENCE',
    glyphe: '−',
    couleur: C.faible,
    camp: 'adverse',
    duree: true,
    plafond: 2,
    dit: 'ne peut plus lancer que sa frappe de base',
  },
]

export const ETAT = Object.fromEntries(ETATS.map((e) => [e.id, e]))
