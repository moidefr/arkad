import { COMP } from './donnees/competences.js'
import { CLASSE } from './donnees/classes.js'
import { PROC } from './donnees/ennemis.js'
import { ETAT } from './donnees/etats.js'
import { MODULE } from './donnees/modules.js'

/**
 * Le moteur de combat.
 *
 * **Aucun aléatoire dans la résolution.** Les dégâts sont exactement
 * prévisibles ; le hasard vit dans la génération — quels nœuds, quelles
 * offres, quels processus — et dans les choix pondérés de l'adversaire, jamais
 * dans le résultat d'un coup. C'est ce qui rend le combat lisible sur 360 px,
 * juste, et surtout **assertable à l'unité près par un test**. Un système à
 * plusieurs centaines de fiches ne se vérifie pas autrement.
 *
 * Ce fichier n'importe rien de `dessin.js`, `son.js` ni `localStorage` : il
 * tourne en Node nu, et c'est ce qui permet de simuler des milliers de combats
 * pour repérer une combinaison qui gagne toujours.
 */

export const CYCLES_MAX = 10
export const CYCLES_TOUR = 2

/**
 * Les cycles rendus au début du tour d'un opérateur, selon la taille de
 * l'équipage.
 *
 * Les cycles sont une ressource **partagée**, donc une équipe de trois en
 * regagne trois fois plus par tour de camp qu'un opérateur seul. Sans ce
 * rattrapage, jouer seul revient à jouer avec le tiers de son économie contre
 * les mêmes processus : ce n'est pas plus dur, c'est un autre jeu, et un moins
 * bon. Trois opérateurs : 2. Deux : 4. Un seul : 6.
 */
export const cyclesTour = (n) => 2 + (3 - Math.max(1, Math.min(3, n))) * 2

/**
 * Ce qu'on donne à un opérateur qui plonge seul.
 *
 * Il affronte les mêmes processus sans personne pour le couvrir, le réparer ni
 * finir ce qu'il a entamé. La compensation est franche et lisible plutôt que
 * distribuée en petits ajustements partout.
 */
export const SOLO = { pv: 1.55, blindage: 1, puiss: 0, degats: 0.1, tempo: 0.6 }
export const TRACAGE_MAX = 100
export const TRACAGE_RETOMBE = 40
export const TRACAGE_DECRUE = 6
/** Tous les huit tours, le traçage ne peut plus redescendre aussi bas. */
export const TRACAGE_PALIER = 8
export const TRACAGE_MARCHE = 5
/** Trois actions d'affilée portant trois tags différents : la troisième compte double et demie. */
export const CHAINE_TAGS = ['MARQUE', 'DEPLACE', 'FIN']
export const CHAINE_PRIME = 1.5
export const FILE_VUE = 7

// --- Construction ---------------------------------------------------------------

/**
 * @param equipe  les trois opérateurs, tels que les porte la sauvegarde
 * @param rencontre  la liste d'identifiants de processus
 */
export function commence(equipe, rencontre, { tracage = 0, cyclesMax = CYCLES_MAX } = {}) {
  const seul = equipe.length === 1
  const ops = equipe.map((o, i) => {
    const cl = CLASSE[o.cl]
    const mods = (o.mod ?? [])
      .filter(Boolean)
      .map((id) => MODULE[id])
      .filter(Boolean)
    const somme = (cle) => mods.reduce((s, m) => s + (m[cle] ?? 0), 0)
    // `pvMax` vient de la fiche, déjà renforcé si l'opérateur plonge seul :
    // le multiplier ici aussi le doublerait à chaque combat.
    const pvMax = Math.max(10, (o.pvMax ?? cl.pv) + somme('pvMax'))
    const vit = Math.max(3, cl.vit + somme('vit'))
    return {
      i,
      nom: o.nom,
      cl: o.cl,
      pv: Math.min(o.pv ?? pvMax, pvMax),
      pvMax,
      puiss: cl.puiss + somme('puiss') + (seul ? SOLO.puiss : 0),
      vit,
      blindage: Math.max(0, cl.blindage + somme('blindage') + (seul ? SOLO.blindage : 0)),
      rang: o.rang ?? cl.rang,
      seul,
      affute: (o.affute ?? []).slice(),
      comp: o.comp.slice(),
      mod: mods,
      rech: o.comp.map(() => 0),
      etats: {},
      att: 100 / vit,
    }
  })

  const proc = rencontre.map((id, i) => {
    const p = PROC[id]
    return {
      i,
      e: id,
      nom: p.nom,
      pv: p.pv,
      pvMax: p.pv,
      puiss: p.puiss,
      vit: p.vit,
      blindage: p.blindage,
      rang: p.rang,
      resist: p.resist,
      comp: p.comp.slice(),
      rech: p.comp.map(() => 0),
      etats: {},
      att: 100 / p.vit,
      intent: null,
      phases: p.phases,
      phase: p.phases?.[0],
      resist: p.phases ? p.phases[0].resist : p.resist,
    }
  })

  const bonusCycles = ops.reduce((s, o) => s + (o.mod ?? []).reduce((t, m) => t + (m.cyclesMax ?? 0), 0), 0)
  const c = {
    ops,
    proc,
    seul,
    cycles: 4,
    parTour: cyclesTour(ops.length),
    cyclesMax: cyclesMax + bonusCycles,
    tracage,
    chaine: [],
    tour: 0,
    journal: [],
    regles: rencontre.map((id) => PROC[id].regle).filter(Boolean),
  }
  prevoit(c)
  return c
}

