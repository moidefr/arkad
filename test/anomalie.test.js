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
import * as Carte from '../src/massif/anomalie/carte.js'
import { ANTAGONISTES } from '../src/massif/anomalie/donnees/modules.js'
import * as SF from '../src/massif/anomalie/sansfin.js'
import { PROC } from '../src/massif/anomalie/donnees/ennemis.js'
import { graine } from './faux.js'

const equipe = (...cl) => cl.map((c, i) => E.nouvelOperateur(c, 'OP' + i))

/**
 * Une équipe telle qu'elle est *à la fin d'un acte* : deux compétences de plus
 * par opérateur, ramassées en chemin. Mesurer un noyau contre l'équipement du
 * tout premier nœud ne dit rien — on n'affronte jamais un noyau dans cet état.
 */
const equipeGarnie = (...cl) =>
  cl.map((c, i) => {
    const op = E.nouvelOperateur(c, 'OP' + i)
    const reserve = CLASSES.find((x) => x.id === c).reserve
    op.comp[2] = reserve[0]
    op.comp[3] = reserve[1]
    return op
  })

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

function duel(equipeIds, rencontre, tours = 400, garnie = false) {
  const c = K.commence(garnie ? equipeGarnie(...equipeIds) : equipe(...equipeIds), rencontre)
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
  // Contre le bassin de l'acte I seulement : y jeter les processus du
  // cinquième acte ne mesurerait rien d'utile.
  const bassin = PROCESSUS.filter((p) => Carte.acteDe(1).bassin.includes(p.id))
  const rng = graine(101)
  let gagnes = 0
  const total = 60
  for (let k = 0; k < total; k++) {
    const combien = 2 + Math.floor(rng() * 3)
    const rencontre = Array.from({ length: combien }, () => bassin[Math.floor(rng() * bassin.length)].id)
    if (duel(['analyste', 'briseur', 'tisseur'], rencontre).issue === 'gagne') gagnes++
  }
  const taux = gagnes / total
  assert.ok(taux > 0.55, `l’acte I n’est gagné que ${(taux * 100).toFixed(0)} % du temps, c’est infaisable`)
  assert.ok(taux < 0.98, `l’acte I est gagné ${(taux * 100).toFixed(0)} % du temps, il ne demande rien`)
})

test('aucun noyau ne mène à un combat sans fin', () => {
  // Une équipe de départ n'a rien à faire contre le noyau du cinquième acte,
  // et c'est très bien : ce qu'on vérifie ici, c'est qu'aucun ne bloque.
  for (const n of NOYAUX) {
    const rencontre = n.escorte ? [n.id, ...n.escorte] : [n.id]
    const { issue, tours } = duel(['analyste', 'briseur', 'tisseur'], rencontre, 800)
    assert.ok(issue, `${n.nom} : combat sans fin après ${tours} tours`)
  }
})

test('les noyaux du premier acte sont durs mais franchissables', () => {
  for (const id of Carte.acteDe(1).noyaux) {
    const n = NOYAUX.find((x) => x.id === id)
    const rencontre = n.escorte ? [n.id, ...n.escorte] : [n.id]
    const { issue, tours } = duel(['analyste', 'briseur', 'tisseur'], rencontre, 600, true)
    assert.equal(issue, 'gagne', `${n.nom} est infranchissable avec l’équipement de fin d’acte I`)
    assert.ok(tours > 12, `${n.nom} tombe en ${tours} tours`)
  }
})

test('le noyau final change de peau à mesure qu’il tombe', () => {
  const final = NOYAUX.find((n) => n.final)
  assert.ok(final, 'aucun noyau final')
  const c = K.commence(equipe('briseur', 'briseur', 'briseur'), [final.id])
  const p = c.proc[0]
  const profils = new Set()
  for (let k = 0; k < 40; k++) {
    profils.add(JSON.stringify(p.resist))
    p.pv = Math.max(0, p.pv - p.pvMax / 12)
    K.applique(p, 'marque', 0)
    // On force la relecture de phase par un coup d'un point.
    K.joue(c, c.ops[0], 0, p)
    if (p.pv <= 0) break
  }
  assert.ok(profils.size >= 3, `le noyau final n’a montré que ${profils.size} profil(s) de résistance`)
})

// --- Sauvegarde ----------------------------------------------------------------------------------

