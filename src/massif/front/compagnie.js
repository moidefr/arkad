/**
 * La compagnie — ce qui survit d'une bataille à l'autre.
 *
 * C'est le cœur du jeu : les troupes sont **persistantes**. Le milicien du
 * premier engagement peut finir lieutenant vingt batailles plus tard, avec ses
 * cicatrices et son nom. Une troupe abandonnée sur un champ perdu ne revient
 * pas.
 *
 * Deux recrutements coexistent, et ils ne se ressemblent pas :
 *   — la **CASERNE**, générique, où l'on achète une classe au prix du niveau ;
 *   — l'**ÉTAT-MAJOR**, où passent des gens qui ont un nom, un titre et un
 *     grade, tirés selon un taux d'apparition indexé sur le niveau.
 */
import { melange32, derive, entre, parmi, melange, pondere } from './rng.js'
import { CLASSES, CL, GRADES } from './donnees/classes.js'
import { UNIQUES, UQ, RAR } from './donnees/uniques.js'
import { APT } from './donnees/aptitudes.js'
import { OBJETS, OBJ as OBJET, TIER_MAX, prixObjet, prixAmelioration } from './donnees/objets.js'
import { BIOMES } from './terrain.js'
import * as U from './unites.js'
import * as V from './ville.js'
import * as A from './adversaire.js'
import * as B from './bataille.js'
import { genereCarte, zoneDeploiement, pointsCapture, placeLibre, OBJECTIFS, OBJ, biomePour } from './carte.js'
import { cle } from './hex.js'

export const VERSION = 1

/** Les places sur le champ : c'est le vrai plafond, pas la taille du dépôt. */
export const places = (n) => Math.min(12, 3 + Math.floor(n * 0.6))
export const escouadesMax = (n) => Math.min(3, 1 + Math.floor(n / 6))
export const tailleEscouade = (n) => Math.ceil(places(n) / escouadesMax(n))
/** Le dépôt, lui, est plus large que le champ : on garde des remplaçants. */
export const depotMax = (n) => places(n) + 8

/**
 * Le renom qu'il faut pour passer au niveau suivant.
 *
 * **Le terme carré n'est pas décoratif.** Avec un seuil linéaire (16 + 6n) et
 * une prime de victoire elle aussi linéaire (18 + 4n), le rapport tendait vers
 * deux niveaux pour trois victoires — indéfiniment. Le niveau de la compagnie
 * prenait donc une avance qui ne cessait jamais de croître : mesuré au banc,
 * **cinq rangs** devant la troupe moyenne au vingt-huitième engagement. Or
 * c'est le niveau global qui commande la taille des cartes, le budget adverse
 * et ce qu'on trouve en boutique : le jeu se durcissait plus vite que la
 * compagnie ne s'aguerrissait, et le rythme des troupes — qui, lui, est bon —
 * n'y pouvait rien.
 *
 * Le début reste vif : une victoire par niveau les premiers rangs. C'est
 * ensuite que la courbe rattrape la prime au lieu de la fuir.
 */
export const seuilRenom = (n) => Math.round(14 + 5 * n + 0.75 * n * n)

// --- Création et sauvegarde ------------------------------------------------------

export function nouvelle(graine) {
  const rng = melange32(derive(graine, 1))
  // La première escouade est **fixe** : une pique, un arc, un éclaireur. Tirée
  // au hasard, elle pouvait sortir trois infirmiers — et on perdait la
  // première bataille sans avoir rien compris.
  const depart = [CL.piquier, CL.archer, CL.eclaireur]
  const c = {
    v: VERSION,
    graine,
    niveau: 1,
    renom: 0,
    or: 220,
    engagements: 0,
    victoires: 0,
    pertes: 0,
    serie: 0,
    troupes: depart.map((cl) => U.creeGenerique(cl.id, 1, parmi(rng, U.NOMS), parmi(rng, U.INITIALES))),
    escouades: [],
    uniquesVus: [],
    offre: null,
    plan: null,
    choix: null,
    dernier: null,
    ville: V.villeNeuve(),
    objets: [],
    historique: {},
  }
  c.troupes.forEach((u) => enregistreRecrue(c, u.cl))
  c.escouades = [{ nom: 'PREMIÈRE', chef: c.troupes[0].id, membres: c.troupes.map((t) => t.id) }]
  rafraichit(c)
  planifie(c)
  return c
}

