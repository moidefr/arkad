/**
 * Une unité : de son recrutement à sa fiche de combat.
 *
 * Rien ici ne connaît la bataille en cours — on fabrique des troupes, on
 * calcule ce qu'elles valent, on dit ce qu'elles coûtent. Les troupes sont
 * **persistantes** : le même objet traverse la campagne, gagne des niveaux,
 * des grades, des cicatrices.
 */
import { CL, GRADES, GRADE_MAX_GENERIQUE, TYPE } from './donnees/classes.js'
import { UQ, RAR } from './donnees/uniques.js'
import { APT } from './donnees/aptitudes.js'
import { OBJ, EMPLACEMENTS, TIERS } from './donnees/objets.js'
import { pondere } from './rng.js'

/**
 * Le vivier de noms des recrues génériques. Un milicien sans nom est un pion ;
 * avec un nom, on remarque qu'il est mort. Ça ne coûte qu'une table.
 */
export const NOMS = [
  'ARNAUT',
  'BALAGUÈRE',
  'BASTIDE',
  'BEAUVAIS',
  'BÉLESTA',
  'BORDES',
  'BOUSQUET',
  'CABANES',
  'CAMBON',
  'CANTELOUP',
  'CARLUS',
  'CASSAGNE',
  'CAUSSE',
  'CHALABRE',
  'CLARAC',
  'COMBES',
  'CORBIÈRE',
  'COSTES',
  'DELPECH',
  'DENAT',
  'DOMENGE',
  'DURFORT',
  'ESCLAUX',
  'FABRE',
  'FAJOL',
  'FALGUIÈRE',
  'FERRAN',
  'FONTÈS',
  'GALIBERT',
  'GARRIC',
  'GAUSSENS',
  'GAVALDA',
  'GIROUSSE',
  'GOUZE',
  'GRAULHET',
  'GUIRAUD',
  'JOUCLA',
  'LABORDE',
  'LACAZE',
  'LAFON',
  'LAGARDE',
  'LAMOTHE',
  'LARROQUE',
  'LASSERRE',
  'LAUTREC',
  'LAVAL',
  'LOUBET',
  'MAFFRE',
  'MALRIC',
  'MARSAL',
  'MASSOL',
  'MAUREL',
  'MAZEL',
  'MERCADIER',
  'MOLINIER',
  'MONTELS',
  'MOULIS',
  'NAUDIN',
  'OLIVIER',
  'PAGÈS',
  'PALAJA',
  'PECH',
  'PEYRE',
  'PIQUEMAL',
  'PONS',
  'POUJADE',
  'PRADEL',
  'PUJOL',
  'QUÉRIN',
  'RAYNAL',
  'REDON',
  'RESSÉGUIER',
  'RIEUX',
  'RIVIÈRE',
  'ROQUES',
  'ROUAIX',
  'ROUZAUD',
  'SABATIER',
  'SAGNES',
  'SAHUC',
  'SALVAN',
  'SARRAZIN',
  'SAUZET',
  'SÉGUIER',
  'SÉRÈS',
  'SICARD',
  'SOULAGES',
  'TEISSIER',
  'TERRAL',
  'THÉRON',
  'TOURNIER',
  'TRÉMOULET',
  'VABRE',
  'VAISSIÈRE',
  'VALADE',
  'VAYSSIÈRE',
  'VERDIER',
  'VIALA',
  'VIDAL',
  'VIGUIER',
]

/** Prénoms courts, pour que deux VERDIER ne se confondent pas. */
export const INITIALES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'L', 'M', 'N', 'P', 'R', 'S', 'T', 'V']

let compteur = 1
export const neufId = () => 'u' + compteur++
/** La sauvegarde repart d'un compteur cohérent : deux unités ne partagent jamais un id. */
export const cale = (unites) => {
  for (const u of unites) {
    const n = Number(String(u.id).slice(1))
    if (Number.isFinite(n) && n >= compteur) compteur = n + 1
  }
}

// --- Fabrication --------------------------------------------------------------

export function creeGenerique(clId, niveau, nom, initiale) {
  const cl = CL[clId]
  const u = {
    id: neufId(),
    cl: clId,
    uq: null,
    nom: nom ?? 'RECRUE',
    ini: initiale ?? '',
    niv: Math.max(1, niveau),
    xp: 0,
    grade: 0,
    apt: [...cl.apt],
    pv: 0,
    blesse: 0,
    batailles: 0,
    tues: 0,
    equip: equipVide(),
    cicatrices: [],
    ramasse: 0,
  }
  u.grade = gradeAtteint(u)
  u.pv = fiche(u).pvMax
  return u
}

