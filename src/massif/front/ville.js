/**
 * LA VILLE — l'horloge, les vivres, le moral et les bâtiments.
 *
 * Aucun dessin, aucun stockage : tout est ici pour que le banc puisse faire
 * vivre une compagnie sur deux cents jours sans ouvrir un navigateur. C'est
 * indispensable, parce que ce fichier est une **économie**, et qu'une économie
 * ne se règle pas à la lecture.
 *
 * ## Ce que l'horloge rend possible
 *
 * Le jeu n'avait pas de temps : on enchaînait les batailles, et rester au camp
 * ne coûtait rien. Un lieu où l'on dort, où l'on soigne et où l'on s'entraîne
 * n'a de sens que si **attendre a un prix**. Deux prix, exactement :
 *
 *   - **les vivres**, chaque jour, pour chaque bouche. Elles se paient en or,
 *     directement, sans stock à gérer : un grenier à remplir serait une
 *     couche d'intendance que personne n'a demandée, et le premier essai
 *     affamait la compagnie au cinquième jour. Ce qui doit pousser au front,
 *     c'est que **les jours coûtent de l'or et que l'or vient des batailles** —
 *     pas qu'on ait oublié d'acheter du pain ;
 *   - **la réputation**, au-delà d'un mois sans combattre. Une compagnie qu'on
 *     n'a pas vue depuis trente jours cesse d'être demandée. La perte est
 *     minuscule et progressive : ce n'est pas une punition, c'est un courant
 *     qui pousse vers le front.
 *
 * ## Le moral, des deux côtés
 *
 * `c.moral` est une jauge de compagnie qui vit entre les batailles : la taverne
 * la monte, la faim la descend, une défaite l'entame, une victoire la remonte.
 * Et elle **entre en bataille** — chaque troupe démarre avec un bonus ou un
 * malus tiré d'elle. Les deux usages sont le même nombre, ce qui évite d'avoir
 * à expliquer pourquoi il y en a deux.
 */
import * as U from './unites.js'
import { CL, TYPES } from './donnees/classes.js'

export const MORAL_MAX = 100
export const MORAL_DEPART = 70

/** Au-delà, la compagnie est oubliée et sa réputation s'effrite. */
export const JOURS_AVANT_OUBLI = 30

/**
 * Les bâtiments. Chacun a trois niveaux, et **fait une seule chose** — un
 * bâtiment qui en ferait deux serait impossible à évaluer d'un coup d'œil.
 *
 * `cout(n)` est le prix pour passer du niveau n au suivant.
 */
export const BATIMENTS = [
  {
    id: 'caserne',
    nom: 'CASERNE',
    quoi: 'Entraîne. Les troupes en réserve progressent chaque jour.',
    rang: 1,
    cout: (n) => Math.round(280 * Math.pow(2.4, n)),
  },
  {
    id: 'infirmerie',
    nom: 'INFIRMERIE',
    quoi: 'Soigne les blessés, un peu chaque jour, sans rien coûter.',
    rang: 2,
    cout: (n) => Math.round(240 * Math.pow(2.3, n)),
  },
  {
    id: 'taverne',
    nom: 'TAVERNE',
    quoi: 'Remonte le moral de la compagnie.',
    rang: 3,
    cout: (n) => Math.round(200 * Math.pow(2.2, n)),
  },
  {
    id: 'grenier',
    nom: 'GRENIER',
    quoi: 'Des vivres moins chers : chaque niveau retire un septième au coût du jour.',
    rang: 4,
    cout: (n) => Math.round(180 * Math.pow(2.1, n)),
  },
  {
    id: 'fortifications',
    nom: 'FORTIFICATIONS',
    quoi: 'La compagnie part chaque bataille mieux défendue.',
    rang: 2,
    cout: (n) => Math.round(220 * Math.pow(2.3, n)),
  },
  {
    id: 'marche',
    nom: 'MARCHÉ',
    quoi: 'Un étal d’objets à l’achat, renouvelé à chaque engagement.',
    rang: 3,
    cout: (n) => Math.round(260 * Math.pow(2.3, n)),
  },
  {
    id: 'guet',
    nom: 'POSTE DE GUET',
    quoi: 'Un engagement de plus proposé, et son penchant connu d’avance.',
    rang: 4,
    cout: (n) => Math.round(300 * Math.pow(2.3, n)),
  },
  {
    id: 'forge',
    nom: 'FORGE',
    quoi: 'Améliore un objet équipé, contre or. Demande un marché.',
    rang: 5,
    cout: (n) => Math.round(320 * Math.pow(2.4, n)),
  },
  {
    id: 'entrainement',
    nom: "TERRAIN D'ENTRAÎNEMENT",
    quoi: 'Choisit un type de troupe : sa réserve progresse plus vite. Demande une caserne aguerrie.',
    rang: 6,
    cout: (n) => Math.round(360 * Math.pow(2.4, n)),
  },
]