/**
 * Le compteur cosmétique par classe — « 12 GARDES, 4 TOMBÉS ». Aucune
 * décision de plus, pure présentation : combien la compagnie en a levé
 * depuis le début, combien ne sont pas rentrés.
 */
function enregistreRecrue(c, clId) {
  c.historique ??= {}
  const h = (c.historique[clId] ??= { recrutees: 0, tombees: 0 })
  h.recrutees++
}
function enregistreTombee(c, clId) {
  c.historique ??= {}
  const h = (c.historique[clId] ??= { recrutees: 0, tombees: 0 })
  h.tombees++
}

export const sauvegarde = (c, bat) => ({ v: VERSION, c, bat: bat ?? null })

/**
 * Relecture. Une sauvegarde d'une version inconnue est refusée franchement —
 * mieux vaut repartir que jouer sur un état à moitié compris.
 */
export function migre(brut) {
  if (!brut || brut.v !== VERSION || !brut.c?.troupes) return null
  const c = brut.c
  U.cale(c.troupes)
  V.cale(c)
  c.escouades ??= []
  c.uniquesVus ??= []
  c.objets ??= []
  c.serie ??= 0
  for (const u of c.troupes) {
    u.equip ??= U.equipVide()
    u.cicatrices ??= []
    u.ramasse ??= 0
  }
  // Une sauvegarde d'avant le carnet n'a pas d'historique : on le repart du
  // vivant plutôt que de mentir avec des zéros — les tombés d'avant restent
  // hors de portée, mais « 3 GARDES » vaut mieux que « 0 GARDES » pour une
  // compagnie qui en a trois sous les armes.
  if (!c.historique) {
    c.historique = {}
    for (const u of c.troupes) enregistreRecrue(c, u.cl)
  }
  if (!c.plan) planifie(c)
  if (!c.offre) rafraichit(c)
  c.offre.objets ??= []
  return brut
}

// --- Le dépôt --------------------------------------------------------------------

export const trouve = (c, id) => c.troupes.find((t) => t.id === id) ?? null

export const escouadeDe = (c, id) => c.escouades.find((e) => e.membres.includes(id)) ?? null

/** Les troupes qui montent au front : les membres des escouades, dans la limite des places. */
export function alignees(c) {
  const t = []
  for (const e of c.escouades) {
    for (const id of e.membres) {
      const u = trouve(c, id)
      if (u && !t.includes(u)) t.push(u)
    }
  }
  return t.slice(0, places(c.niveau))
}

export function creeEscouade(c) {
  if (c.escouades.length >= escouadesMax(c.niveau)) return null
  const noms = ['PREMIÈRE', 'SECONDE', 'TROISIÈME', 'QUATRIÈME']
  const e = { nom: noms[c.escouades.length] ?? 'RENFORT', chef: null, membres: [] }
  c.escouades.push(e)
  return e
}

/**
 * Affecte une troupe à une escouade. Une troupe n'est jamais dans deux
 * escouades : on la retire de l'ancienne, sans le demander.
 */
export function affecte(c, e, id) {
  const u = trouve(c, id)
  if (!u) return false
  const avant = escouadeDe(c, id)
  if (avant === e) return retireDe(c, id)
  if (e.membres.length >= tailleEscouade(c.niveau)) return false
  if (avant) retireDe(c, id)
  e.membres.push(id)
  if (!e.chef || !e.membres.includes(e.chef)) e.chef = meilleurChef(c, e)
  return true
}

export function retireDe(c, id) {
  const e = escouadeDe(c, id)
  if (!e) return false
  e.membres = e.membres.filter((m) => m !== id)
  if (e.chef === id) e.chef = meilleurChef(c, e)
  return true
}