/** Trois emplacements, tous vides — la forme que `u.equip` garde toujours. */
export const equipVide = () => ({ arme: null, armure: null, accessoire: null })

export function creeUnique(uqId, niveau) {
  const uq = UQ[uqId]
  const cl = CL[uq.cl]
  const u = {
    id: neufId(),
    cl: uq.cl,
    uq: uqId,
    nom: uq.nom,
    ini: '',
    niv: Math.max(uq.rang, niveau),
    xp: 0,
    grade: uq.grade,
    apt: [...new Set([...cl.apt, ...uq.apt])],
    pv: 0,
    blesse: 0,
    batailles: 0,
    tues: 0,
    equip: equipVide(),
    cicatrices: [],
    ramasse: 0,
  }
  // Le grade de la fiche est un **plancher**, pas un plafond : sans ce
  // rappel, un unique sergent recruté au niveau 12 sortait moins gradé — donc
  // plus faible — que le générique de sa propre classe.
  u.grade = gradeAtteint(u)
  u.pv = fiche(u).pvMax
  return u
}

/** Un lot de recrues génériques, tirées et nommées sans doublon. */
export function recrues(rng, classes, niveau, combien) {
  const t = []
  const pris = new Set()
  for (let i = 0; i < combien; i++) {
    const cl = classes[Math.floor(rng() * classes.length)]
    let nom
    let ini
    for (let essai = 0; essai < 12; essai++) {
      nom = NOMS[Math.floor(rng() * NOMS.length)]
      ini = INITIALES[Math.floor(rng() * INITIALES.length)]
      if (!pris.has(ini + nom)) break
    }
    pris.add(ini + nom)
    t.push(creeGenerique(cl.id ?? cl, niveau, nom, ini))
  }
  return t
}

// --- La fiche -----------------------------------------------------------------

/** Croissance par niveau : +9 % de tout, ce qui double une troupe au niveau 12. */
export const CROISSANCE = 0.09

/**
 * L'endurance générale, appliquée à toutes les vies d'un coup.
 *
 * C'est le bouton qui règle la **durée** d'une bataille, et rien d'autre : à
 * 1,0 une troupe tombait en deux coups et l'affaire était pliée en quatre
 * tours, ce qui ne laisse le temps d'aucune manœuvre. Monter ce seul nombre
 * rallonge l'engagement sans toucher à l'équilibre entre les classes, puisque
 * toutes montent ensemble.
 */
export const ENDURANCE = 1.7

/**
 * Les aptitudes que porte réellement une unité : celles de sa classe/de son
 * unique, **plus** les passives que son équipement ajoute, **plus** ses
 * cicatrices de vétéran (lot 7 — gagnées à force d'être ramassée sur le
 * terrain, jamais choisies).
 *
 * Un seul endroit lit `u.equip` et `u.cicatrices` pour en tirer des
 * aptitudes — exactement comme un seul endroit lit `u.uq`. `passif()`,
 * `fichePassif()` et `ordres()` passent tous par ici, ce qui suffit à ce
 * qu'une source secondaire de passif se comporte en tout point comme si la
 * classe elle-même le portait. Ni un objet ni une cicatrice ne portent
 * jamais d'ordre (règle de `donnees/objets.js` et de `CICATRICES`), donc
 * `ordres()` n'en verra jamais sortir d'ici — mais il lit quand même cette
 * liste, pour ne pas dupliquer la fusion à un deuxième endroit.
 */
export function aptEffectives(u) {
  const dEquip = Object.values(u.equip ?? {})
    .filter(Boolean)
    .map((inst) => OBJ[inst.id]?.passif)
    .filter(Boolean)
  return [...new Set([...(u.apt ?? []), ...dEquip, ...(u.cicatrices ?? [])])]
}

/** La somme des bonus chiffrés de l'équipement, chaque tier multipliant le bonus de base. */
function bonusEquip(u) {
  const s = { pv: 0, att: 0, def: 0, mvt: 0, vue: 0, portee: 0 }
  for (const inst of Object.values(u.equip ?? {})) {
    if (!inst) continue
    const obj = OBJ[inst.id]
    if (!obj?.bonus) continue
    const mult = TIERS[(inst.tier ?? 1) - 1]?.mult ?? 1
    for (const cle of Object.keys(s)) if (obj.bonus[cle]) s[cle] += obj.bonus[cle] * mult
  }
  return s
}