test('une partie se sauve, se relit, et reprend au même tour', () => {
  const e = E.nouvelle(4242, ['analyste', 'briseur', 'tisseur'])
  E.descend(e, 0, 0)
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
  E.descend(a, 0, 0)
  E.descend(b, 0, 0)
  assert.deepEqual(E.rencontre(a), E.rencontre(b))
  assert.deepEqual(
    a.equipe.map((o) => o.nom),
    b.equipe.map((o) => o.nom),
  )
})

// --- La carte ------------------------------------------------------------------------------------

test('aucune carte n’enferme le joueur dans un cul-de-sac', () => {
  // Un graphe où un nœud n'est atteignable par personne, ou d'où l'on ne peut
  // plus descendre, est une carte fausse. On le vérifie sur des centaines de
  // graines plutôt que sur celle qu'on a sous les yeux.
  for (let g = 0; g < 400; g++) {
    for (let acte = 1; acte <= Carte.ACTES.length; acte++) {
      const carte = Carte.engendre(g * 7919 + 3, acte)
      carte.couches.forEach((ligne, i) => {
        if (i === carte.couches.length - 1) return
        for (const n of ligne) {
          assert.ok(n.liens.length > 0, `graine ${g}, acte ${acte} : nœud sans issue en couche ${i}`)
          for (const k of n.liens) assert.ok(carte.couches[i + 1][k], `lien vers un nœud inexistant`)
        }
        // Toute la couche suivante doit être atteignable depuis celle-ci.
        const atteints = new Set(ligne.flatMap((n) => n.liens))
        carte.couches[i + 1].forEach((_, k) => {
          assert.ok(atteints.has(k), `graine ${g}, acte ${acte} : nœud ${i + 1}/${k} inatteignable`)
        })
      })
    }
  }
})

test('chaque acte se termine par un noyau, et commence par un combat', () => {
  for (let acte = 1; acte <= Carte.ACTES.length; acte++) {
    for (let g = 0; g < 60; g++) {
      const carte = Carte.engendre(g * 131 + 1, acte)
      for (const n of carte.couches.at(-1)) assert.equal(n.type, 'noyau', `acte ${acte} ne finit pas sur un noyau`)
      for (const n of carte.couches[0]) assert.equal(n.type, 'processus', `acte ${acte} ouvre sur ${n.type}`)
    }
  }
})

test('un acte offre toujours de quoi souffler et de quoi se renforcer', () => {
  for (let acte = 1; acte <= Carte.ACTES.length; acte++) {
    for (let g = 0; g < 80; g++) {
      const tous = Carte.engendre(g * 977 + 5, acte)
        .couches.flat()
        .map((n) => n.type)
      assert.ok(tous.includes('atelier'), `acte ${acte}, graine ${g} : aucun atelier`)
      assert.ok(tous.includes('archive'), `acte ${acte}, graine ${g} : aucune archive`)
    }
  }
})

test('une rencontre ne contient que des processus de l’acte', () => {
  for (let acte = 1; acte <= Carte.ACTES.length; acte++) {
    const bassin = Carte.acteDe(acte).bassin
    const carte = Carte.engendre(4242, acte)
    carte.couches.forEach((ligne, i) => {
      ligne.forEach((n, k) => {
        const r = Carte.rencontre(4242, acte, i, k, n.type)
        if (n.type === 'noyau') {
          assert.ok(r.length >= 1)
          return
        }
        if (n.type !== 'processus' && n.type !== 'elite') return
        assert.ok(r.length >= 1 && r.length <= 4, `rencontre de ${r.length} processus`)
        for (const id of r) assert.ok(bassin.includes(id), `${id} n’appartient pas à l’acte ${acte}`)
      })
    })
  }
})

// --- Les modules -----------------------------------------------------------------------------------

test('un module pris verrouille son antagoniste pour toute la partie', () => {
  const e = E.nouvelle(11, ['analyste', 'briseur', 'tisseur'])
  E.descend(e, 0, 0)
  const paire = ANTAGONISTES[0]
  const ok = E.prendModule(e, { op: 0, quoi: 'module', choix: [paire[0]] }, paire[0])
  assert.equal(ok, true)
  assert.ok(e.verrous.includes(paire[1]), 'l’antagoniste n’a pas été verrouillé')
  // Et il ne peut plus être proposé, même à un autre opérateur.
  for (let n = 0; n < 40; n++) {
    e.position = { couche: n % 4, k: n % 2 }
    const offre = E.offre(e, 'module')
    if (offre) assert.equal(offre.choix.includes(paire[1]), false, 'un module verrouillé est encore proposé')
  }
})

