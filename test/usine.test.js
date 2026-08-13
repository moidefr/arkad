/**
 * USINE : la courbe, la sauvegarde et les tricheries.
 *
 * La version précédente n'avait aucun numéro de version dans sa sauvegarde —
 * ajouter une sixième machine produisait un `NaN` puis effaçait la partie sans
 * rien dire — et sa refonte était arithmétiquement toujours perdante :
 * récupérer le multiplicateur déjà acquis coûtait plus cher que la dernière
 * amélioration du jeu. Ces deux fautes ont chacune leur test.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import usine from '../src/long/usine/index.js'
import { MACHINES, AMELIORATIONS, RECHERCHES } from '../src/long/usine/donnees.js'
import * as L from '../src/long/usine/logique.js'
import { fauxJeu, fauxCtx, graine, PAS } from './faux.js'

// --- Données -------------------------------------------------------------------

test('les tables sont cohérentes', () => {
  const ids = new Set()
  for (const x of AMELIORATIONS) {
    assert.equal(ids.has(x.id), false, `amélioration en double : ${x.id}`)
    ids.add(x.id)
    assert.ok(x.cout > 0 && x.nom && x.dit, `amélioration incomplète : ${x.id}`)
    if (x.cible !== undefined) assert.ok(MACHINES[x.cible], `${x.id} vise une machine qui n’existe pas`)
  }
  const faits = new Set()
  for (const r of RECHERCHES) {
    assert.equal(faits.has(r.id), false, `recherche en double : ${r.id}`)
    // Un prérequis doit être écrit avant : sinon l'arbre a une boucle.
    for (const req of r.requis) assert.ok(faits.has(req), `${r.id} exige ${req}, qui vient après`)
    faits.add(r.id)
    assert.ok(r.duree > 0 && r.cout > 0, `recherche incomplète : ${r.id}`)
  }
  // Toute machine verrouillée doit l'être par une recherche qui existe.
  for (const m of MACHINES) if (m.recherche) assert.ok(faits.has(m.recherche), `${m.nom} attend ${m.recherche}`)
})

test('chaque palier de machine coûte plus et rapporte plus', () => {
  for (let i = 1; i < MACHINES.length; i++) {
    assert.ok(MACHINES[i].cout > MACHINES[i - 1].cout * 5, `${MACHINES[i].nom} est trop bon marché`)
    assert.ok(MACHINES[i].prod > MACHINES[i - 1].prod * 4, `${MACHINES[i].nom} ne rapporte pas assez`)
  }
})

// --- Sauvegarde ------------------------------------------------------------------

test('une sauvegarde de la version 1 se relit sans rien perdre', () => {
  // Exactement le format écrit par l'ancienne `usine.js`.
  const v1 = {
    minerai: 5000,
    n: [40, 12, 3, 1, 0],
    ame: ['g0', 'm1', 'g1', 'h1'],
    total: 9e5,
    lingots: 4,
    fontes: 1,
    quand: Date.now(),
  }
  const e = L.migre(v1)
  assert.ok(e, 'la migration a renoncé')
  assert.equal(e.v, L.VERSION)
  assert.equal(e.minerai, 5000)
  assert.equal(e.lingots, 4)
  // Les cinq machines d'alors ne sont plus aux mêmes indices.
  assert.equal(e.n[0], 40, 'PIOCHE perdue')
  assert.equal(e.n[4], 1, 'FONDERIE n’a pas suivi son changement d’indice')
  assert.equal(e.n[6], 0, 'RÉACTEUR inventé de toutes pièces')
  assert.deepEqual(e.ame, ['g0a', 'm1', 'g1a', 'h1'])
  assert.equal(e.n.length, MACHINES.length)
  assert.ok(Number.isFinite(L.production(e)), 'la production est devenue NaN')
})

test('une sauvegarde abîmée ne propage jamais NaN', () => {
  const e = L.migre({
    v: L.VERSION,
    minerai: 'beaucoup',
    n: [null, undefined, NaN],
    ame: ['inconnu'],
    rech: ['jamais'],
  })
  assert.ok(e)
  assert.equal(e.minerai, 0)
  assert.deepEqual(e.ame, [])
  assert.deepEqual(e.rech, [])
  assert.ok(Number.isFinite(L.production(e)))
})

test('une version venue du futur est refusée, pas devinée', () => {
  assert.equal(L.migre({ v: 99, minerai: 1e9 }), null)
})

test('la sauvegarde tient dans quelques kilo-octets', () => {
  const e = L.neuve()
  e.n = MACHINES.map(() => 999)
  e.ame = AMELIORATIONS.map((x) => x.id)
  e.rech = RECHERCHES.map((r) => r.id)
  assert.ok(JSON.stringify(L.sauvegarde(e)).length < 2048)
})

// --- Tricheries -------------------------------------------------------------------

test('reculer l’horloge ne rapporte rien', () => {
  const e = L.neuve()
  e.n[0] = 50
  e.ouvriers = 20
  const maintenant = 1e12
  e.quand = maintenant
  assert.equal(L.credite(e, maintenant - 3600 * 1000), 0, 'une horloge reculée crédite quand même')
  assert.equal(e.minerai, 0)
})

test('l’absence est créditée, mais bornée', () => {
  const e = L.neuve()
  e.n[0] = 50
  const parSeconde = L.production(e)
  e.quand = 1e12
  // Un an d'absence ne doit pas payer plus que le plafond.
  const gain = L.credite(e, 1e12 + 365 * 24 * 3600 * 1000)
  assert.ok(gain <= parSeconde * L.horsLigneMax(e), 'le plafond hors ligne ne tient pas')
  assert.ok(gain > parSeconde * 3600, 'huit heures d’absence ne rapportent presque rien')
})

// --- Économie -----------------------------------------------------------------------

test('refondre est toujours rentable quand le bouton le propose', () => {
  // Le défaut de la version précédente, retourné en test : dès que la refonte
  // annonce un gain, le multiplicateur d'après doit dépasser celui d'avant.
  const e = L.neuve()
  for (const total of [2e6, 1e8, 1e11, 1e14, 1e17]) {
    e.total = total
    const gain = L.lingotsSi(e)
    assert.ok(gain > 0, `aucun lingot pour ${total} extraits`)
    const avant = 1 + e.lingots * 0.25
    const apres = 1 + (e.lingots + gain) * 0.25
    assert.ok(apres / avant >= 1.25, `refondre à ${total} ne rend que ×${(apres / avant).toFixed(2)}`)
  }
})

test('la refonte ne s’emballe pas : ×23 d’extrait pour ×2 de lingots', () => {
  const e = L.neuve()
  e.total = 1e12
  const a = L.lingotsSi(e)
  e.total = 1e12 * 23
  const b = L.lingotsSi(e)
  assert.ok(b / a > 1.8 && b / a < 2.3, `×23 d’extrait donne ×${(b / a).toFixed(2)} de lingots`)
})

test('la refonte garde le savoir et les gens, pas les machines', () => {
  const e = L.neuve()
  e.total = 1e12
  e.n[0] = 200
  e.ouvriers = 40
  e.rech = ['r0', 'p0']
  e.ame = ['g0a']
  const gain = L.refond(e)
  assert.ok(gain > 0)
  assert.equal(e.n[0], 0, 'les machines survivent à la refonte')
  assert.deepEqual(e.ame, [])
  assert.equal(e.ouvriers, 24, 'l’équipe devrait se disperser un peu, pas disparaître ni rester entière')
  assert.deepEqual(e.rech, ['r0', 'p0'], 'la recherche a été effacée')
  assert.equal(e.total, 0)
})

test('aucune amélioration n’est morte : chacune change la production', () => {
  for (const x of AMELIORATIONS) {
    const e = L.neuve()
    MACHINES.forEach((_, i) => (e.n[i] = 10))
    e.ouvriers = 3
    const avant = x.main ? L.gainMain(e) : L.production(e)
    e.ame.push(x.id)
    const apres = x.main ? L.gainMain(e) : L.production(e)
    assert.ok(apres > avant, `${x.nom} ne change rien`)
  }
})

/**
 * Un joueur passable : il répare, achète les améliorations, garde une réserve
 * pour la recherche, embauche quand l'usine est en sous-effectif, et refond
 * quand ça vaut le coup. Sert de base à tous les tests de courbe.
 */