// --- Lecture de l'état -------------------------------------------------------------

export const vivant = (u) => u.pv > 0
export const vivants = (liste) => liste.filter(vivant)
export const campDe = (c, u) => (c.ops.includes(u) ? c.ops : c.proc)
export const adverseDe = (c, u) => (c.ops.includes(u) ? c.proc : c.ops)

/** Le rang avant d'un camp, ou l'arrière s'il est vide : un camp n'a jamais deux fronts. */
export function frontDe(liste) {
  const devant = vivants(liste).filter((u) => u.rang === 0)
  return devant.length ? 0 : 1
}

/** Qui joue ensuite. La file est calculable à l'avance, et c'est tout l'intérêt. */
export function actif(c) {
  const tous = [...vivants(c.ops), ...vivants(c.proc)]
  if (!tous.length) return null
  let meilleur = tous[0]
  for (const u of tous) if (u.att < meilleur.att - 1e-9) meilleur = u
  return meilleur
}

export const estOperateur = (c, u) => c.ops.includes(u)

/**
 * Les `n` prochains à jouer, simulés sans rien modifier. C'est cette fenêtre
 * qui transforme un combat déterministe en problème d'ordonnancement au lieu
 * d'un échange de coups.
 */
export function file(c, n = FILE_VUE) {
  const copie = [...vivants(c.ops), ...vivants(c.proc)].map((u) => ({
    u,
    att: u.att,
    pas: (100 * tempoDe(u, { temps: 1 })) / u.vit,
  }))
  const out = []
  for (let k = 0; k < n && copie.length; k++) {
    let m = copie[0]
    for (const x of copie) if (x.att < m.att - 1e-9) m = x
    out.push(m.u)
    m.att += m.pas
  }
  return out
}

const retard = (u) => (u.etats.latence > 0 ? 0.4 : 0) - (u.etats.surcadence > 0 ? 0.35 : 0)

/**
 * Le coût de tempo d'une action, équipage compris.
 *
 * C'est **la** correction du mode solo, et elle est structurelle : face à deux
 * processus, un opérateur seul joue une action quand l'adversaire en joue deux.
 * Aucune quantité d'intégrité ni de dégâts ne rattrape un rapport d'actions —
 * on tient seulement plus longtemps en faisant toujours aussi peu. Seul, on
 * agit donc presque deux fois plus vite, ce qui rétablit le rythme au lieu de
 * le compenser.
 */
export const tempoDe = (u, comp) => comp.temps * (1 + retard(u)) * (u.seul ? SOLO.tempo : 1)

export function fini(c) {
  if (!vivants(c.ops).length) return 'perdu'
  if (!vivants(c.proc).length) return 'gagne'
  return null
}

// --- Ciblage ------------------------------------------------------------------------

/**
 * Les cibles légales d'une compétence. Le dessin et l'appui lisent cette même
 * fonction : une case qu'on peut toucher est une case qui s'allume, toujours.
 */
export function cibles(c, acteur, comp) {
  const allie = campDe(c, acteur)
  const ennemi = adverseDe(c, acteur)
  if (comp.forme === 'soi') return [acteur]
  if (comp.forme === 'equipe') return vivants(allie)
  if (comp.forme === 'allie') return vivants(allie)
  const front = frontDe(ennemi)
  const liste = vivants(ennemi)
  if (comp.contact && !perceAvec(acteur, comp)) return liste.filter((u) => u.rang === front)
  return liste
}