/**
 * Ce que vaut une unité, hors bataille : classe, niveau, grade, unique,
 * équipement. Les bonus de terrain, d'aura et d'état sont ajoutés par
 * `bataille.js` — ici on ne connaît que la troupe elle-même.
 */
export function fiche(u) {
  const cl = CL[u.cl]
  const g = GRADES[u.grade] ?? GRADES[0]
  const b = u.uq ? (UQ[u.uq].bonus ?? {}) : {}
  const eq = bonusEquip(u)
  const k = 1 + CROISSANCE * (u.niv - 1)
  return {
    cl,
    type: cl.type,
    pvMax: Math.round((cl.pv * k * g.pv + (b.pv ?? 0) + eq.pv) * ENDURANCE),
    att: cl.att * k * g.att + (b.att ?? 0) + eq.att,
    def: cl.def * k * g.def + (b.def ?? 0) + eq.def,
    portee: [cl.portee[0], cl.portee[1] + (b.portee ?? 0) + eq.portee + passif(u, 'precision')],
    mvt: cl.mvt + (b.mvt ?? 0) + eq.mvt + passif(u, 'marcheur'),
    vue: cl.vue + (b.vue ?? 0) + eq.vue + passif(u, 'guetteur'),
    aura: g.aura + passif(u, 'commandement'),
  }
}

/** La valeur d'une passive, 0 si l'unité ne l'a pas. Les doublons ne s'additionnent pas. */
export function passif(u, cle) {
  let v = 0
  for (const id of aptEffectives(u)) {
    const a = APT[id]
    if (a?.passif === cle) v = Math.max(v, a.valeur)
  }
  return v
}

/** L'aptitude passive `cle` portée par l'unité, pour lire ses champs annexes. */
export function fichePassif(u, cle) {
  let meilleure = null
  for (const id of aptEffectives(u)) {
    const a = APT[id]
    if (a?.passif === cle && (!meilleure || a.valeur > meilleure.valeur)) meilleure = a
  }
  return meilleure
}

/** Les ordres — les aptitudes actives — que porte l'unité. */
export const ordres = (u) =>
  aptEffectives(u)
    .map((id) => APT[id])
    .filter((a) => a?.ordre)

/** Équipe un objet du dépôt (retourne l'ancien occupant de l'emplacement, s'il y en avait un). */
export function equipe(u, emplacement, inst) {
  if (!EMPLACEMENTS.includes(emplacement)) return null
  const objet = OBJ[inst?.id]
  if (inst && (!objet || objet.emplacement !== emplacement)) return null
  const ancien = u.equip[emplacement] ?? null
  u.equip[emplacement] = inst ?? null
  return ancien
}

export const estUnique = (u) => !!u.uq
export const nomComplet = (u) => (u.uq ? UQ[u.uq].nom : `${u.ini}. ${u.nom}`)
export const titre = (u) => (u.uq ? UQ[u.uq].titre : CL[u.cl].nom)
export const typeDe = (u) => TYPE[CL[u.cl].type]

// --- Expérience et grades -----------------------------------------------------

/** Expérience nécessaire pour passer du niveau `n` au suivant. */
export const besoinXp = (n) => Math.round(28 * Math.pow(n, 1.28))

/**
 * Le grade auquel le niveau donne droit. Un générique plafonne à lieutenant :
 * au-delà, il faut recruter quelqu'un qui a un nom. Un unique ne redescend
 * jamais sous le grade avec lequel il est arrivé.
 */
/**
 * Le nombre de batailles qu'il faut avoir faites pour porter un grade.
 *
 * Un grade se gagne au feu, pas au guichet. Sans cette condition, une recrue
 * générique sortait de la caserne avec le grade que son niveau lui donnait :
 * mesuré au banc, **les six cartes de la caserne sur six** étaient gradées dès
 * le septième engagement, et elles commandaient mieux que les sergents qu'on
 * avait faits soi-même. Un unique, lui, arrive avec son nom et son rang —
 * c'est précisément ce qu'on paie.
 */
export const BATAILLES_PAR_GRADE = [0, 2, 6, 12, 20, 30]

export function gradeAtteint(u) {
  const plancher = u.uq ? UQ[u.uq].grade : 0
  const plafond = u.uq ? GRADES.length - 1 : GRADE_MAX_GENERIQUE
  let g = plancher
  for (const gr of GRADES) {
    if (gr.id > plafond || gr.niveau > u.niv) continue
    // Le plancher d'un unique ne se discute pas ; au-delà, tout le monde doit
    // avoir servi.
    if (gr.id > plancher && (u.batailles ?? 0) < BATAILLES_PAR_GRADE[gr.id]) continue
    g = Math.max(g, gr.id)
  }
  return g
}