function joueur(heures, { surveille } = {}) {
  const e = L.neuve()
  const hasard = graine(77)
  for (let t = 0; t < heures * 3600; t += 2) {
    // On creuse à la main tant que ça rapporte plus qu'une seconde d'usine —
    // sans ce geste, on ne peut même pas s'offrir la première pioche.
    const main = L.gainMain(e)
    if (main > Math.max(1, L.production(e)) * 0.5) {
      const gain = main * 4
      e.minerai += gain
      e.total += gain
    }
    L.avance(e, 2, hasard)
    for (const p of [...e.pannes]) if (p.reste < 0) L.repare(e, p.i)
    for (const x of L.ameliorationsVisibles(e)) L.acheteAmelioration(e, x.id)
    while (e.enCours.length < L.placesRecherche(e)) {
      const libre = L.recherchesVisibles(e)
        .filter((r) => !e.enCours.some((c) => c.id === r.id))
        .sort((x, y) => x.cout - y.cout)[0]
      if (!libre || !L.lanceRecherche(e, libre.id)) break
    }
    if (L.couverture(e) < 0.9 && L.coutOuvrier(e) < e.minerai * 0.25) L.embauche(e)
    // On garde une réserve : un joueur ne dépense pas jusqu'au dernier caillou.
    for (const i of L.machinesVisibles(e)) if (e.minerai > L.cout(e, i) * 3) L.acheteMachine(e, i)
    if (e.lingots > 0 && L.lingotsSi(e) > e.lingots * 0.6) L.refond(e)
    surveille?.(e, t)
  }
  return e
}

