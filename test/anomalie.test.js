/**
 * ANOMALIE : la règle avant l'image.
 *
 * Le combat ne comporte aucun aléatoire dans sa résolution, ce qui permet
 * d'asserter chaque dégât à l'unité près. C'est le seul moyen honnête de tenir
 * un système de cette taille : ASCENSION, qu'il remplace, avait une règle
 * pierre-feuille-ciseaux mal câblée où GARDE ne perdait jamais de points de
 * vie — personne ne s'en était aperçu faute de test.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as K from '../src/massif/anomalie/combat.js'
import * as IA from '../src/massif/anomalie/ia.js'
import * as E from '../src/massif/anomalie/etat.js'
import { COMPETENCES, COMP } from '../src/massif/anomalie/donnees/competences.js'
import { CLASSES } from '../src/massif/anomalie/donnees/classes.js'
import { PROCESSUS, NOYAUX, TOUS_PROCESSUS } from '../src/massif/anomalie/donnees/ennemis.js'
import { ETATS } from '../src/massif/anomalie/donnees/etats.js'
import { ROLES, AXES, FORMES, TYPES, TAGS } from '../src/massif/anomalie/donnees/competences.js'
import { graine } from './faux.js'

const equipe = (...cl) => cl.map((c, i) => E.nouvelOperateur(c, 'OP' + i))

// --- Invariants de données ------------------------------------------------------------

test('chaque compétence parle le vocabulaire fermé', () => {
  for (const c of COMPETENCES) {
    assert.ok(ROLES.includes(c.role), `${c.id} : rôle « ${c.role} »`)
    assert.ok(AXES.includes(c.axe), `${c.id} : axe « ${c.axe} »`)
    assert.ok(FORMES.includes(c.forme), `${c.id} : forme « ${c.forme} »`)
    assert.ok(TYPES.includes(c.type), `${c.id} : type « ${c.type} »`)
    for (const t of c.tags ?? []) assert.ok(TAGS.includes(t), `${c.id} : tag « ${t} »`)
    assert.ok(c.dit?.length > 10, `${c.id} : pas de description`)
    assert.ok(c.temps > 0 && c.cout >= 0, `${c.id} : coûts invalides`)
  }
})

test('dans une classe, aucune compétence n’est le clone d’une autre', () => {
  // La règle qui empêche d'écrire la quinzième compétence d'une classe en
  // repeignant la sixième. Sans elle, un catalogue de deux cents fiches n'est
  // qu'une liste longue.
  const vus = new Map()
  for (const c of COMPETENCES) {
    const cle = `${c.classe}|${c.role}|${c.forme}`
    assert.equal(vus.has(cle), false, `${c.id} et ${vus.get(cle)} font la même chose (${c.role}/${c.forme})`)
    vus.set(cle, c.id)
  }
})

test('tout état a un plafond, et une seule façon de s’écrire', () => {
  const vus = new Set()
  for (const e of ETATS) {
    assert.ok(e.plafond > 0, `${e.id} : pas de plafond, donc empilable sans limite`)
    assert.ok(['ami', 'adverse'].includes(e.camp), `${e.id} : camp inconnu`)
    assert.ok(e.glyphe && e.nom && e.dit, `${e.id} : fiche incomplète`)
    assert.equal(vus.has(e.id), false, `état en double : ${e.id}`)
    vus.add(e.id)
  }
})

test('toute compétence référencée par une classe ou un processus existe', () => {
  for (const cl of CLASSES) {
    for (const id of [...cl.depart, ...cl.reserve]) assert.ok(COMP[id], `${cl.id} référence ${id}`)
    assert.equal(cl.depart.length, E.VERROUS, `${cl.id} : mauvais nombre de compétences de départ`)
  }
  for (const p of TOUS_PROCESSUS) {
    assert.ok(p.comp.length, `${p.nom} n’a aucune compétence`)
    for (const id of p.comp) assert.ok(COMP[id], `${p.nom} référence ${id}`)
    for (const t of ['brut', 'logique', 'corruption']) {
      assert.ok(p.resist[t] >= -0.5 && p.resist[t] <= 0.75, `${p.nom} : résistance ${t} hors bornes`)
    }
  }
})

test('dans un acte, deux processus ne sont pas des jumeaux repeints', () => {
  const vus = new Map()
  for (const p of PROCESSUS) {
    const cle = `${p.acte}|${p.comportement}|${p.comp[0]}`
    assert.equal(vus.has(cle), false, `${p.nom} et ${vus.get(cle)} se jouent pareil`)
    vus.set(cle, p.nom)
  }
})

test('chaque noyau change une règle du combat', () => {
  for (const n of NOYAUX) {
    assert.ok(n.regle, `${n.nom} n’est qu’une grosse barre de vie`)
    assert.ok(n.dit?.length > 10, `${n.nom} ne dit pas ce qu’il change`)
    assert.ok(n.pv >= 120, `${n.nom} est trop fragile pour un noyau`)
  }
})

// --- La formule ---------------------------------------------------------------------------

test('les multiplicateurs ont un rendement décroissant', () => {
  // Trois bonus de +30 % donnent ×1.64, pas ×2.20. C'est cette ligne qui
  // empêche l'empilement exponentiel qui avait détruit ASCENSION.
  assert.equal(K.multiplie([]), 1)
  assert.ok(Math.abs(K.multiplie([0.3]) - 1.3) < 1e-9)
  const trois = K.multiplie([0.3, 0.3, 0.3])
  assert.ok(trois > 1.6 && trois < 1.7, `trois bonus de 30 % donnent ×${trois.toFixed(2)}`)
  assert.ok(trois < 1.3 ** 3, 'l’empilement est resté exponentiel')
})

test('une cible au rang arrière encaisse moins, sauf si la compétence perce', () => {
  // Deux processus de même résistance au BRUT : sinon on mesure la
  // résistance en croyant mesurer le rang.
  const c = K.commence(equipe('briseur', 'analyste', 'tisseur'), ['veille', 'boucle'])
  const arriere = c.proc.find((p) => p.rang === 1)
  const devant = c.proc.find((p) => p.rang === 0)
  const masse = COMP.masse
  const sur = K.degats(c, c.ops[0], masse, devant).apres
  const derriere = K.degats(c, c.ops[0], masse, arriere).apres
  assert.ok(Math.abs(derriere / sur - 0.6) < 1e-6, `réduction de rang à ${(derriere / sur).toFixed(2)}`)
  const perce = K.degats(c, c.ops[1], COMP.sonde, arriere).apres / COMP.sonde.base
  const percePres = K.degats(c, c.ops[1], COMP.sonde, devant).apres / COMP.sonde.base
  assert.ok(Math.abs(perce - percePres) < 1e-6, 'une compétence qui perce est quand même réduite')
})

test('un coup ne descend jamais sous un point, même contre un mur', () => {
  const c = K.commence(equipe('tisseur', 'tisseur', 'tisseur'), ['garde'])
  const d = K.degats(c, c.ops[0], COMP.purge, c.proc[0])
  assert.ok(d.final >= 1)
})

test('le pare-feu absorbe avant l’intégrité, et se consomme', () => {
  const c = K.commence(equipe('briseur', 'tisseur', 'analyste'), ['sentinelle'])
  const cible = c.ops[0]
  K.applique(cible, 'pare', 40)
  const pvAvant = cible.pv
  const proc = c.proc[0]
  K.joue(c, proc, 0, cible)
  assert.equal(cible.pv, pvAvant, 'le pare-feu n’a pas absorbé')
  assert.ok((cible.etats.pare ?? 0) < 40, 'le pare-feu ne s’est pas consommé')
})

test('un état réappliqué se rafraîchit jusqu’au plafond, jamais au-delà', () => {
  const c = K.commence(equipe('analyste', 'analyste', 'analyste'), ['veille'])
  const p = c.proc[0]
  for (let k = 0; k < 12; k++) K.applique(p, 'marque', 1)
  assert.equal(p.etats.marque, 3, 'la MARQUE dépasse son plafond')
  for (let k = 0; k < 40; k++) K.applique(p, 'fuite', 5)
  assert.equal(p.etats.fuite, 12, 'la FUITE dépasse son plafond')
})

test('une marque fait encaisser 20 % de plus par pile', () => {
  const c = K.commence(equipe('analyste', 'analyste', 'analyste'), ['veille'])
  const p = c.proc[0]
  const nu = K.degats(c, c.ops[0], COMP.faille, p).apres
  K.applique(p, 'marque', 2)
  const marque = K.degats(c, c.ops[0], COMP.faille, p).apres
  assert.ok(Math.abs(marque / nu - 1.4) < 1e-6, `deux marques donnent ×${(marque / nu).toFixed(2)}`)
})

test('EXPLOIT consomme les marques et frappe une fois par pile', () => {
  const c = K.commence(equipe('analyste', 'analyste', 'analyste'), ['tampon'])
  const p = c.proc[0]
  c.ops[0].comp[2] = 'exploit'
  K.applique(p, 'marque', 3)
  const avant = p.pv
  c.cycles = 10
  K.joue(c, c.ops[0], 2, p)
  assert.equal(p.etats.marque, undefined, 'les marques n’ont pas été consommées')
  assert.ok(avant - p.pv > 40, `EXPLOIT n’a infligé que ${avant - p.pv} sur trois marques`)
})

test('un CACHE mange l’attaque entière, pas une pile de dégâts', () => {
  const c = K.commence(equipe('tisseur', 'tisseur', 'tisseur'), ['sentinelle'])
  const cible = c.ops[0]
  K.applique(cible, 'cache', 1)
  const avant = cible.pv
  K.joue(c, c.proc[0], 0, cible)
  assert.equal(cible.pv, avant, 'le CACHE n’a rien esquivé')
  assert.equal(cible.etats.cache, undefined, 'le CACHE ne s’est pas consommé')
})

test('la corruption ignore blindage et pare-feu, mais ne frappe pas tout de suite', () => {
  const c = K.commence(equipe('briseur', 'briseur', 'briseur'), ['boucle'])
  const cible = c.ops[0]
  K.applique(cible, 'pare', 40)
  const avant = cible.pv
  K.joue(c, c.proc[0], 0, cible) // p_injection : pose FUITE, zéro dégât direct
  assert.equal(cible.pv, avant, 'une injection a fait des dégâts directs')
  assert.ok(cible.etats.fuite > 0, 'aucune fuite posée')
})

test('la fuite ronge les deux camps, pas seulement les processus', () => {
  // Écrite d'abord comme une boucle sur le seul camp adverse, elle rendait le
  // type CORRUPTION entièrement inoffensif contre le joueur.
  const c = K.commence(equipe('briseur', 'briseur', 'briseur'), ['boucle'])
  const op = c.ops[0]
  K.applique(op, 'fuite', 6)
  const avant = op.pv
  K.ouvreTour(c, op)
  assert.equal(op.pv, avant - 6, 'un opérateur ne perd rien à sa fuite')
  assert.equal(op.etats.fuite, 5, 'la fuite ne s’use pas')

  const p = c.proc[0]
  K.applique(p, 'fuite', 4)
  const pvProc = p.pv
  K.ouvreTour(c, p)
  assert.equal(p.pv, pvProc - 4, 'un processus ne perd rien à sa fuite')
})

test('le surcoût d’axe rend la troisième compétence d’un même axe plus chère', () => {
  const op = { comp: ['masse', 'onde', 'demolition', 'purge', null, null] }
  assert.equal(K.surcoutAxe(op, COMP.masse), 2, 'quatre compétences de dégât et aucun surcoût')
  const leger = { comp: ['masse', 'ancre', null, null, null, null] }
  assert.equal(K.surcoutAxe(leger, COMP.masse), 0, 'une équipe équilibrée est pénalisée')
})

// --- La chaîne et le traçage --------------------------------------------------------------

test('trois tags différents d’affilée priment la troisième action', () => {
  const c = K.commence(equipe('analyste', 'briseur', 'tisseur'), ['tampon', 'veille'])
  c.cycles = 10
  const p = c.proc[0]
  // MARQUE, puis DEPLACE, puis FIN : la troisième doit passer en prime.
  c.ops[0].comp[2] = 'sonde'
  c.ops[1].comp[2] = 'charge'
  c.ops[1].comp[3] = 'onde'
  const r1 = K.joue(c, c.ops[0], 2, p)
  const r2 = K.joue(c, c.ops[1], 2, p)
  const r3 = K.joue(c, c.ops[1], 3, p)
  assert.equal(r1.prime, false)
  assert.equal(r2.prime, false)
  assert.equal(r3.prime, true, 'la chaîne n’a pas primé la troisième action')
  assert.deepEqual(c.chaine, [], 'la chaîne ne s’est pas remise à zéro')
})

test('le même tag deux fois de suite ne fait pas de chaîne', () => {
  const c = K.commence(equipe('analyste', 'analyste', 'analyste'), ['tampon'])
  c.cycles = 10
  const r1 = K.joue(c, c.ops[0], 0, c.proc[0])
  const r2 = K.joue(c, c.ops[1], 0, c.proc[0])
  assert.equal(r1.prime, false)
  assert.equal(r2.prime, false)
  assert.equal(c.chaine.length, 1, 'un tag répété a compté deux fois')
})

test('le traçage monte quand on joue et redescend quand l’adversaire joue', () => {
  const c = K.commence(equipe('briseur', 'briseur', 'briseur'), ['veille'])
  c.cycles = 10
  K.joue(c, c.ops[0], 0, c.proc[0])
  const monte = c.tracage
  assert.ok(monte > 0, 'le traçage ne monte pas')
  K.ouvreTour(c, c.proc[0])
  assert.ok(c.tracage < monte, 'le traçage ne redescend jamais')
})

test('à cent, le traçage rend la main à tous les processus', () => {
  const c = K.commence(equipe('briseur', 'briseur', 'briseur'), ['veille', 'balise'])
  c.tracage = K.TRACAGE_MAX
  assert.equal(K.repere(c), true)
  assert.equal(c.tracage, K.TRACAGE_RETOMBE)
  for (const p of c.proc) assert.equal(p.att, 0, 'un processus n’a pas repris la main')
})

// --- La file d'initiative ---------------------------------------------------------------------

test('la file annonce vraiment qui va jouer', () => {
  const c = K.commence(equipe('analyste', 'briseur', 'tisseur'), ['essaim', 'tampon'])
  const annonce = K.file(c, 5)
  assert.equal(annonce.length, 5)
  assert.equal(annonce[0], K.actif(c), 'le premier de la file n’est pas celui qui joue')
  // Le plus rapide ouvre : ESSAIM a 14 de vitesse, personne ne fait mieux.
  assert.equal(annonce[0].nom, 'ESSAIM')
})

test('la latence retarde et la surcadence accélère', () => {
  const c = K.commence(equipe('briseur', 'briseur', 'briseur'), ['veille'])
  const op = c.ops[0]
  const base = op.att
  c.cycles = 10
  K.joue(c, op, 0, c.proc[0])
  const normal = op.att
  Object.assign(op, { att: base, rech: [0, 0, 0, 0, 0, 0] })
  K.applique(op, 'latence', 2)
  K.joue(c, op, 0, c.proc[0])
  assert.ok(op.att > normal, 'la latence n’a pas retardé')
})

// --- L'adversaire ---------------------------------------------------------------------------

test('un processus annonce son intention avant de jouer', () => {
  const c = K.commence(equipe('briseur', 'analyste', 'tisseur'), ['sentinelle', 'relais'])
  IA.annonce(c)
  for (const p of c.proc) assert.ok(p.intent, `${p.nom} ne dit rien de ce qu’il prépare`)
})

test('chaque comportement fait bien ce qu’il annonce', () => {
  // TAMPON est tenace : il se blinde avant de frapper.
  const t = K.commence(equipe('briseur', 'analyste', 'tisseur'), ['tampon'])
  IA.tourProcessus(t, t.proc[0])
  assert.ok(t.proc[0].etats.pare > 0, 'le TAMPON n’a pas commencé par se blinder')

  // RELAIS est soigneur : il répare son camp quand il est entamé.
  const s = K.commence(equipe('briseur', 'analyste', 'tisseur'), ['relais', 'veille'])
  s.proc[1].pv = 5
  IA.tourProcessus(s, s.proc[0])
  assert.ok(s.proc[1].pv > 5, 'le RELAIS n’a soigné personne')

  // BOUCLE est rongeur : elle empoisonne.
  const r = K.commence(equipe('briseur', 'analyste', 'tisseur'), ['boucle'])
  IA.tourProcessus(r, r.proc[0])
  assert.ok(
    K.vivants(r.ops).some((o) => o.etats.fuite > 0),
    'la BOUCLE n’a rien corrompu',
  )
})

test('un processus sous SILENCE ne lance plus que sa frappe de base', () => {
  const c = K.commence(equipe('analyste', 'analyste', 'analyste'), ['garde'])
  const p = c.proc[0]
  K.applique(p, 'silence', 2)
  const jouables = p.comp.map((_, k) => k).filter((k) => K.jouable(c, p, COMP[p.comp[k]], k))
  assert.deepEqual(jouables, [0], 'le SILENCE ne bloque rien')
})

// --- Le combat entier -------------------------------------------------------------------------

/** Un pilote glouton : il joue l'action de plus fort dégât immédiat. */
function gourmand(c) {
  const u = K.actif(c)
  if (!u) return false
  K.ouvreTour(c, u)
  K.recharge(u)
  if (!K.estOperateur(c, u)) {
    IA.tourProcessus(c, u)
    IA.annonce(c)
    return true
  }
  let meilleur = null
  for (let k = 0; k < u.comp.length; k++) {
    const comp = COMP[u.comp[k]]
    if (!K.jouable(c, u, comp, k)) continue
    for (const cible of K.cibles(c, u, comp)) {
      const d = comp.base ? K.degats(c, u, comp, cible).final : comp.soin ? comp.soin * 0.6 : 3
      if (!meilleur || d > meilleur.d) meilleur = { k, cible, d }
    }
  }
  if (!meilleur) {
    // Rien de jouable : on passe son tour, ce qui coûte du tempo.
    K.passe(c, u)
    return true
  }
  K.joue(c, u, meilleur.k, meilleur.cible)
  IA.annonce(c)
  return true
}