/** Le chef par défaut : le plus haut gradé de l'escouade, le plus expérimenté à égalité. */
export function meilleurChef(c, e) {
  const membres = e.membres.map((id) => trouve(c, id)).filter(Boolean)
  if (!membres.length) return null
  return membres.reduce((a, b) => (b.grade > a.grade || (b.grade === a.grade && b.niv > a.niv) ? b : a)).id
}

/**
 * Fait monter une troupe en ligne s'il reste de la place — quitte à ouvrir une
 * escouade que le niveau autorise. Sans ça, on paie très cher un unique qui
 * reste au dépôt parce que la première escouade était pleine.
 */
export function enrole(c, id) {
  if (escouadeDe(c, id)) return true
  if (alignees(c).length >= places(c.niveau)) return false
  for (const e of c.escouades) if (affecte(c, e, id)) return true
  const neuve = creeEscouade(c)
  return neuve ? affecte(c, neuve, id) : false
}

export function nommeChef(c, e, id) {
  if (!e.membres.includes(id)) return false
  const u = trouve(c, id)
  // Un chef d'escouade est au moins caporal : c'est le sens du grade.
  if (!u || u.grade < 1) return false
  e.chef = id
  return true
}

// --- Recrutement -----------------------------------------------------------------

/** L'étal de la caserne et le carnet de l'état-major, retirés à chaque engagement. */
/**
 * Le niveau auquel la caserne enrôle.
 *
 * **Pas le niveau de la compagnie.** C'était le réglage d'origine, et il rendait
 * la persistance absurde : mesuré au banc, le niveau global prend 4,2 rangs
 * d'avance sur la troupe moyenne en vingt-huit engagements, si bien qu'une
 * recrue payée trois cents pièces sortait meilleure que le vétéran de dix
 * batailles qu'on avait soigné et gardé. Acheter battait conserver, toujours.
 *
 * La caserne enrôle donc au niveau de **ce qu'on aligne vraiment**, plafonné
 * par le niveau de la compagnie. Une recrue comble un trou ou apporte une
 * classe qu'on n'a pas ; elle ne remplace jamais un vétéran par une meilleure
 * copie sortie du guichet.
 */
export function niveauRecrue(c) {
  const t = c.troupes ?? []
  if (!t.length) return 1
  const moyenne = t.reduce((s, u) => s + u.niv, 0) / t.length
  return Math.max(1, Math.min(c.niveau, Math.round(moyenne)))
}

export function rafraichit(c) {
  const rng = melange32(derive(c.graine, 55, c.engagements, c.niveau))
  const dispo = CLASSES.filter((x) => x.rang <= c.niveau)
  const stock = melange(rng, dispo).slice(0, Math.min(6, dispo.length))
  const nivRecrue = niveauRecrue(c)
  const bassin = UNIQUES.map((u) => u.id)
  const offerts = U.tireUniques(rng, bassin, c.niveau, 3, c.uniquesVus)
  // Le marché : sans lui, l'étal est vide — un bâtiment qui ne change rien
  // tant qu'on ne l'a pas construit, comme la caserne ou l'infirmerie.
  const marche = V.niveauBat(c, 'marche')
  const objetsDispo = OBJETS.filter((o) => o.rang <= c.niveau)
  const stockObjets = marche > 0 ? melange(rng, objetsDispo).slice(0, Math.min(2 + marche, objetsDispo.length)) : []
  c.offre = {
    caserne: stock.map((x) => ({ cl: x.id, prix: U.prixGenerique(x.id, nivRecrue), niv: nivRecrue })),
    uniques: offerts.map((id) => ({
      uq: id,
      prix: U.prixUnique(id, c.niveau),
      niv: Math.max(UQ[id].rang, c.niveau),
      taux: U.tauxDrop(id, c.niveau, bassin, c.uniquesVus),
    })),
    objets: stockObjets.map((o) => ({ id: o.id, prix: prixObjet(o, c.niveau, U.echelle) })),
  }
}