export const BAT = Object.fromEntries(BATIMENTS.map((b) => [b.id, b]))
export const NIVEAU_MAX = 3

/**
 * Deux bâtiments neufs demandent qu'un autre soit déjà construit à un
 * certain niveau — la forge n'a rien à vendre sans marché pour l'alimenter,
 * et le terrain d'entraînement double le travail d'une caserne qui n'existe
 * pas encore vraiment. Première fois que `constructible()` lit un prérequis.
 */
export const PREREQUIS = { forge: [['marche', 1]], entrainement: [['caserne', 2]] }

/** Le niveau d'un bâtiment. Zéro veut dire : pas encore construit. */
export const niveauBat = (c, id) => c.ville?.bat?.[id] ?? 0

/** Un bâtiment est constructible quand la compagnie a le rang, l'or, et ses prérequis. */
export const constructible = (c, id) => {
  const b = BAT[id]
  if (!b || c.niveau < b.rang) return false
  if ((PREREQUIS[id] ?? []).some(([bid, niv]) => niveauBat(c, bid) < niv)) return false
  const n = niveauBat(c, id)
  return n < NIVEAU_MAX && c.or >= b.cout(n)
}

export function construit(c, id) {
  if (!constructible(c, id)) return false
  const n = niveauBat(c, id)
  c.or -= BAT[id].cout(n)
  c.ville.bat[id] = n + 1
  return true
}

// --- Les vivres --------------------------------------------------------------------

/** Une bouche par troupe, plus une pour l'état-major. */
export const besoinVivres = (c) => c.troupes.length + 1

/**
 * Ce que coûte une journée. Volontairement petit : à douze troupes et au
 * niveau 10, une semaine au chaud coûte environ ce que rapporte un quart de
 * bataille. On sent passer un mois de flânerie, pas trois jours de soins.
 *
 * Le grenier ne donne jamais les vivres : il les rend moins chères, d'un
 * septième par niveau.
 */
export const coutJour = (c) =>
  Math.max(1, Math.round(besoinVivres(c) * 1.6 * U.echelle(c.niveau) * (1 - niveauBat(c, 'grenier') * 0.15)))

/** Combien de jours on peut tenir avec l'or qu'on a. */
export const joursTenables = (c) => Math.floor(c.or / Math.max(1, coutJour(c)))

// --- Le jour qui passe ---------------------------------------------------------------

/**
 * Un jour. C'est **le seul endroit** où le temps avance, et tout ce que fait la
 * ville en découle : nourrir, soigner, entraîner, boire, oublier.
 *
 * Rend le journal de la journée, pour que l'écran raconte ce qui s'est passé
 * au lieu d'afficher des compteurs qui ont bougé tout seuls.
 */