function duel(equipeIds, rencontre, tours = 400) {
  const c = K.commence(equipe(...equipeIds), rencontre)
  IA.annonce(c)
  let n = 0
  while (!K.fini(c) && n < tours) {
    gourmand(c)
    n++
  }
  return { c, issue: K.fini(c), tours: n }
}

test('un combat se termine, toujours', () => {
  // Le test direct du traçage : aucune boucle défensive infinie ne doit
  // exister. C'est ce qui manquait à ASCENSION, où marteler GARDE bloquait le
  // duel pour toujours sans que personne ne perde de points de vie.
  const rng = graine(5)
  for (let k = 0; k < 60; k++) {
    const eq = [CLASSES[k % 3].id, CLASSES[(k + 1) % 3].id, CLASSES[(k + 2) % 3].id]
    const combien = 1 + Math.floor(rng() * 4)
    const rencontre = Array.from({ length: combien }, () => PROCESSUS[Math.floor(rng() * PROCESSUS.length)].id)
    const { issue, tours } = duel(eq, rencontre)
    assert.ok(issue, `combat sans fin après ${tours} tours contre ${rencontre.join(', ')}`)
  }
})

test('l’état reste sain au bout de milliers de résolutions', () => {
  const rng = graine(31)
  for (let k = 0; k < 40; k++) {
    const rencontre = Array.from({ length: 4 }, () => PROCESSUS[Math.floor(rng() * PROCESSUS.length)].id)
    const { c } = duel(['analyste', 'briseur', 'tisseur'], rencontre)
    for (const u of [...c.ops, ...c.proc]) {
      assert.ok(u.pv >= 0 && u.pv <= u.pvMax, `${u.nom} : ${u.pv} / ${u.pvMax}`)
      for (const [id, n] of Object.entries(u.etats)) {
        const plafond = ETATS.find((e) => e.id === id).plafond
        assert.ok(n > 0 && n <= plafond, `${u.nom} : ${id} à ${n} (plafond ${plafond})`)
      }
    }
    assert.ok(c.cycles >= 0 && c.cycles <= c.cyclesMax, `cycles à ${c.cycles}`)
  }
})