/** Achète un objet neuf (tier 1) à l'étal du marché : il rejoint le dépôt. */
export function acheteObjet(c, index) {
  const ligne = c.offre.objets?.[index]
  if (!ligne || c.or < ligne.prix) return false
  c.or -= ligne.prix
  c.objets.push({ id: ligne.id, tier: 1 })
  c.offre.objets = c.offre.objets.filter((x, i) => i !== index)
  return true
}

export function recruteGenerique(c, clId) {
  const ligne = c.offre.caserne.find((x) => x.cl === clId)
  if (!ligne || c.or < ligne.prix || c.troupes.length >= depotMax(c.niveau)) return null
  const rng = melange32(derive(c.graine, 91, c.troupes.length, c.engagements))
  c.or -= ligne.prix
  const u = U.creeGenerique(clId, ligne.niv, parmi(rng, U.NOMS), parmi(rng, U.INITIALES))
  c.troupes.push(u)
  enregistreRecrue(c, u.cl)
  c.offre.caserne = c.offre.caserne.filter((x) => x !== ligne)
  return u
}

export function recruteUnique(c, uqId) {
  const ligne = c.offre.uniques.find((x) => x.uq === uqId)
  if (!ligne || c.or < ligne.prix || c.troupes.length >= depotMax(c.niveau)) return null
  c.or -= ligne.prix
  const u = U.creeUnique(uqId, ligne.niv)
  c.troupes.push(u)
  enregistreRecrue(c, u.cl)
  c.uniquesVus.push(uqId)
  c.offre.uniques = c.offre.uniques.filter((x) => x !== ligne)
  return u
}

export function reforme(c, id) {
  const u = trouve(c, id)
  if (!u) return 0
  const rendu = U.prixRevente(u, c.niveau)
  // L'équipement ne part pas avec la troupe qu'on réforme : il revient au
  // dépôt, sinon renvoyer un milicien blessé coûterait aussi l'armure qu'on
  // vient de payer.
  for (const emp of ['arme', 'armure', 'accessoire']) {
    const ancien = U.equipe(u, emp, null)
    if (ancien) c.objets.push(ancien)
  }
  retireDe(c, id)
  c.troupes = c.troupes.filter((t) => t.id !== id)
  c.or += rendu
  return rendu
}

/**
 * Équipe une instance du dépôt (`c.objets[indexDepot]`) sur une troupe.
 * L'ancien occupant de l'emplacement, s'il y en avait un, retourne au dépôt —
 * jamais perdu, jamais dupliqué.
 */
export function equipeObjet(c, id, emplacement, indexDepot) {
  const u = trouve(c, id)
  const inst = c.objets[indexDepot]
  if (!u || !inst) return false
  const objet = OBJET[inst.id]
  if (!objet || objet.emplacement !== emplacement) return false
  c.objets.splice(indexDepot, 1)
  const ancien = U.equipe(u, emplacement, inst)
  if (ancien) c.objets.push(ancien)
  return true
}

/** Déséquipe : l'instance retourne au dépôt. */
export function deposeObjet(c, id, emplacement) {
  const u = trouve(c, id)
  if (!u) return false
  const ancien = U.equipe(u, emplacement, null)
  if (!ancien) return false
  c.objets.push(ancien)
  return true
}

/** Améliore une instance équipée d'un tier, contre or — plafonnée par `plafond` (le niveau de la forge). */
export function ameliore(c, id, emplacement, plafond) {
  const u = trouve(c, id)
  const inst = u?.equip?.[emplacement]
  if (!inst) return false
  const objet = OBJET[inst.id]
  const tierVise = (inst.tier ?? 1) + 1
  if (!objet || tierVise > TIER_MAX || tierVise > plafond) return false
  const prix = prixAmelioration(objet, tierVise, c.niveau, U.echelle)
  if (c.or < prix) return false
  c.or -= prix
  inst.tier = tierVise
  return true
}

/** L'infirmerie : soigner coûte, et c'est ce qui donne un prix à une victoire chère. */
export const coutSoin = (c, u) => {
  const f = U.fiche(u)
  return Math.round(((f.pvMax - u.pv) * 0.9 * U.echelle(c.niveau)) / 5) * 5
}