/** Ce qu'une action touche vraiment, une fois la cible choisie. */
export function touches(c, acteur, comp, cible) {
  const allie = campDe(c, acteur)
  const ennemi = adverseDe(c, acteur)
  if (comp.forme === 'soi') return [acteur]
  if (comp.forme === 'equipe') return vivants(allie)
  if (comp.forme === 'allie') return [cible]
  if (comp.forme === 'tous') return vivants(ennemi)
  if (comp.forme === 'rang') return vivants(ennemi).filter((u) => u.rang === cible.rang)
  return [cible]
}

// --- Dégâts ---------------------------------------------------------------------------

/**
 * Les multiplicateurs sont triés puis appliqués à rendement décroissant :
 * `∏ (1 + m_k / (k+1))`. Trois bonus de +30 % donnent ×1.64, pas ×2.20.
 * Une ligne, et l'empilement exponentiel disparaît — le défaut qui rendait
 * ASCENSION injouable.
 */
export function multiplie(bonus) {
  const tries = bonus.filter((m) => m > 0).sort((a, b) => b - a)
  return tries.reduce((m, v, k) => m * (1 + v / (k + 1)), 1)
}

export const blindageDe = (u) => Math.max(0, u.blindage - 2 * (u.etats.fragment ?? 0))

/**
 * La formule. Elle est publique et testée cas par cas : un joueur doit pouvoir
 * prédire un coup avant de le jouer, sinon il ne peut pas jouer.
 */
export function degats(c, acteur, comp, cible, { prime = 1 } = {}) {
  if (!comp.base) return 0
  const brut = comp.base * (1 + 0.1 * acteur.puiss) * multiplie(bonusDe(acteur, comp)) * prime
  const encaisse = 1 + 0.2 * (cible.etats.marque ?? 0)
  const rang = reducRang(c, comp, cible, acteur)
  const res = cible.resist ? (cible.resist[comp.type] ?? 0) : 0
  let apres = brut * rang * encaisse * (1 - res)

  // LOGIQUE ignore le blindage mais s'écrase sur un pare-feu ;
  // CORRUPTION ne passe pas par les dégâts directs du tout.
  if (comp.type === 'logique' && (cible.etats.pare ?? 0) > 0) apres *= 0.5
  const absorbe = comp.type === 'corruption' ? 0 : Math.min(apres, cible.etats.pare ?? 0)
  const blindage = comp.type === 'logique' || comp.type === 'corruption' ? 0 : blindageDe(cible)
  // Le plancher d'un point protège du blindage et des résistances, pas du
  // pare-feu : un pare-feu qui tient doit vraiment tout absorber, sinon il ne
  // sert qu'à ralentir et la classe qui le pose n'a plus de territoire.
  const restant = apres - absorbe
  const final = restant <= 0 ? 0 : Math.max(1, Math.round(restant - blindage))
  return { apres, absorbe, final }
}

/** Un greffon de module peut faire percer une famille entière de compétences. */
export const perceAvec = (acteur, comp) =>
  comp.perce || (acteur.mod ?? []).some((m) => m.greffe?.perce && comp.tags?.includes(m.greffe.tag))

function reducRang(c, comp, cible, acteur) {
  if (perceAvec(acteur ?? {}, comp)) return 1
  const camp = campDe(c, cible)
  if (cible.rang === frontDe(camp)) return 1
  return 0.6
}

/** Les bonus multiplicatifs de l'acteur, avant rendement décroissant. */
const bonusDe = (u, comp) => {
  // Une équipe de trois joue trois actions là où un opérateur seul n'en joue
  // qu'une. Lui donner de l'intégrité ne suffit donc pas : il tiendrait plus
  // longtemps en faisant toujours aussi peu, ce qui allonge le combat sans le
  // rendre gagnable. C'est la puissance de frappe par action qu'il faut
  // rattraper, et elle passe par le même rendement décroissant que le reste.
  const out = [u.seul ? SOLO.degats : 0, u.etats.surcadence > 0 ? 0.2 : 0]
  for (const m of u.mod ?? []) {
    if (m.greffe?.mult && comp?.tags?.includes(m.greffe.tag)) out.push(m.greffe.mult)
  }
  return out
}