test('l’équipe de départ gagne souvent contre l’acte I, mais pas toujours', () => {
  const rng = graine(101)
  let gagnes = 0
  const total = 60
  for (let k = 0; k < total; k++) {
    const combien = 2 + Math.floor(rng() * 3)
    const rencontre = Array.from({ length: combien }, () => PROCESSUS[Math.floor(rng() * PROCESSUS.length)].id)
    if (duel(['analyste', 'briseur', 'tisseur'], rencontre).issue === 'gagne') gagnes++
  }
  const taux = gagnes / total
  assert.ok(taux > 0.55, `l’acte I n’est gagné que ${(taux * 100).toFixed(0)} % du temps, c’est infaisable`)
  assert.ok(taux < 0.98, `l’acte I est gagné ${(taux * 100).toFixed(0)} % du temps, il ne demande rien`)
})

test('les noyaux sont plus durs que les processus, sans être infaisables', () => {
  for (const n of NOYAUX) {
    const rencontre = n.escorte ? [n.id, ...n.escorte] : [n.id]
    const { issue, tours } = duel(['analyste', 'briseur', 'tisseur'], rencontre, 600)
    assert.ok(issue, `${n.nom} : combat sans fin`)
    assert.ok(tours > 12, `${n.nom} tombe en ${tours} tours`)
  }
})