/**
 * Encaisse de l'expérience. Renvoie ce qui a changé, pour que l'écran d'après
 * bataille puisse le raconter au lieu d'afficher un nombre qui a bougé.
 */
export function gagneXp(u, xp, plafond = 99) {
  const gagne = Math.round(xp * (1 + passif(u, 'aguerri')))
  u.xp += gagne
  const avant = { niv: u.niv, grade: u.grade }
  while (u.niv < plafond && u.xp >= besoinXp(u.niv)) {
    u.xp -= besoinXp(u.niv)
    u.niv++
  }
  u.grade = gradeAtteint(u)
  // Monter de niveau soigne la différence de vie maximale : on ne punit pas
  // une promotion en laissant la barre plus courte qu'avant.
  // Et jamais au-delà du maximum. L'incrément suppose que la vie ne dépend que
  // du niveau ; depuis que le grade se gagne au feu et non au rang, les deux
  // ne montent plus ensemble et l'incrément pouvait dépasser.
  if (u.niv > avant.niv) {
    u.pv = Math.min(fiche(u).pvMax, u.pv + Math.round((u.niv - avant.niv) * CL[u.cl].pv * CROISSANCE * ENDURANCE))
  }
  return { xp: gagne, niveaux: u.niv - avant.niv, grade: u.grade > avant.grade ? u.grade : null }
}

// --- Prix et taux d'apparition -------------------------------------------------
//
// Les deux sont indexés sur le niveau de la compagnie, et c'est voulu : un
// engagement de fin de campagne rapporte dix fois plus d'or qu'une escarmouche,
// donc dix fois plus cher est le même prix.

/** La courbe commune. Au niveau 10, tout coûte 3,9 fois son prix de départ. */
export const echelle = (niveau) => Math.pow(1 + 0.26 * (niveau - 1), 1.12)

export const prixGenerique = (clId, niveau) => Math.round((CL[clId].prix * echelle(niveau)) / 5) * 5

export const prixUnique = (uqId, niveau) => {
  const uq = UQ[uqId]
  const r = RAR[uq.rarete]
  return Math.round((CL[uq.cl].prix * r.prix * (1 + 0.14 * uq.grade) * echelle(niveau)) / 10) * 10
}

/** Le prix qu'on récupère en réformant une troupe : la moitié, jamais plus. */
export const prixRevente = (u, niveau) =>
  Math.round((u.uq ? prixUnique(u.uq, niveau) : prixGenerique(u.cl, niveau)) * 0.4)

/**
 * Le poids d'apparition d'un unique à l'état-major.
 *
 * Trois forces : la rareté (une légende reste rare), le niveau de compagnie
 * (qui ouvre les raretés hautes), et l'ancienneté de la fiche (un vétéran de
 * rang 1 s'efface une fois qu'on commande une armée). Renvoie 0 tant que le
 * rang n'est pas atteint — c'est le seul verrou dur.
 */
export function poidsDrop(uqId, niveau, deja = []) {
  const uq = UQ[uqId]
  if (!uq || niveau < uq.rang || deja.includes(uqId)) return 0
  const r = RAR[uq.rarete]
  // Le niveau ouvre les raretés hautes sans jamais les rendre banales : une
  // légende reste plus rare qu'un vétéran, même à la vingtième bataille.
  const ouverture = Math.pow(1 + 0.03 * niveau, uq.rarete - 1)
  const usure = Math.max(0.3, 1 - (niveau - uq.rang) * 0.04)
  return r.poids * ouverture * usure
}

/** Le même poids, rendu en probabilité lisible — c'est ce qu'affiche la fiche. */
export function tauxDrop(uqId, niveau, bassin, deja = []) {
  let total = 0
  for (const x of bassin) total += poidsDrop(x, niveau, deja)
  if (total <= 0) return 0
  return poidsDrop(uqId, niveau, deja) / total
}

/** Tire `combien` uniques distincts, pondérés. C'est l'offre de l'état-major. */
export function tireUniques(rng, bassin, niveau, combien, deja = []) {
  const pris = [...deja]
  const sortie = []
  for (let i = 0; i < combien; i++) {
    const choisi = pondere(rng, bassin, (x) => poidsDrop(x, niveau, pris))
    if (!choisi) break
    pris.push(choisi)
    sortie.push(choisi)
  }
  return sortie
}