// --- Résolution --------------------------------------------------------------------------

/** Coût réel d'une compétence, surcoût d'axe compris. */
export function cout(acteur, comp) {
  const affute = acteur.affute?.includes(comp.id) ? 1 : 0
  return Math.max(0, comp.cout + surcoutAxe(acteur, comp) - affute)
}

/** La recharge d'une compétence, affûtage compris. */
export const rechargeDe = (acteur, comp) => Math.max(0, comp.recharge - (acteur.affute?.includes(comp.id) ? 1 : 0))

/**
 * Le *n*-ième élément d'un même axe sur un opérateur coûte plus cher, et prend
 * plus de temps. Se spécialiser reste possible, mais se paie — c'est le
 * garde-fou qui empêche l'empilement de trois compétences de dégâts sur le
 * même porteur de devenir la seule stratégie du jeu.
 */
export function surcoutAxe(acteur, comp) {
  if (!acteur.comp) return 0
  const memes = acteur.comp.filter((id) => COMP[id]?.axe === comp.axe).length
  return Math.max(0, memes - 2)
}

export function jouable(c, acteur, comp, k) {
  if (!comp) return false
  if (acteur.rech?.[k] > 0) return false
  if (estOperateur(c, acteur) && cout(acteur, comp) > c.cycles) return false
  if (!estOperateur(c, acteur) && acteur.etats.silence > 0 && comp.id !== acteur.comp[0]) return false
  return cibles(c, acteur, comp).length > 0
}

/**
 * Joue une action, du joueur ou de l'adversaire. Retourne le compte rendu, qui
 * sert à la fois au journal de combat et aux assertions des tests.
 */
export function joue(c, acteur, k, cible) {
  const comp = COMP[acteur.comp[k]]
  const joueur = estOperateur(c, acteur)
  const prime = chaine(c, comp, joueur)
  const buts = touches(c, acteur, comp, cible)
  const rapport = { acteur: acteur.nom, comp: comp.nom, coups: [], prime: prime > 1 }

  if (joueur) c.cycles -= cout(acteur, comp)
  acteur.rech[k] = rechargeDe(acteur, comp)

  for (const but of buts) {
    // Un CACHE consomme l'attaque entière, pas une pile de dégâts.
    if (comp.base && but.etats.cache > 0 && campDe(c, but) !== campDe(c, acteur)) {
      but.etats.cache--
      if (!but.etats.cache) delete but.etats.cache
      rapport.coups.push({ sur: but.nom, esquive: true })
      continue
    }
    let total = 0
    const repets = comp.consomme ? Math.max(1, but.etats[comp.consomme] ?? 0) : 1
    for (let r = 0; r < repets; r++) {
      const d = degats(c, acteur, comp, but, { prime })
      if (!d) break
      total += encaisse(but, d)
    }
    if (comp.consomme) delete but.etats[comp.consomme]
    if (comp.soin) soigne(but, comp.soin + acteur.puiss)
    if (comp.blinde) applique(but, 'pare', comp.blinde)
    if (comp.fuite) applique(but, 'fuite', comp.fuite)
    for (const e of comp.etats ?? []) {
      const sur = e.sur === 'soi' ? acteur : but
      applique(sur, e.q, e.n)
    }
    if (comp.bascule) but.rang = but.rang === 0 ? 1 : 0
    rapport.coups.push({ sur: but.nom, degats: total })
  }

  if (comp.avance) acteur.rang = 0
  if (comp.cycles) c.cycles = Math.min(c.cyclesMax, c.cycles + comp.cycles)
  if (joueur) {
    bus(c, acteur, comp, buts)
    monteTracage(c, acteur, comp)
  }

  finTour(c, acteur, comp)
  // Le repérage est une conséquence de l'action, pas une case à cocher par
  // l'appelant : le mettre ici, c'est s'assurer qu'aucune vue ni aucun banc ne
  // puisse l'oublier et rouvrir la porte aux combats sans fin.
  rapport.repere = repere(c)
  c.journal.push(rapport)
  if (c.journal.length > 24) c.journal.shift()
  return rapport
}