export function soigne(c, id) {
  const u = trouve(c, id)
  if (!u) return false
  const prix = coutSoin(c, u)
  if (prix <= 0 || c.or < prix) return false
  c.or -= prix
  u.pv = U.fiche(u).pvMax
  u.blesse = 0
  return true
}

export const coutSoinTous = (c) => c.troupes.reduce((s, u) => s + coutSoin(c, u), 0)

/**
 * Le repos entre deux engagements : gratuit, et il ne remonte que jusqu'à un
 * certain point.
 *
 * Sans lui, mesuré au banc, la compagnie entrait dans chaque bataille plus
 * entamée que la précédente — l'or partait en pansements, on n'achetait plus
 * personne, et le taux de victoire s'effondrait de moitié entre le deuxième et
 * le troisième niveau **sans qu'aucune règle de combat n'ait changé**. Une
 * spirale de ce genre ne se joue pas, elle se subit. L'infirmerie, elle, garde
 * un sens : c'est elle qui rend le dernier tiers, tout de suite.
 */
export const PLAFOND_REPOS = 0.7
export const REPOS = 0.3

export function repos(c) {
  for (const u of c.troupes) {
    const max = U.fiche(u).pvMax
    const rendu = Math.round(max * REPOS)
    u.pv = Math.min(max, Math.max(u.pv, Math.min(Math.round(max * PLAFOND_REPOS), u.pv + rendu)))
    if (u.pv >= max) u.blesse = 0
  }
}

// --- La campagne -----------------------------------------------------------------

const LIEUX = [
  'DE SAHUC',
  'DE VABRE',
  'DU GUÉ',
  'DE PEYRE',
  'DE MALRIC',
  'DES BORDES',
  'DE CAUSSE',
  'DE LAUTREC',
  'DU ROC',
  'DE PONS',
  'DE CLARAC',
  'DE MAZEL',
]

export const dimensions = (niveau) => ({
  cols: Math.min(19, 9 + Math.floor(niveau * 0.55)),
  rows: Math.min(15, 7 + Math.floor(niveau * 0.45)),
})

export const toursMaxDe = (niveau) => 16 + Math.floor(niveau * 0.8)

/**
 * Les engagements proposés — deux au début, trois ensuite. C'est là que le
 * terrain devient une décision : le même adversaire dans un marais et sur une
 * route n'est pas le même adversaire.
 */
export function planifie(c) {
  const rng = melange32(derive(c.graine, 202, c.engagements))
  // Le poste de guet ajoute une offre par niveau, et lève le doute sur son
  // penchant : les autres offres restent un tirage à pile ou face, celles
  // du guet ne le sont jamais.
  const guet = V.niveauBat(c, 'guet')
  const combien = (c.niveau >= 3 ? 3 : 2) + guet
  const objs = OBJECTIFS.filter((o) => o.rang <= c.niveau)
  const { cols, rows } = dimensions(c.niveau)
  const biomes = melange(
    rng,
    BIOMES.map((b) => b.id),
  )
  // Des lieux distincts : deux offres « DE SAHUC » se confondent à la lecture.
  const lieux = melange(rng, LIEUX)
  const plan = []
  for (let i = 0; i < combien; i++) {
    const difficulte = 0.78 + i * 0.16 + (rng() - 0.5) * 0.1
    const obj = parmi(rng, objs)
    const biome = biomes[i % biomes.length]
    const veille = i >= combien - guet
    plan.push({
      k: i,
      nom: `${BIOMES.find((b) => b.id === biome).nom} ${lieux[i % lieux.length]}`,
      biome,
      objectif: obj.id,
      cols,
      rows,
      difficulte: Math.round(difficulte * 100) / 100,
      penchant: veille
        ? parmi(rng, ['INF', 'LEG', 'MON', 'TIR', 'ENG'])
        : rng() < 0.5
          ? null
          : parmi(rng, ['INF', 'LEG', 'MON', 'TIR', 'ENG']),
      or: Math.round((110 + 58 * c.niveau) * difficulte),
      renom: Math.round((18 + 4 * c.niveau) * difficulte),
      toursMax: toursMaxDe(c.niveau),
      graine: derive(c.graine, 303, c.engagements, i),
      // Le babillard : un contrat du guet retombe si on s'attarde trop —
      // les offres ordinaires, elles, n'ont pas de date de péremption.
      expire: veille ? c.ville.jour + V.DELAI_GUET : null,
    })
  }
  c.plan = plan
  c.choix = null
  return plan
}