test('les modules changent vraiment les statistiques', () => {
  const nu = K.commence(
    [E.nouvelOperateur('briseur', 'A'), E.nouvelOperateur('tisseur', 'B'), E.nouvelOperateur('analyste', 'C')],
    ['veille'],
  )
  const equipeMod = [
    E.nouvelOperateur('briseur', 'A'),
    E.nouvelOperateur('tisseur', 'B'),
    E.nouvelOperateur('analyste', 'C'),
  ]
  equipeMod[0].mod = ['md_plaque', 'md_noyaudur', 'md_horloge']
  const arme = K.commence(equipeMod, ['veille'])
  assert.equal(arme.ops[0].blindage, nu.ops[0].blindage + 3)
  assert.equal(arme.ops[0].puiss, nu.ops[0].puiss + 2)
  assert.equal(arme.ops[0].vit, nu.ops[0].vit + 3)
})

test('un greffon fait percer toute une famille de compétences', () => {
  const equipeMod = [
    E.nouvelOperateur('briseur', 'A'),
    E.nouvelOperateur('tisseur', 'B'),
    E.nouvelOperateur('analyste', 'C'),
  ]
  equipeMod[0].mod = ['md_percant', null, null]
  const c = K.commence(equipeMod, ['veille', 'boucle'])
  const arriere = c.proc.find((p) => p.rang === 1)
  // MASSE est CONTACT : sans PERÇANT, l'arrière n'est même pas une cible légale.
  assert.ok(K.cibles(c, c.ops[0], COMP.masse).includes(arriere), 'le greffon ne donne pas accès à l’arrière')
  const nu = K.commence(
    [E.nouvelOperateur('briseur', 'A'), E.nouvelOperateur('tisseur', 'B'), E.nouvelOperateur('analyste', 'C')],
    ['veille', 'boucle'],
  )
  assert.equal(K.cibles(nu, nu.ops[0], COMP.masse).includes(nu.proc.find((p) => p.rang === 1)), false)
})

test('le bus de tags rend bien des cycles', () => {
  const equipeMod = [
    E.nouvelOperateur('analyste', 'A'),
    E.nouvelOperateur('tisseur', 'B'),
    E.nouvelOperateur('briseur', 'C'),
  ]
  equipeMod[0].mod = ['md_moisson', null, null]
  const c = K.commence(equipeMod, ['tampon'])
  c.cycles = 5
  const avant = c.cycles
  K.joue(c, c.ops[0], 0, c.proc[0]) // SONDE porte le tag MARQUE, coût 1
  assert.equal(c.cycles, avant - 1 + 1, 'MOISSON n’a pas rendu son cycle')
})

// --- La fin, et le sans-fin -----------------------------------------------------------------

test('la campagne a une fin, la descente n’en a pas', () => {
  const e = E.nouvelle(1, ['analyste', 'briseur', 'tisseur'])
  for (let k = 1; k < Carte.DERNIER_ACTE; k++) assert.equal(E.acteSuivant(e), 'suite', `acte ${k} sans suite`)
  assert.equal(e.acte, Carte.DERNIER_ACTE)
  assert.equal(E.acteSuivant(e), 'fin', 'la campagne ne se termine jamais')

  const inf = E.nouvelle(1, ['analyste', 'briseur', 'tisseur'], 'infini')
  for (let k = 0; k < 30; k++) assert.equal(E.acteSuivant(inf), 'suite', 'la descente sans fin s’arrête')
  assert.ok(inf.acte > 30, 'la profondeur ne monte pas')
})

test('la pression durcit les processus, sans jamais les adoucir', () => {
  const base = { pv: 40, blindage: 2, vit: 8, puiss: 6 }
  let precedent = base
  for (let p = 1; p <= 20; p++) {
    const dur = SF.durcis(base, p)
    assert.ok(dur.pv >= precedent.pv, 'l’intégrité redescend avec la pression')
    assert.ok(dur.blindage >= precedent.blindage && dur.vit >= precedent.vit && dur.puiss >= precedent.puiss)
    precedent = dur
  }
  assert.ok(SF.durcis(base, 20).pv > base.pv * 4, 'vingt crans de pression ne changent presque rien')
})

test('un fardeau n’est jamais proposé deux fois', () => {
  const portes = []
  for (let acte = 4; acte <= 22; acte += 3) {
    const offre = SF.offreFardeaux(4242, acte, portes)
    for (const id of offre) assert.equal(portes.includes(id), false, `${id} reproposé alors qu’il est déjà porté`)
    if (offre.length) portes.push(offre[0])
  }
  assert.ok(portes.length >= 5, 'les fardeaux s’épuisent trop vite')
})