/** Applique les dégâts en mangeant d'abord le pare-feu. Retourne ce qui a été infligé. */
function encaisse(but, d) {
  if (d.absorbe > 0) but.etats.pare = Math.max(0, (but.etats.pare ?? 0) - d.absorbe)
  if (!but.etats.pare) delete but.etats.pare
  but.pv = Math.max(0, but.pv - d.final)
  changePhase(but)
  return d.final
}

/**
 * Un noyau à phases change de profil de résistance à mesure qu'il tombe : ce
 * qui l'a entamé ne l'entame plus. Une seule façon de frapper ne suffit pas à
 * le descendre, et c'est ce qui fait qu'une équipe mono-type se heurte
 * réellement à quelque chose — sans qu'aucune règle ne le lui interdise.
 */
function changePhase(u) {
  if (!u.phases) return
  const part = u.pv / u.pvMax
  const phase = u.phases.filter((p) => part <= p.seuil).at(-1) ?? u.phases[0]
  if (u.phase === phase) return
  u.phase = phase
  u.resist = phase.resist
}

const soigne = (u, n) => (u.pv = Math.min(u.pvMax, u.pv + n))

/** Rafraîchit jusqu'au plafond, n'additionne jamais au-delà. */
export function applique(u, id, n) {
  const e = ETAT[id]
  if (!e) return
  const avant = u.etats[id] ?? 0
  u.etats[id] = Math.min(e.plafond, e.duree ? Math.max(avant, n) : avant + n)
}

function chaine(c, comp, joueur) {
  if (!joueur) return 1
  const tag = CHAINE_TAGS.find((t) => comp.tags?.includes(t))
  if (!tag) return 1
  if (c.chaine.includes(tag)) return 1
  c.chaine.push(tag)
  if (c.chaine.length < 3) return 1
  c.chaine = []
  return CHAINE_PRIME
}

/**
 * Le bus de tags : chaque module écoute un tag et agit quand il passe.
 *
 * Trente lignes pour brancher tous les modules du jeu. C'est ce qui fait qu'un
 * assemblage vaut plus que la somme de ses parts sans qu'aucune combinaison
 * n'ait été écrite à la main — et donc sans qu'aucune ne puisse être oubliée
 * dans l'équilibrage.
 */
function bus(c, acteur, comp, buts) {
  for (const m of acteur.mod ?? []) {
    if (!m.ecoute || !comp.tags?.includes(m.ecoute)) continue
    if (m.cycles) c.cycles = Math.min(c.cyclesMax, c.cycles + m.cycles)
    if (m.pare) applique(acteur, 'pare', m.pare)
    if (m.pareEquipe) for (const o of vivants(c.ops)) applique(o, 'pare', m.pareEquipe)
    if (m.soinSoi) acteur.pv = Math.min(acteur.pvMax, acteur.pv + m.soinSoi)
    if (m.tracage) c.tracage = Math.max(plancherTracage(c), c.tracage + m.tracage)
    if (m.marque) for (const b of buts) if (!estOperateur(c, b)) applique(b, 'marque', m.marque)
  }
  // Le greffon de corruption allonge les fuites posées par cette action.
  for (const m of acteur.mod ?? []) {
    if (!m.greffe?.fuite || !comp.tags?.includes(m.greffe.tag)) continue
    for (const b of buts) if (b.etats.fuite) applique(b, 'fuite', m.greffe.fuite)
  }
}

function monteTracage(c, acteur, comp) {
  const regle = c.regles.includes('tracage') ? 2 : 1
  const mods = (acteur.mod ?? []).reduce((k, m) => k * (m.tracageMult ?? 1), 1)
  c.tracage = Math.min(TRACAGE_MAX, c.tracage + (comp.cout * 3 + 2) * regle * mods)
}

/** Le tempo. Une PRIORITÉ le rend gratuit une fois. */
function finTour(c, acteur, comp) {
  if (acteur.etats.priorite > 0) {
    acteur.etats.priorite--
    if (!acteur.etats.priorite) delete acteur.etats.priorite
  } else {
    acteur.att += (100 * tempoDe(acteur, comp)) / acteur.vit
  }
  decompte(acteur)
  if (acteur.etats.regenere > 0) soigne(acteur, 5)
  normalise(c)
  c.tour++
}

/** Les états à durée s'usent d'un tour ; les quantités, elles, restent. */
function decompte(u) {
  for (const id of Object.keys(u.etats)) {
    if (!ETAT[id]?.duree) continue
    u.etats[id]--
    if (u.etats[id] <= 0) delete u.etats[id]
  }
}