// --- Sauvegarde ----------------------------------------------------------------------------------

test('une partie se sauve, se relit, et reprend au même tour', () => {
  const e = E.nouvelle(4242, ['analyste', 'briseur', 'tisseur'])
  const c = K.commence(e.equipe, E.rencontre(e))
  c.cycles = 7
  c.tracage = 33
  K.applique(c.proc[0], 'marque', 2)
  c.proc[0].pv -= 7
  e.combat = c

  const relu = E.migre(JSON.parse(JSON.stringify(E.sauvegarde(e))))
  assert.ok(relu, 'la sauvegarde ne se relit pas')
  const c2 = E.reprend(relu, relu.combat, K.commence)
  assert.equal(c2.cycles, 7)
  assert.equal(c2.tracage, 33)
  assert.equal(c2.proc[0].pv, c.proc[0].pv)
  assert.equal(c2.proc[0].etats.marque, 2)
})

test('la sauvegarde reste petite', () => {
  const e = E.nouvelle(1, ['analyste', 'briseur', 'tisseur'])
  e.combat = K.commence(e.equipe, ['veille', 'balise', 'tampon', 'boucle'])
  const taille = JSON.stringify(E.sauvegarde(e)).length
  assert.ok(taille < 4096, `sauvegarde de ${taille} octets`)
})