test('un ouvrier coûte toujours entre 3 secondes et 3 minutes de production', () => {
  // C'est ce qui maintient l'embauche vivante de la première à la dixième
  // heure : trop cher, la mécanique meurt et l'usine tourne en sous-effectif
  // permanent ; trop bon marché, elle ne concurrence plus rien.
  const releves = []
  joueur(10, {
    surveille: (e, t) => {
      if (t % 1800 || t < 1800 || !e.ouvriers) return
      releves.push({ t, s: L.coutOuvrier(e) / Math.max(1, L.production(e)) })
    },
  })
  assert.ok(releves.length > 10, 'pas assez de relevés')
  for (const r of releves) {
    assert.ok(
      r.s > 3 && r.s < 180,
      `à ${(r.t / 3600).toFixed(1)} h, un ouvrier coûte ${r.s.toFixed(0)} s de production`,
    )
  }
})

test('l’usine reste dotée en personnel jusqu’au bout', () => {
  // Le piège du genre : une demande linéaire face à un prix exponentiel finit
  // toujours par tuer la mécanique. Sans l'exposant sur les postes, la
  // couverture tombait à 13 % à la dixième heure.
  const e = joueur(10)
  assert.ok(L.couverture(e) > 0.7, `couverture de ${(L.couverture(e) * 100).toFixed(0)} % après dix heures`)
})

// --- Mécaniques ------------------------------------------------------------------------

test('une machine en panne ne produit rien, et se répare', () => {
  const e = L.neuve()
  e.n[0] = 10
  e.n[1] = 4
  const plein = L.production(e)
  e.pannes.push({ i: 1, reste: -1 })
  assert.ok(L.production(e) < plein, 'une panne ne coûte rien')
  assert.equal(L.productionMachine(e, 1), 0)
  L.repare(e, 1)
  assert.equal(L.production(e), plein)
})

test('les pannes n’arrivent pas tant qu’il n’y a qu’une machine', () => {
  const e = L.neuve()
  e.n[0] = 30
  const hasard = graine(3)
  for (let k = 0; k < 4000; k++) L.avance(e, 1, hasard)
  assert.equal(e.pannes.length, 0, 'on casse le matériel d’un débutant')
})

test('une recherche prend le temps annoncé, et ne se lance pas deux fois', () => {
  const e = L.neuve()
  e.minerai = 1e9
  assert.equal(L.lanceRecherche(e, 'r0'), true)
  assert.equal(L.lanceRecherche(e, 'r0'), false, 'la même recherche s’est lancée deux fois')
  assert.equal(L.lanceRecherche(e, 'o0'), false, 'deux recherches en parallèle sans BUREAU D’ÉTUDES')
  const hasard = graine(1)
  const r = RECHERCHES.find((x) => x.id === 'r0')
  for (let t = 0; t < r.duree - 2; t++) L.avance(e, 1, hasard)
  assert.equal(L.su(e, 'r0'), false, 'trouvée avant l’heure')
  for (let t = 0; t < 4; t++) L.avance(e, 1, hasard)
  assert.equal(L.su(e, 'r0'), true, 'jamais trouvée')
})

test('une recherche verrouillée reste hors de portée même avec tout le minerai', () => {
  const e = L.neuve()
  e.minerai = 1e30
  assert.equal(L.lanceRecherche(e, 'h9'), false, 'la dernière recherche s’achète sans prérequis')
  assert.equal(L.machineOuverte(e, 9), false, 'le PUITS DE MANTEAU s’achète sans GÉOTHERMIE')
})

test('un contrat se mesure en secondes de production, pas en nombres absolus', () => {
  const e = L.neuve()
  e.rech = ['r0', 'c0']
  e.n[5] = 100
  const c = L.tire(e, graine(2))
  const secondes = c.cible / L.production(e)
  assert.ok(secondes > 20 && secondes < 2000, `un contrat demande ${secondes.toFixed(0)} s de production`)
})

// --- Le jeu entier ------------------------------------------------------------------------

test('la première demi-heure donne de quoi faire, sans tout donner', () => {
  const e = joueur(0.5)
  assert.ok(e.n.filter((v) => v > 0).length >= 2, 'une seule machine en trente minutes')
  assert.ok(e.ame.length >= 1, 'aucune amélioration en trente minutes')
  assert.ok(e.ame.length <= 5, `${e.ame.length} améliorations en trente minutes, tout va trop vite`)
  assert.equal(e.lingots, 0, 'la refonte arrive dès la première demi-heure')
})