/** Monte la bataille : terrain, objectif, armée adverse, déploiement des deux camps. */
export function prepare(c, k) {
  const e = c.plan[k]
  if (!e) return null
  const carte = genereCarte(e.graine, e.cols, e.rows, e.biome)
  const troupes = alignees(c)
  if (!troupes.length) return null

  const budget = A.budgetDe(A.forceDe(troupes), e.difficulte)
  // L'ennemi se règle sur **la troupe qu'on aligne vraiment**, pas sur le
  // niveau de la compagnie. Mesuré au banc : indexé sur le niveau, il
  // recrutait dans les classes du moment pendant qu'on montait au front avec
  // des vétérans d'il y a dix batailles, et le budget « égal » ne l'était pas.
  const rang = Math.max(1, Math.round(troupes.reduce((s, u) => s + u.niv, 0) / troupes.length))
  const champion = e.difficulte >= 1 ? A.championAdverse(e.graine, rang, c.uniquesVus) : null
  // « Tenir le choc » veut dire être en dessous, et pas seulement affronter un
  // compteur : sur cet objectif l'adversaire a moitié plus de moyens et jusqu'à
  // trois troupes de plus. En échange, le compte à rebours est nettement plus
  // court que celui d'une bataille ordinaire. L'embuscade partage exactement
  // ce déséquilibre : une vague adverse renforcée contre un goulet qu'on tient.
  const surnombre = e.objectif === 'survie' || e.objectif === 'embuscade'
  const adverses = A.armee(
    e.graine,
    rang,
    budget * (champion ? 0.68 : 1) * (surnombre ? 1.5 : 1),
    e.penchant,
    Math.min(16, troupes.length + (surnombre ? 3 : 0)),
  )
  if (champion) adverses.push(champion)

  const occupe = new Set()
  const mien = pose(carte, troupes, 0, occupe, c)
  const sien = pose(carte, adverses, 1, occupe, null)

  const objectif = { id: e.objectif, besoin: 3 }
  if (OBJ[e.objectif]?.points) {
    // L'embuscade ne marque qu'un seul point — le goulet — et le tient plus
    // longtemps qu'on ne tiendrait une majorité de points épars.
    const embuscade = e.objectif === 'embuscade'
    objectif.points = pointsCapture(e.graine, carte, embuscade ? 1 : c.niveau >= 10 ? 5 : 3)
    objectif.besoin = embuscade ? 5 : 3
  }
  if (e.objectif === 'decapitation') {
    const chef = sien.reduce((a, b) => (b.grade > a.grade || (b.grade === a.grade && b.niv > a.niv) ? b : a))
    objectif.chef = chef.ref
  }
  if (e.objectif === 'escorte') {
    // L'inverse de PERCER : ce ne sont pas deux troupes au choix qui doivent
    // traverser, ce sont les plus fragiles — celles qu'on aurait laissées à
    // l'arrière sur n'importe quel autre engagement. La force se lit sur la
    // troupe persistante (U.fiche) : la copie de bataille ne porte pas att/def.
    const faibles = [...troupes].sort((a, b) => {
      const fa = U.fiche(a)
      const fb = U.fiche(b)
      return fa.att + fa.def - (fb.att + fb.def)
    })
    const combien = Math.min(2, troupes.length)
    objectif.escortes = faibles.slice(0, combien).map((t) => t.id)
    objectif.besoin = combien
  }
  const tours = surnombre ? Math.round(e.toursMax * 0.62) : e.toursMax
  const bat = B.commence(carte, objectif, mien, sien, { toursMax: tours })
  bat.titre = e.nom
  bat.banniere = parmi(melange32(e.graine), A.BANNIERES)
  bat.niveau = c.niveau
  bat.recompense = { or: e.or, renom: e.renom }
  return bat
}