export function passeJour(c) {
  const v = c.ville
  v.jour++
  const bilan = { jour: v.jour, mange: false, soignes: 0, entraines: 0, moral: 0, renom: 0 }

  // --- Nourrir. On paie, ou la compagnie serre la ceinture — et ça se voit au
  //     moral avant de se voir ailleurs. La perte reste douce : une caisse vide
  //     est déjà une punition suffisante.
  const prix = coutJour(c)
  if (c.or >= prix) {
    c.or -= prix
    bilan.mange = true
    bilan.paye = prix
    v.faim = 0
  } else {
    v.faim = (v.faim ?? 0) + 1
    bilan.moral -= Math.min(6, 1 + v.faim)
  }

  // --- L'infirmerie. Elle rend un peu de vie chaque jour, gratuitement : c'est
  //     la contrepartie du temps qu'on passe ici plutôt qu'au front.
  const inf = niveauBat(c, 'infirmerie')
  if (inf > 0 && bilan.mange) {
    for (const u of c.troupes) {
      const max = U.fiche(u).pvMax
      if (u.pv >= max) continue
      u.pv = Math.min(max, u.pv + Math.max(1, Math.round(max * 0.06 * inf)))
      if (u.pv >= max) u.blesse = 0
      bilan.soignes++
    }
  }

  // --- La caserne. Elle entraîne **ceux qui ne sont pas alignés**.
  //
  //     C'est la réponse à une réserve qui ne servait à rien : une troupe
  //     laissée au dépôt dormait, donc la garder était une pure perte. Elle
  //     progresse maintenant — lentement, et seulement si elle a mangé.
  //
  //     Le terrain d'entraînement ne remplace rien : il ajoute un accent sur
  //     un type choisi, par-dessus le goutte-à-goutte de la caserne — jamais
  //     l'inverse, sinon il faudrait expliquer deux courbes de progression
  //     au lieu d'une.
  const cas = niveauBat(c, 'caserne')
  const foc = focusEntrainement(c)
  if (cas > 0 && bilan.mange) {
    for (const u of reserve(c)) {
      const avant = u.niv
      const accent = foc && CL[u.cl].type === foc ? 1 + 0.3 * niveauBat(c, 'entrainement') : 1
      U.gagneXp(u, 6 * cas * accent, c.niveau)
      if (u.niv > avant) bilan.entraines++
    }
  }

  // --- La taverne. Elle remonte le moral, jusqu'à un plafond qu'elle fixe.
  const tav = niveauBat(c, 'taverne')
  if (tav > 0 && bilan.mange) bilan.moral += 2 * tav

  // --- L'oubli. Au-delà d'un mois sans combattre, la compagnie n'est plus
  //     demandée. Un dixième de point par jour : on ne s'en aperçoit pas en une
  //     semaine, on s'en aperçoit en une saison.
  const depuis = v.jour - (v.dernierCombat ?? 0)
  if (depuis > JOURS_AVANT_OUBLI && c.renom > 0) {
    bilan.renom = -Math.max(1, Math.round(c.renom * 0.01))
    c.renom = Math.max(0, c.renom + bilan.renom)
  }

  ajusteMoral(c, bilan.moral)
  v.journal = (v.journal ?? []).concat(bilan).slice(-30)
  return bilan
}

/** Plusieurs jours d'affilée. Rend le cumul, pas la liste. */
export function passeJours(c, n) {
  const total = { jours: 0, soignes: 0, entraines: 0, moral: 0, renom: 0, jeune: 0 }
  for (let i = 0; i < n; i++) {
    const b = passeJour(c)
    total.jours++
    total.soignes += b.soignes
    total.entraines += b.entraines
    total.moral += b.moral
    total.renom += b.renom
    if (!b.mange) total.jeune++
  }
  return total
}

export const reserve = (c) => c.troupes.filter((u) => !c.escouades.some((e) => e.membres.includes(u.id)))