test('les fardeaux mordent vraiment', () => {
  const eq = equipe('analyste', 'briseur', 'tisseur')
  const nu = K.commence(eq, ['tampon', 'veille'])
  const dur = K.commence(eq, ['tampon', 'veille'])
  SF.applique(dur, ['f_pare', 'f_cycles', 'f_trace', 'f_blindage'])
  assert.ok(dur.cyclesMax < nu.cyclesMax, 'RATIONNEMENT ne rationne rien')
  assert.ok(dur.tracage > nu.tracage, 'SURVEILLANCE ne surveille rien')
  assert.ok(dur.proc[0].etats.pare > 0, 'PARE-FEU NATIF ne pose aucun pare-feu')
  assert.ok(dur.proc[0].blindage > nu.proc[0].blindage, 'DURCISSEMENT ne durcit rien')
})

test('aucun fardeau n’est inerte, et deux ne font jamais la même chose', () => {
  // LATENCE SYSTÈME l'était : sa ligne recopiait le tableau des recharges sur
  // lui-même. Un fardeau qui ne fait rien est pire qu'un fardeau facile, parce
  // qu'il occupe une des trois places d'une offre.
  const effets = new Set()
  for (const f of SF.FARDEAUX) {
    assert.ok(f.effet && typeof f.valeur === 'number', `${f.id} : pas d’effet chiffré`)
    assert.ok(f.valeur !== 0, `${f.id} : effet de valeur nulle`)
    assert.equal(effets.has(f.effet), false, `${f.id} refait ce que fait déjà un autre fardeau (${f.effet})`)
    effets.add(f.effet)
  }

  const eq = equipe('analyste', 'briseur', 'tisseur')
  const nu = K.commence(eq, ['tampon', 'veille', 'boucle'])
  for (const f of SF.FARDEAUX) {
    const dur = K.commence(eq, ['tampon', 'veille', 'boucle'])
    SF.applique(dur, [f.id])
    const change =
      dur.cyclesMax !== nu.cyclesMax ||
      dur.parTour !== nu.parTour ||
      dur.tracage !== nu.tracage ||
      (dur.tracageMult ?? 1) !== 1 ||
      (dur.rechargePlus ?? 0) !== 0 ||
      dur.proc.some(
        (p, i) =>
          p.blindage !== nu.proc[i].blindage ||
          p.puiss !== nu.proc[i].puiss ||
          p.pvMax !== nu.proc[i].pvMax ||
          (p.etats.pare ?? 0) > 0 ||
          p.att !== nu.proc[i].att,
      )
    // Deux fardeaux agissent hors combat : ils sont vérifiés à part.
    if (['soinReduit', 'nombrePlus'].includes(f.effet)) continue
    assert.ok(change, `${f.nom} ne change rien au combat`)
  }
})

test('les fardeaux hors combat agissent aussi', () => {
  const e = E.nouvelle(4, ['briseur', 'tisseur', 'analyste'], 'infini')
  E.descend(e, 0, 0)
  for (const o of e.equipe) o.pv = 1
  E.souffle(e)
  const plein = e.equipe[0].pv

  const rogne = E.nouvelle(4, ['briseur', 'tisseur', 'analyste'], 'infini')
  E.descend(rogne, 0, 0)
  rogne.fardeaux = [SF.FARDEAUX.find((f) => f.effet === 'soinReduit').id]
  for (const o of rogne.equipe) o.pv = 1
  E.souffle(rogne)
  assert.ok(rogne.equipe[0].pv < plein, 'PLAIES OUVERTES ne rogne rien')

  const nuee = E.nouvelle(4, ['briseur', 'tisseur', 'analyste'], 'infini')
  E.descend(nuee, 0, 0)
  const avant = E.rencontre(nuee).length
  nuee.fardeaux = [SF.FARDEAUX.find((f) => f.effet === 'nombrePlus').id]
  assert.ok(E.rencontre(nuee).length > avant, 'NUÉE n’ajoute aucun processus')
})

test('tout processus écrit finit par apparaître quelque part', () => {
  // Le tirage lit le bassin de l'acte, pas le champ `acte` : un processus
  // oublié dans les bassins n'existe qu'en mode infini.
  const dansUnBassin = new Set(Carte.ACTES.flatMap((a) => a.bassin))
  for (const p of PROCESSUS) {
    assert.ok(dansUnBassin.has(p.id), `${p.nom} n’est dans le bassin d’aucun acte`)
  }
})