/** Dépose une troupe par ligne, du centre vers les bords : une ligne de bataille. */
function pose(carte, troupes, camp, occupe, c) {
  const zone = zoneDeploiement(carte, camp, 2)
  const milieu = Math.floor(zone.length / 2)
  const ordre = zone
    .map((h, i) => ({ h, i }))
    .sort((a, b) => Math.abs(a.i - milieu) - Math.abs(b.i - milieu))
    .map((x) => x.h)
  const sortie = []
  for (const t of troupes) {
    const cible = ordre.find((h) => !occupe.has(cle(h.q, h.r))) ?? zone[0]
    const place = placeLibre(carte, cible, occupe)
    if (!place) continue
    const u = B.engage(t, camp, place.q, place.r)
    if (c) {
      const e = escouadeDe(c, t.id)
      u.esc = e ? c.escouades.indexOf(e) : -1
      // Un chef d'escouade tient les siens avant même le premier coup.
      if (e && e.chef && e.chef !== t.id) u.moral = Math.min(B.MORAL_PLEIN, u.moral + 8)
      // Et le moral de la compagnie entre en bataille avec elle : c'est le
      // même nombre qui vit en ville et qui se joue ici, pour qu'il n'y ait
      // pas deux morals à expliquer.
      u.moral = Math.max(1, Math.min(B.MORAL_PLEIN, u.moral + V.bonusMoral(c)))
      // Les fortifications posent un état permanent plutôt qu'un bonus de
      // fiche : c'est la même mécanique qu'un ordre « SE RETRANCHER », sauf
      // que sa durée infinie ne redescend jamais à zéro (`Infinity - 1` reste
      // `Infinity`), donc elle tient jusqu'au bout de la bataille sans code
      // à part.
      const def = V.bonusDefense(c)
      if (def > 0) u.etats.push({ def, duree: Infinity, nom: 'FORTIFIÉ' })
    }
    occupe.add(cle(place.q, place.r))
    sortie.push(u)
  }
  return sortie
}

// --- Après la bataille -------------------------------------------------------------

/**
 * Le carnet de guerre : une ligne composée à partir du rapport déjà calculé,
 * jamais une donnée de plus à tenir. Pure présentation — l'esprit d'un
 * journal qui raconte ce qui vient de se passer plutôt que d'empiler des
 * compteurs. `null` quand rien ne mérite une ligne à soi.
 */
function carnetDeGuerre(c, rapport) {
  const montee = rapport.montees.find((m) => m.grade != null) ?? rapport.montees[0]
  if (montee) {
    const atteint = montee.grade != null ? GRADES[montee.grade].nom : `NIVEAU ${montee.u.niv}`
    return `${U.nomComplet(montee.u)} atteint ${atteint}`
  }
  if (rapport.cicatrices.length) {
    const x = rapport.cicatrices[0]
    return `${U.nomComplet(x.u)} porte une nouvelle cicatrice : ${APT[x.id].nom}`
  }
  if (rapport.gagne && c.serie >= 3) return `${c.serie}e victoire consécutive`
  if (rapport.gagne && !rapport.perdus.length && !rapport.lignes.length) return 'victoire sans perte'
  return null
}

/**
 * Le report. C'est ici que la persistance se paie : l'expérience monte, les
 * blessures restent, et **une défaite coûte les tombés**. Une victoire les
 * ramène — mal en point, mais vivants.
 */