export function ajusteMoral(c, delta) {
  c.ville.moral = Math.max(0, Math.min(MORAL_MAX, (c.ville.moral ?? MORAL_DEPART) + delta))
  return c.ville.moral
}

/**
 * Ce que le moral vaut en bataille : de −8 à +10 points de moral de départ,
 * pour chaque troupe engagée.
 *
 * L'échelle est volontairement courte. Le moral doit se sentir sans décider :
 * une compagnie démoralisée part avec un handicap, elle ne part pas battue —
 * sinon la seule décision du jeu devient « aller à la taverne ».
 */
export const bonusMoral = (c) => Math.round((((c.ville?.moral ?? MORAL_DEPART) - 55) / 45) * 10)

/**
 * Ce que les fortifications valent en bataille : un bonus de défense posé
 * une fois pour toute la troupe engagée, en fraction — la même mécanique
 * qu'un ordre « SE RETRANCHER », sauf qu'elle ne coûte ni tour ni recharge.
 * Chaque niveau vaut 5 % ; trois niveaux plafonnent à 15 %, l'échelle d'un
 * ordre de mêlée ordinaire.
 */
export const bonusDefense = (c) => niveauBat(c, 'fortifications') * 0.05

// --- Le terrain d'entraînement --------------------------------------------------

/** Le type sur lequel le terrain d'entraînement est réglé, ou `null` : aucun accent choisi. */
export const focusEntrainement = (c) => c.ville?.focus ?? null

/** Choisit l'accent. Refusé sans le bâtiment, ou pour un type qui n'existe pas. */
export function choisisFocus(c, type) {
  if (niveauBat(c, 'entrainement') <= 0 || !TYPES.some((t) => t.id === type)) return false
  c.ville.focus = type
  return true
}

// --- Les sessions d'entraînement --------------------------------------------------

/**
 * Une session : plusieurs jours d'un coup, de l'or, et de l'expérience pour
 * **toute** la compagnie — alignés compris. C'est ce que la caserne apporte
 * au-delà de son goutte-à-goutte quotidien.
 */
export const SESSIONS = [
  { id: 'exercice', nom: 'EXERCICE', jours: 2, xp: 40, prix: 60 },
  { id: 'manoeuvres', nom: 'MANŒUVRES', jours: 5, xp: 120, prix: 180, rang: 2 },
  { id: 'campagne', nom: 'GRANDES MANŒUVRES', jours: 12, xp: 340, prix: 520, rang: 3 },
]

export const sessionOuverte = (c, s) => niveauBat(c, 'caserne') >= (s.rang ?? 1)

export function entraine(c, sessionId) {
  const s = SESSIONS.find((x) => x.id === sessionId)
  if (!s || !sessionOuverte(c, s) || c.or < s.prix) return null
  // De quoi nourrir tout le monde jusqu'au bout **avant** de partir : se
  // retrouver à jeun au quatrième jour de manœuvres est une punition qu'on n'a
  // pas choisie, puisqu'on ne décide plus rien une fois parti.
  if (c.or < s.prix + coutJour(c) * s.jours) return null
  c.or -= s.prix
  const avant = c.troupes.map((u) => u.niv)
  for (const u of c.troupes) U.gagneXp(u, s.xp, c.niveau)
  const bilan = passeJours(c, s.jours)
  bilan.montees = c.troupes.filter((u, i) => u.niv > avant[i]).length
  bilan.session = s
  return bilan
}

// --- État neuf et relecture ----------------------------------------------------------

export const villeNeuve = () => ({
  jour: 1,
  faim: 0,
  moral: MORAL_DEPART,
  dernierCombat: 1,
  bat: {},
  journal: [],
})

/** Une sauvegarde d'avant la ville n'en a pas : on lui en donne une neuve. */
export function cale(c) {
  c.ville = { ...villeNeuve(), ...(c.ville ?? {}) }
  c.ville.bat ??= {}
  c.ville.journal ??= []
  return c.ville
}