test('un acte du mode infini est jouable et se durcit avec la profondeur', () => {
  for (const acte of [1, 4, 9, 16]) {
    const carte = Carte.engendre(999, acte, 'infini')
    assert.ok(carte.couches.length >= 5, `profondeur ${acte} : carte trop courte`)
    assert.equal(carte.couches.at(-1)[0].type, 'noyau')
    const r = Carte.rencontre(999, acte, 1, 0, 'processus', 'infini')
    assert.ok(r.length >= 1 && r.length <= 4)
    for (const id of r) assert.ok(PROC[id], `${id} inconnu`)
  }
  assert.ok(Carte.acteDe(9, 'infini').force > Carte.acteDe(2, 'infini').force, 'la descente ne durcit pas')
})

// --- Le mode solo -------------------------------------------------------------------------

test('un opérateur seul reçoit ce qu’il faut pour tenir la place de trois', () => {
  const trio = K.commence(equipe('briseur', 'tisseur', 'analyste'), ['veille'])
  const seul = K.commence([E.nouvelOperateur('briseur', 'A', true)], ['veille'])
  assert.equal(seul.seul, true)
  assert.equal(trio.seul, false)
  assert.ok(seul.ops[0].pvMax > trio.ops[0].pvMax * 1.4, 'un opérateur seul n’a pas assez d’intégrité')
  assert.ok(seul.ops[0].blindage > trio.ops[0].blindage, 'ni assez de blindage')
  // Et il commence sa partie **entier**, pas à moitié blessé : le renfort
  // appartient à la fiche, pas au combat.
  assert.equal(seul.ops[0].pv, seul.ops[0].pvMax, 'un opérateur seul démarre entamé')
  // Et surtout, il joue plus souvent : c'est le rapport d'actions qui décide,
  // pas les points de vie.
  const pasTrio = K.tempoDe(trio.ops[0], { temps: 1 })
  const pasSeul = K.tempoDe(seul.ops[0], { temps: 1 })
  assert.ok(pasSeul < pasTrio * 0.7, `seul, le coût de tempo est ${(pasSeul / pasTrio).toFixed(2)} de celui d’un trio`)
})

test('les cycles rendus par tour compensent l’équipage', () => {
  // Ressource partagée : trois opérateurs en regagnent trois fois plus par
  // tour de camp qu'un seul. Sans rattrapage, jouer seul serait jouer avec le
  // tiers de son économie.
  assert.equal(K.cyclesTour(3), 2)
  assert.equal(K.cyclesTour(1), 6)
  assert.equal(K.cyclesTour(3) * 3, K.cyclesTour(1))
})

test('seul, on affronte au plus deux processus et jamais une escorte', () => {
  for (let acte = 1; acte <= Carte.DERNIER_ACTE; acte++) {
    for (let g = 0; g < 40; g++) {
      const carte = Carte.engendre(g * 313 + 7, acte)
      carte.couches.forEach((ligne, i) => {
        ligne.forEach((n, k) => {
          const seul = Carte.rencontre(g * 313 + 7, acte, i, k, n.type, 'campagne', 1)
          const trio = Carte.rencontre(g * 313 + 7, acte, i, k, n.type, 'campagne', 3)
          assert.ok(seul.length >= 1, 'rencontre vide')
          assert.ok(seul.length <= 2, `${seul.length} processus contre un opérateur seul`)
          assert.ok(seul.length <= trio.length, 'seul, on en affronte plus qu’à trois')
        })
      })
    }
  }
})

test('un opérateur seul a plus de place à remplir', () => {
  const solo = E.nouvelle(5, ['briseur'])
  const trio = E.nouvelle(5, ['briseur', 'tisseur', 'analyste'])
  assert.equal(E.estSeul(solo), true)
  assert.equal(E.estSeul(trio), false)
  assert.equal(E.emplacementsDe(solo), E.EMPLACEMENTS_SOLO)
  assert.equal(E.modulesDe(solo), E.MODULES_SOLO)
  assert.ok(E.emplacementsDe(solo) > E.emplacementsDe(trio))
  assert.equal(solo.equipe[0].comp.length, E.EMPLACEMENTS_SOLO)
  assert.equal(solo.equipe[0].mod.length, E.MODULES_SOLO)
})