test('dix heures de jeu ne laissent ni NaN, ni contenu épuisé', () => {
  const e = joueur(10)
  assert.ok(Number.isFinite(e.minerai) && Number.isFinite(e.total), 'l’économie a produit un NaN')
  assert.ok(e.minerai >= 0, 'du minerai négatif')
  assert.ok(Number.isFinite(L.production(e)), 'la production est devenue NaN')

  // Le reproche d'origine : « trop vite lassant ». Il reste du contenu.
  assert.ok(e.rech.length < RECHERCHES.length, `les ${RECHERCHES.length} recherches sont trouvées en dix heures`)
  assert.ok(e.ame.length < AMELIORATIONS.length, 'toutes les améliorations sont achetées en dix heures')
  // Mais pas au point que le joueur piétine.
  assert.ok(e.rech.length >= 8, `seulement ${e.rech.length} recherches en dix heures, le jeu est trop lent`)
  assert.ok(e.fontes >= 1, 'jamais l’occasion de refondre en dix heures')
})

/**
 * Le test qui manquait.
 *
 * Les précédents appuyaient au hasard et vérifiaient seulement que rien ne
 * plantait. Or plus rien n'était achetable dans aucune liste — machines,
 * ouvriers, améliorations, recherches — parce que l'appui reconstruisait les
 * lignes au lieu de relire celles qui avaient été dessinées. Ça ne lève aucune
 * erreur : ça ne fait simplement rien. Un test qui n'assère pas un effet ne
 * teste rien.
 */
test('on peut vraiment acheter, en passant par le vrai chemin d’appui', () => {
  const j = fauxJeu(usine, { graine: 5 })
  const ctx = fauxCtx()
  const dessine = () => {
    ctx.ops.length = 0
    usine.dessine(j, ctx)
  }
  const tape = (x, y) => {
    j.pointer.x = x
    j.pointer.y = y
    usine.appui(j, j.pointer)
    usine.relache(j, j.pointer)
  }

  j.e.minerai = 1e9
  dessine()

  // La première ligne de l'onglet USINE est celle des ouvriers.
  const ouvriers = j.e.ouvriers
  tape(180, 374)
  assert.equal(j.e.ouvriers, ouvriers + 1, 'appuyer sur la ligne OUVRIERS n’embauche personne')

  // La deuxième est la première machine.
  dessine()
  const machines = j.e.n[0]
  tape(180, 426)
  assert.equal(j.e.n[0], machines + 1, 'appuyer sur une ligne de machine n’achète rien')

  // Onglet ATELIER : la première amélioration visible.
  usine.appui(j, { x: 139, y: 325 })
  dessine()
  const ame = j.e.ame.length
  tape(180, 372)
  assert.equal(j.e.ame.length, ame + 1, 'appuyer sur une amélioration n’achète rien')

  // Onglet ÉTUDES : la première recherche disponible.
  usine.appui(j, { x: 225, y: 325 })
  dessine()
  tape(180, 376)
  assert.equal(j.e.enCours.length, 1, 'appuyer sur une recherche ne la lance pas')
})

test('un glissement ne déclenche jamais un achat', () => {
  const j = fauxJeu(usine, { graine: 5 })
  const ctx = fauxCtx()
  j.e.minerai = 1e9
  usine.dessine(j, ctx)

  const avant = j.e.ouvriers
  j.pointer.x = 180
  j.pointer.y = 374
  usine.appui(j, j.pointer)
  j.maintenu = true
  j.pointer.y = 300 // le doigt remonte de 74 px : c'est un défilement
  usine.maj(j, PAS)
  usine.relache(j, j.pointer)
  assert.equal(j.e.ouvriers, avant, 'un défilement a embauché quelqu’un')
})

test('le jeu tourne, se dessine et se sauve', () => {
  const memoire = { valeur: null }
  const j = fauxJeu(usine, { graine: 5, memoire })
  const ctx = fauxCtx()
  for (let i = 0; i < 400; i++) {
    if (i % 7 === 0) {
      j.pointer.x = 20 + ((i * 31) % 320)
      j.pointer.y = 130 + ((i * 47) % 480)
      usine.appui(j, j.pointer)
      usine.relache(j, j.pointer)
    }
    usine.maj(j, PAS)
    ctx.ops.length = 0
    usine.dessine(j, ctx)
    j.t += PAS
  }
  usine.quitte(j)
  assert.ok(memoire.valeur, 'rien n’a été sauvegardé')
  const relu = L.migre(JSON.parse(memoire.valeur))
  assert.ok(relu && Number.isFinite(relu.minerai), 'la sauvegarde ne se relit pas')
})