export function bilan(c, bat) {
  const gagne = bat.fini === 'gagne'
  const rompu = bat.fini === 'retraite'
  const rapport = { gagne, rompu, or: 0, renom: 0, lignes: [], cicatrices: [], perdus: [], montees: [] }
  const rngCicatrice = melange32(derive(c.graine, 888, c.engagements))

  for (const cu of B.unitesDe(bat, 0)) {
    const u = trouve(c, cu.ref)
    if (!u) continue
    u.batailles++
    u.tues += cu.tues
    if (cu.pv > 0) {
      u.pv = cu.pv
    } else if (gagne || u.uq) {
      // Ramassé sur le terrain : il repart, à un quart de ses forces.
      u.pv = Math.max(1, Math.round(U.fiche(u).pvMax * 0.25))
      u.blesse = 1
      u.ramasse = (u.ramasse ?? 0) + 1
      rapport.lignes.push({ u, texte: 'RAMASSÉ', teinte: 'rouge' })
      const cicatrice = V.cicatriceGagnee(u, rngCicatrice)
      if (cicatrice) rapport.cicatrices.push({ u, id: cicatrice })
    } else {
      rapport.perdus.push(u)
      continue
    }
    const xp = Math.round(cu.degats * 0.55 + cu.tues * 15 + (gagne ? 16 + c.niveau * 2 : 5))
    const g = U.gagneXp(u, xp, c.niveau + 3)
    if (g.niveaux > 0 || g.grade != null) rapport.montees.push({ u, ...g })
  }

  for (const u of rapport.perdus) {
    retireDe(c, u.id)
    c.troupes = c.troupes.filter((t) => t.id !== u.id)
    c.pertes++
    enregistreTombee(c, u.cl)
  }

  // La bataille a pris une journée : elle marque la date, et c'est elle qui
  // repousse l'oubli. Le moral suit le résultat — une déroute se paie
  // au-delà des pertes.
  V.cale(c)
  c.ville.dernierCombat = c.ville.jour
  V.passeJour(c)
  V.ajusteMoral(c, gagne ? 8 : rompu ? -4 : -10)

  repos(c)

  rapport.or = Math.round((bat.recompense?.or ?? 60) * (gagne ? 1 : rompu ? 0.3 : 0.45))
  rapport.renom = gagne ? (bat.recompense?.renom ?? 10) : 0
  c.or += rapport.or
  c.renom += rapport.renom
  c.engagements++
  if (gagne) c.victoires++
  c.serie = gagne ? (c.serie ?? 0) + 1 : 0

  // Le butin ne tombe que sur une victoire — une retraite ou une défaite ne
  // laisse personne fouiller le champ. La chance monte doucement avec le
  // niveau, comme le reste de l'économie.
  if (gagne) {
    const rng = melange32(derive(c.graine, 777, c.engagements))
    if (rng() < 0.3 + c.niveau * 0.01) {
      const objet = pondere(rng, OBJETS, (x) => (x.rang <= c.niveau ? 1 / (1 + (c.niveau - x.rang) * 0.15) : 0))
      if (objet) {
        c.objets.push({ id: objet.id, tier: 1 })
        rapport.butin = objet
      }
    }
  }

  rapport.niveaux = 0
  while (c.renom >= seuilRenom(c.niveau)) {
    c.renom -= seuilRenom(c.niveau)
    c.niveau++
    rapport.niveaux++
  }
  // Les escouades suivent le niveau : une nouvelle place ouverte est une
  // nouvelle escouade possible, mais on ne la crée pas dans le dos du joueur.
  if (!c.escouades.length) creeEscouade(c)

  rafraichit(c)
  planifie(c)
  rapport.carnet = carnetDeGuerre(c, rapport)
  c.dernier = { gagne, or: rapport.or, renom: rapport.renom, titre: bat.titre, carnet: rapport.carnet }
  return rapport
}

/**
 * La fin de la campagne : plus une troupe debout **et** pas de quoi en lever
 * une. Tant qu'il reste de l'or on repart d'une levée de miliciens ; c'est
 * quand la caisse est vide en même temps que le dépôt que c'est terminé.
 */
export const aneantie = (c) => c.troupes.length === 0 && !c.offre?.caserne.some((l) => l.prix <= c.or)

export { OBJECTIFS, OBJ, GRADES, CL, UQ, RAR, U, OBJETS, OBJET, TIER_MAX, prixObjet }