test('une partie solo se sauve et se relit', () => {
  const e = E.nouvelle(88, ['vecteur'])
  E.descend(e, 0, 0)
  e.equipe[0].comp[2] = 'ver'
  e.equipe[0].mod[3] = 'md_plaque'
  const relu = E.migre(JSON.parse(JSON.stringify(E.sauvegarde(e))))
  assert.ok(relu, 'la sauvegarde solo ne se relit pas')
  assert.equal(relu.equipe.length, 1)
  assert.equal(relu.equipe[0].comp[2], 'ver')
  assert.equal(relu.equipe[0].mod[3], 'md_plaque')
})

test('aucune classe n’est morte en solo', () => {
  // Le banc mesure les taux exacts ; ici on vérifie seulement qu'aucune classe
  // ne se retrouve incapable de finir un combat d'ouverture toute seule.
  for (const cl of CLASSES) {
    const op = E.nouvelOperateur(cl.id, 'SEUL', true)
    cl.reserve.forEach((id, k) => (op.comp[2 + k] = id))
    let gagnes = 0
    for (let n = 0; n < 8; n++) {
      const rencontre = n % 2 ? ['veille'] : ['veille', 'balise']
      const c = K.commence([op], rencontre)
      IA.annonce(c)
      let t = 0
      while (!K.fini(c) && t < 300) {
        const u = K.actif(c)
        K.ouvreTour(c, u)
        K.recharge(u)
        if (!K.estOperateur(c, u)) IA.tourProcessus(c, u)
        else {
          let m = null
          for (let k = 0; k < u.comp.length; k++) {
            const comp = COMP[u.comp[k]]
            if (!comp || !K.jouable(c, u, comp, k)) continue
            for (const cible of K.cibles(c, u, comp)) {
              const v = comp.base ? K.degats(c, u, comp, cible).final : comp.soin ? comp.soin * 0.5 : 3
              if (!m || v > m.v) m = { k, cible, v }
            }
          }
          if (m) K.joue(c, u, m.k, m.cible)
          else K.passe(c, u)
        }
        IA.annonce(c)
        t++
      }
      if (K.fini(c) === 'gagne') gagnes++
    }
    assert.ok(gagnes >= 4, `${cl.nom} seul ne gagne que ${gagnes}/8 combats d’ouverture`)
  }
})

// --- L'atelier -----------------------------------------------------------------------------

test('l’atelier propose trois choses et n’en donne qu’une', () => {
  const e = E.nouvelle(3, ['analyste', 'briseur', 'tisseur'])
  assert.equal(E.ATELIER.length, 3)
  for (const o of e.equipe) o.pv = 10
  E.souffle(e)
  for (const o of e.equipe) assert.ok(o.pv > 10 && o.pv <= o.pvMax, 'souffler ne rend rien')

  // Affûter : moins cher, et recharge plus vite. Une seule fois par compétence.
  const cible = E.affutables(e)[0]
  const comp = COMP[cible.id]
  const avant = K.cout(e.equipe[cible.op], comp)
  assert.equal(E.affute(e, cible.op, cible.k), true)
  const apres = K.cout(e.equipe[cible.op], comp)
  assert.ok(apres < avant || comp.cout === 0, `affûter n’a pas changé le coût (${avant} → ${apres})`)
  assert.ok(K.rechargeDe(e.equipe[cible.op], comp) <= comp.recharge)
  assert.equal(E.affute(e, cible.op, cible.k), false, 'la même compétence s’affûte deux fois')
})

test('on ne désinstalle jamais une compétence verrouillée', () => {
  const e = E.nouvelle(3, ['analyste', 'briseur', 'tisseur'])
  e.equipe[0].comp[2] = 'balayage'
  assert.equal(E.retire(e, 0, 0), false, 'une compétence de départ a été oubliée')
  assert.equal(E.retire(e, 0, 1), false)
  assert.equal(E.retire(e, 0, 2), true)
  assert.equal(e.equipe[0].comp[2], null)
  for (const x of E.retirables(e)) assert.ok(x.k >= E.VERROUS, 'un emplacement verrouillé est proposé au retrait')
})

test('l’affûtage traverse la sauvegarde et arrive jusqu’au combat', () => {
  const e = E.nouvelle(9, ['briseur'])
  E.affute(e, 0, 0)
  const relu = E.migre(JSON.parse(JSON.stringify(E.sauvegarde(e))))
  assert.deepEqual(relu.equipe[0].affute, e.equipe[0].affute)
  const c = K.commence(relu.equipe, ['veille'])
  const comp = COMP[relu.equipe[0].comp[0]]
  assert.ok(K.cout(c.ops[0], comp) < comp.cout + K.surcoutAxe(c.ops[0], comp) || comp.cout === 0)
})