/** On ramène la file à zéro pour que les nombres restent lisibles et stables. */
function normalise(c) {
  const tous = [...vivants(c.ops), ...vivants(c.proc)]
  if (!tous.length) return
  const min = Math.min(...tous.map((u) => u.att))
  for (const u of [...c.ops, ...c.proc]) u.att -= min
}

// --- Le tour d'un camp ------------------------------------------------------------------

/**
 * Ce qui arrive quand un opérateur prend la main : il récupère des cycles, les
 * fuites tombent, et le traçage redescend un peu.
 */
export function ouvreTour(c, acteur) {
  // La fuite ronge celui qui prend la main, **quel que soit son camp**. Écrite
  // au départ comme une boucle sur les seuls processus, elle rendait tout le
  // type CORRUPTION inoffensif contre les opérateurs : un noyau bâti dessus a
  // tenu trente-neuf tours sans blesser personne. Une règle qui ne vaut que
  // pour un camp est une règle qu'on ne peut pas apprendre.
  if (acteur.etats.fuite > 0) {
    acteur.pv = Math.max(0, acteur.pv - acteur.etats.fuite)
    acteur.etats.fuite--
    if (!acteur.etats.fuite) delete acteur.etats.fuite
  }

  if (estOperateur(c, acteur)) {
    c.cycles = Math.min(c.cyclesMax, c.cycles + (c.parTour ?? CYCLES_TOUR))
    return
  }
  // Après le tour d'un processus, la chaîne du joueur est rompue.
  c.chaine = []
  c.tracage = Math.max(plancherTracage(c), c.tracage - TRACAGE_DECRUE)
}

/** Passer son tour : ça coûte du tempo, et ça ne met pas le traçage en pause. */
export function passe(c, u) {
  u.att += 100 / u.vit
  c.tour++
  return repere(c)
}

/** Décrémente les recharges d'un combattant qui vient de reprendre la main. */
export function recharge(u) {
  u.rech = u.rech.map((r) => Math.max(0, r - 1))
}

/**
 * Le plancher du traçage, qui monte avec la durée du combat.
 *
 * Sans lui, la décrue est plus rapide que la montée dès qu'on joue peu, et il
 * existe des impasses réelles : le banc en a trouvé une, un TISSEUR seul qui se
 * soignait plus vite qu'un TAMPON ne le blessait, pour toujours. Avec ce
 * plancher, **rester est impossible** — c'est la version mécanique de « plus on
 * traîne dans un système, plus on s'y fait voir », et c'est ce qui garantit
 * qu'aucun combat ne dure indéfiniment.
 */
export const plancherTracage = (c) => Math.min(TRACAGE_MAX, Math.floor(c.tour / TRACAGE_PALIER) * TRACAGE_MARCHE)

/**
 * Le traçage arrive à cent : le système a repéré l'intrusion. Tous les
 * processus jouent un tour gratuit. C'est la soupape qui punit toute stratégie
 * gagnant en durant — pare-feux empilés, régénération, esquive éternelle — et
 * qui rend impossible la boucle défensive infinie.
 */
export function repere(c) {
  if (c.tracage < plancherTracage(c)) c.tracage = plancherTracage(c)
  if (c.tracage < TRACAGE_MAX) return false
  c.tracage = TRACAGE_RETOMBE
  for (const p of vivants(c.proc)) p.att = 0
  // Et le repérage **fait mal**, de plus en plus.
  //
  // Rendre la main aux processus ne suffit pas : le banc a trouvé une impasse
  // où un processus repéré passait son tour à se re-blinder pendant que
  // l'équipe ne pouvait plus l'entamer — neuf cents tours sans une égratignure
  // des deux côtés. Une purge qui ignore blindage, pare-feu et résistances
  // rend toute impasse mortelle pour l'intrus, ce qui est le bon sens de la
  // fiction autant que la garantie qu'un combat se termine.
  const purge = Math.max(2, Math.round((3 + Math.floor(c.tour / 30)) / (c.seul ? 2 : 1)))
  for (const o of vivants(c.ops)) o.pv = Math.max(0, o.pv - purge)
  return true
}

export function prevoit(c) {
  const fenetre = new Set(file(c, FILE_VUE))
  for (const p of vivants(c.proc)) {
    if (!fenetre.has(p)) p.intent = null
    else if (p.intent == null) p.intent = 0
  }
}