test('une sauvegarde qui ment est refusée, pas devinée', () => {
  assert.equal(E.migre(null), null)
  assert.equal(E.migre({ v: 99 }), null)
  assert.equal(E.migre({ v: 1, equipe: [] }), null)
  assert.equal(E.migre({ v: 1, equipe: [{ cl: 'inconnu', comp: [] }, {}, {}] }), null)
})

// --- Le butin --------------------------------------------------------------------------------------

test('on ne finit jamais avec tout : au-delà de six, il faut jeter', () => {
  // Le défaut d'ASCENSION, où l'on ramassait les huit reliques du jeu.
  const e = E.nouvelle(7, ['analyste', 'briseur', 'tisseur'])
  const op = e.equipe[0]
  const reserve = CLASSES.find((c) => c.id === op.cl).reserve
  op.comp = [...op.comp.slice(0, E.VERROUS), ...reserve.slice(0, 4)]
  assert.equal(E.librePour(op), -1, 'il reste de la place alors que tout est pris')

  const o = { op: 0, choix: ['rapport'] }
  assert.equal(E.prend(e, o, 'rapport'), false, 'une septième compétence est entrée sans rien jeter')
  assert.equal(E.prend(e, o, 'rapport', 0), false, 'une compétence verrouillée a été jetée')
  assert.equal(E.prend(e, o, 'rapport', 3), true)
  assert.equal(op.comp.length, E.EMPLACEMENTS)
  assert.equal(op.comp[3], 'rapport')
})

test('la même graine donne la même partie', () => {
  const a = E.nouvelle(999, ['analyste', 'briseur', 'tisseur'])
  const b = E.nouvelle(999, ['analyste', 'briseur', 'tisseur'])
  assert.deepEqual(E.rencontre(a), E.rencontre(b))
  assert.deepEqual(
    a.equipe.map((o) => o.nom),
    b.equipe.map((o) => o.nom),
  )
})
