/**
 * REMPART : cohérence des tables, calcul pur sans NaN, sauvegarde qui ne
 * plante jamais, et une défense entière jouée par le vrai chemin d'appui.
 *
 * Comme pour EXPÉDITION, personne ne savait avant ces tests si une carte
 * était franchissable sans tour, si l'armure d'un BLINDÉ pouvait ramener des
 * dégâts négatifs, ou si une sauvegarde d'un futur format faisait planter le
 * jeu au lieu de repartir à neuf.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ENNEMIS, TOURS, CARTES, AMELIORATIONS_META, NIVEAU_MAX } from '../src/long/rempart/donnees.js'
import * as L from '../src/long/rempart/logique.js'
import { dispo, zoneCarte, zoneTourBoutique, zoneOnglet, zoneLigne, emplacementSous, toursBoutique, zoneInspect, dans } from '../src/long/rempart/dispo.js'
import rempart from '../src/long/rempart/index.js'
import { graine, joue, fauxJeu } from './faux.js'

// --- Données -----------------------------------------------------------------------

test('chaque chemin de carte est fait de segments horizontaux ou verticaux, jamais en diagonale', () => {
  for (const c of CARTES) {
    assert.ok(c.chemin.length >= 2, `${c.nom} n’a pas de chemin`)
    for (let i = 0; i < c.chemin.length - 1; i++) {
      const a = c.chemin[i]
      const b = c.chemin[i + 1]
      assert.ok(a.x === b.x || a.y === b.y, `${c.nom} a un segment en diagonale (${i})`)
      assert.ok(a.x !== b.x || a.y !== b.y, `${c.nom} a un segment de longueur nulle (${i})`)
    }
  }
})

test('chaque carte a au moins six emplacements, de quoi construire une vraie défense', () => {
  for (const c of CARTES) assert.ok(c.emplacements.length >= 6, `${c.nom} n’a que ${c.emplacements.length} emplacements`)
})

/** La distance d'un point au chemin le plus proche — même calcul que le ciblage des tours. */
function distAuChemin(p, chemin) {
  let meilleure = Infinity
  for (let i = 0; i < chemin.length - 1; i++) {
    const a = chemin[i]
    const b = chemin[i + 1]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const long2 = dx * dx + dy * dy
    let t = long2 > 0 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / long2 : 0
    t = Math.max(0, Math.min(1, t))
    meilleure = Math.min(meilleure, Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t)))
  }
  return meilleure
}

test('sur LE PONT — la seule carte ouverte au tout premier lancement — chaque emplacement est à portée de la SENTINELLE, la seule tour débloquée d’office', () => {
  const sentinelle = TOURS.find((t) => t.id === 'sentinelle')
  const pont = CARTES.find((c) => c.id === 'pont')
  for (const e of pont.emplacements) {
    const d = distAuChemin(e, pont.chemin)
    assert.ok(
      d <= sentinelle.portee,
      `emplacement (${e.x},${e.y}) à ${d.toFixed(1)}px du chemin — hors de portée (${sentinelle.portee}) de la seule tour du départ`,
    )
  }
})

test('sur chaque carte, tout emplacement est à portée d’au moins une tour de base — jamais un emplacement mort', () => {
  const porteeMax = Math.max(...TOURS.map((t) => t.portee))
  for (const c of CARTES) {
    for (const e of c.emplacements) {
      const d = distAuChemin(e, c.chemin)
      assert.ok(
        d <= porteeMax,
        `${c.nom} : emplacement (${e.x},${e.y}) à ${d.toFixed(1)}px du chemin, hors de portée de toute tour (max ${porteeMax})`,
      )
    }
  }
})

test('la première carte est ouverte d’office, les suivantes coûtent de plus en plus cher', () => {
  assert.equal(CARTES[0].coutDeblocage, 0)
  for (let i = 1; i < CARTES.length; i++) assert.ok(CARTES[i].coutDeblocage > CARTES[i - 1].coutDeblocage)
  for (let i = 1; i < CARTES.length; i++) assert.ok(CARTES[i].difficulte > CARTES[i - 1].difficulte, `${CARTES[i].nom} n’est pas plus dure que la précédente`)
})

test('la SENTINELLE est toujours débloquée d’office, gratuitement', () => {
  const t = TOURS.find((t) => t.id === 'sentinelle')
  assert.equal(t.coutDeblocage, 0)
  assert.ok(L.metaNeuve().toursDeblocs.includes('sentinelle'))
})

test('au moins deux comportements de tour distincts : direct et zone', () => {
  const directes = TOURS.filter((t) => t.type === 'direct')
  const zones = TOURS.filter((t) => t.type === 'zone')
  assert.ok(directes.length >= 2 && zones.length >= 2, 'il faut plusieurs tours de chaque famille')
  for (const t of zones) assert.ok(t.rayon > 0, `${t.nom} est une tour de zone sans rayon`)
  for (const t of directes) assert.equal(t.rayon, 0, `${t.nom} est directe mais porte un rayon`)
  // Le ralentissement est le trait distinctif d'au moins une tour de zone.
  assert.ok(zones.some((t) => t.ralenti > 0), 'aucune tour ne ralentit — la deuxième famille n’a rien de spécial')
})

test('un BLINDÉ résiste aux dégâts directs mais pas aux dégâts de zone', () => {
  const blinde = ENNEMIS.blinde
  const mitrailleuse = TOURS.find((t) => t.id === 'mitrailleuse')
  assert.ok(blinde.armure > 0, 'un blindé sans armure n’a rien de spécial')
  assert.ok(mitrailleuse.degat <= blinde.armure, 'la mitrailleuse devrait presque rebondir sur un blindé')
})

test('toutes les pistes d’amélioration méta ont des coûts strictement croissants', () => {
  for (const a of AMELIORATIONS_META) {
    assert.ok(a.couts.length >= 3, `${a.nom} n’a presque pas de niveaux`)
    for (let i = 1; i < a.couts.length; i++) assert.ok(a.couts[i] > a.couts[i - 1], `${a.nom} n’augmente pas de prix`)
  }
})

test('previsionTour promet toujours mieux à l’étape suivante, jusqu’au niveau maximum', () => {
  const meta = L.metaNeuve()
  const partie = L.partieNeuve('pont', meta)
  for (const def of TOURS) {
    const tour = { instanceId: 1, tourId: def.id, emplacement: 0, niveau: 1, recharge: 0 }
    for (let niveau = 1; niveau <= NIVEAU_MAX; niveau++) {
      tour.niveau = niveau
      const p = L.previsionTour(partie, tour)
      assert.equal(p.def.id, def.id)
      assert.equal(p.maxee, niveau >= NIVEAU_MAX)
      if (p.maxee) {
        assert.equal(p.prochain, null)
        assert.equal(p.cout, null)
      } else {
        assert.ok(p.prochain.degat > p.actuel.degat, `${def.id} niveau ${niveau} : la prochaine étape ne fait pas plus de dégâts`)
        assert.ok(p.prochain.portee > p.actuel.portee, `${def.id} niveau ${niveau} : la prochaine étape ne porte pas plus loin`)
        assert.ok(p.prochain.cadence > p.actuel.cadence, `${def.id} niveau ${niveau} : la prochaine étape ne tire pas plus vite`)
        assert.ok(p.cout > 0)
      }
    }
  }
})

// --- Géométrie pure ------------------------------------------------------------------

test('positionSur(0) rend le départ du chemin, positionSur(longueur) rend son arrivée', () => {
  for (const c of CARTES) {
    const debut = L.positionSur(c, 0)
    assert.equal(debut.x, c.chemin[0].x)
    assert.equal(debut.y, c.chemin[0].y)
    const longueur = L.longueurChemin(c)
    const fin = L.positionSur(c, longueur)
    const dernier = c.chemin[c.chemin.length - 1]
    assert.ok(Math.abs(fin.x - dernier.x) < 0.01 && Math.abs(fin.y - dernier.y) < 0.01)
  }
})

test('genereVague respecte les seuils d’apparition des types d’ennemis', () => {
  const hasard = graine(3)
  const carte = CARTES[0]
  const v1 = L.genereVague(carte, 1, hasard)
  assert.ok(v1.every((s) => s.type === 'rampant'), 'la vague 1 devrait n’avoir que des rampants')
  const v20 = L.genereVague(carte, 20, hasard)
  assert.ok(v20.length > v1.length, 'une vague tardive devrait avoir plus d’ennemis qu’une vague 1')
})

test('eclatsParVague ne redescend jamais avec le numéro de vague, à carte égale', () => {
  const carte = CARTES[0]
  let precedent = 0
  for (let n = 1; n <= 40; n++) {
    const g = L.eclatsParVague(carte, n)
    assert.ok(g >= precedent, `vague ${n} rapporte moins que la précédente`)
    precedent = g
  }
})

// --- Une longue simulation, sans jamais produire de NaN -----------------------------

/** Remplit le plateau avec la tour la moins chère qu'on peut encore payer, puis lance. */
function equipeEtLance(partie, meta, carte) {
  const boutique = toursBoutique(meta)
  for (let i = 0; i < carte.emplacements.length; i++) {
    if (partie.tours.some((t) => t.emplacement === i)) continue
    const abordable = [...boutique].sort((a, b) => a.cout - b.cout).find((t) => t.cout <= partie.ferraille)
    if (!abordable) break
    L.poseTour(partie, meta, abordable.id, i)
  }
  let ameliore = true
  while (ameliore) {
    ameliore = false
    for (const tour of partie.tours) {
      if (tour.niveau >= NIVEAU_MAX) continue
      const def = L.tourParId(tour.tourId)
      if (partie.ferraille >= L.coutAmeliorationTour(def, tour.niveau) && L.ameliorerTour(partie, tour.instanceId)) ameliore = true
    }
  }
  L.lanceVagueMaintenant(partie)
}

test('cent vagues simulées sur chaque carte ne produisent ni NaN ni valeur hors bornes', () => {
  const hasard = graine(9)
  for (const carte of CARTES) {
    const meta = L.metaNeuve()
    meta.toursDeblocs = TOURS.map((t) => t.id) // toutes les tours, pour exercer chaque comportement
    const partie = L.partieNeuve(carte.id, meta)
    let images = 0
    while (partie.vague < 100 && partie.phase !== 'defaite' && images < 2_000_000) {
      if (partie.phase === 'attente') equipeEtLance(partie, meta, carte)
      L.avance(partie, 1 / 10, hasard, {})
      images++

      assert.ok(Number.isFinite(partie.vie), `vie NaN sur ${carte.nom}`)
      assert.ok(partie.vie >= 0 && partie.vie <= partie.vieMax, `vie hors bornes sur ${carte.nom} : ${partie.vie}`)
      assert.ok(Number.isFinite(partie.ferraille) && partie.ferraille >= 0, `ferraille invalide sur ${carte.nom} : ${partie.ferraille}`)
      for (const en of partie.ennemis) {
        assert.ok(Number.isFinite(en.d) && en.d >= 0, `un ennemi a une position NaN sur ${carte.nom}`)
        assert.ok(Number.isFinite(en.vie), `un ennemi a une vie NaN sur ${carte.nom}`)
      }
      for (const t of partie.tours) assert.ok(t.recharge <= 100, `une tour a une recharge qui s’emballe sur ${carte.nom}`)
    }
    assert.ok(images < 2_000_000, `${carte.nom} ne termine jamais (ni victoire ni défaite en 100 vagues)`)
  }
})

// --- Sauvegarde ------------------------------------------------------------------

test('une sauvegarde d’un format incompatible ne plante pas : elle repart à neuf', () => {
  assert.equal(L.migre(null), null)
  assert.equal(L.migre({ eclats: 400 }), null, 'l’ancien format (sans version) doit être rejeté')
  assert.equal(L.migre({ v: 99, eclats: 400 }), null, 'une version différente doit être rejetée')
  assert.equal(L.migre('pas un objet'), null)
  assert.equal(L.migre(42), null)
})

test('une sauvegarde du bon format se relit sans rien perdre', () => {
  const meta = L.metaNeuve()
  meta.eclats = 250
  L.debloqueTour(meta, 'mitrailleuse')
  L.ameliore(meta, 'degats')
  L.debloqueCarte(meta, 'fourche')
  L.noteMeilleureVague(meta, 'pont', 12)
  const relu = L.migre(JSON.parse(JSON.stringify(L.sauvegarde(meta))))
  assert.ok(relu.toursDeblocs.includes('mitrailleuse'))
  assert.ok(relu.cartesDeblocs.includes('fourche'))
  assert.equal(relu.ameliorations.degats, 1)
  assert.equal(relu.meilleureVague.pont, 12)
  assert.equal(relu.eclats, meta.eclats)
})

test('une sauvegarde corrompue (déblocages inconnus, niveaux négatifs) ne fait planter ni migre ni le jeu', () => {
  const brut = {
    v: L.VERSION,
    eclats: -50,
    toursDeblocs: ['sentinelle', 'tour-qui-n-existe-plus'],
    cartesDeblocs: ['carte-fantome'],
    ameliorations: { degats: -3, piste_inconnue: 40 },
    parties: 'douze',
    meilleureVague: { pont: -1 },
  }
  const relu = L.migre(brut)
  assert.ok(relu)
  assert.ok(relu.eclats >= 0)
  assert.ok(relu.toursDeblocs.includes('sentinelle'))
  assert.ok(!relu.toursDeblocs.includes('tour-qui-n-existe-plus'))
  assert.ok(!relu.cartesDeblocs.includes('carte-fantome'))
  assert.equal(relu.ameliorations.piste_inconnue, undefined)
  assert.equal(relu.parties, 0)
})

// --- Le jeu entier, via le vrai chemin d'appui ---------------------------------------

/** Un automate minimal : choisit la première carte, remplit le plateau de SENTINELLEs, lance. */
function pilote() {
  return (j) => {
    const e = j.e
    const d = dispo(j)
    if (e.vue === 'menu') {
      const z = zoneCarte(d, 0)
      j.pointer.x = z.x + 10
      j.pointer.y = z.y + 10
      return 'appui'
    }
    const partie = e.partie
    if (!partie) return undefined
    if (partie.phase === 'defaite') {
      j.pointer.x = j.W / 2
      j.pointer.y = j.H / 2
      return 'appui'
    }
    if (partie.phase !== 'attente') return undefined
    const carte = L.carteParId(e.carteId)
    const libre = carte.emplacements.findIndex((_, i) => !partie.tours.some((t) => t.emplacement === i))
    if (libre >= 0) {
      if (!e.selection) {
        const z = zoneTourBoutique(d, 0)
        j.pointer.x = z.x + 5
        j.pointer.y = z.y + 5
        return 'appui'
      }
      const pos = carte.emplacements[libre]
      j.pointer.x = d.plateau.x + pos.x
      j.pointer.y = d.plateau.y + pos.y
      return 'appui'
    }
    j.pointer.x = d.lancer.x + 5
    j.pointer.y = d.lancer.y + 5
    return 'appui'
  }
}

test('une défense jouée pour de vrai ne plante jamais et ne peint jamais de NaN', () => {
  const memoire = { valeur: null }
  const hasard = graine(6)
  const { j, ctx } = joue(rempart, {
    duree: 90,
    dessine: true,
    memoire,
    hasard,
    format: 'paysage',
    pilote: pilote(),
  })

  assert.ok(j.e.partie === null || j.e.partie.vague > 0, 'aucune vague n’a été lancée en 90 s')
  for (const o of ctx.ops) {
    if (o.type !== 'texte') continue
    for (const v of [o.x, o.y, o.gauche, o.larg, o.taille]) assert.ok(Number.isFinite(v), `un texte peint une valeur NaN : ${o.s}`)
  }
  for (const o of ctx.ops) {
    const b = peintBornes(o)
    if (!b) continue
    assert.ok(b.x > -60 && b.x + b.w < j.W + 60, `dessine hors cadre horizontalement : ${JSON.stringify(o).slice(0, 90)}`)
  }

  rempart.quitte(j)
  assert.ok(memoire.valeur, 'rien n’a été sauvegardé')
  const relu = L.migre(JSON.parse(memoire.valeur))
  assert.ok(relu && Number.isFinite(relu.eclats), 'la sauvegarde ne se relit pas')
})

function peintBornes(o) {
  if (o.type === 'texte') return { x: o.gauche, y: o.y, w: o.larg, h: o.taille }
  return { x: o.x, y: o.y, w: o.w, h: o.h }
}

test('l’onglet TOURS et l’onglet AMÉLIORATIONS répondent au tap dans le menu, sans aucune tour posée', () => {
  const j = fauxJeu(rempart, { graine: 4, format: 'paysage' })
  j.e.meta.eclats = 1000

  const d = dispo(j)
  const zOnglet = zoneOnglet(d, 1) // AMÉLIORATIONS
  rempart.appui(j, { x: zOnglet.x + 5, y: zOnglet.y + 5 })
  assert.equal(j.e.ongletMenu, 'ameliorations')

  const zLigne = zoneLigne(d, 0)
  rempart.appui(j, { x: zLigne.x + 5, y: zLigne.y + 5 })
  assert.ok(j.e.meta.ameliorations[AMELIORATIONS_META[0].id] >= 1, 'l’achat n’a rien changé')
})

test('emplacementSous ne trouve rien loin d’un emplacement, et le bon près de lui', () => {
  const carte = CARTES[0]
  const d = dispo({ W: 640, H: 360, HUD: 56 })
  const e0 = carte.emplacements[0]
  const proche = emplacementSous(carte, d, { x: d.plateau.x + e0.x + 2, y: d.plateau.y + e0.y - 2 })
  assert.equal(proche, 0)
  const loin = emplacementSous(carte, d, { x: d.plateau.x + e0.x + 200, y: d.plateau.y + e0.y + 200 })
  assert.equal(loin, -1)
})

// --- Inspection d'une tour posée : appui court propose, appui long montre les stats ------

/** Entre dans LE PONT et pose une SENTINELLE sur le premier emplacement libre. */
function poseUneTour() {
  const j = fauxJeu(rempart, { graine: 4, format: 'paysage' })
  j.e.meta.eclats = 1000
  const d = dispo(j)
  rempart.appui(j, { x: zoneCarte(d, 0).x + 10, y: zoneCarte(d, 0).y + 10 })
  rempart.appui(j, { x: zoneTourBoutique(d, 0).x + 5, y: zoneTourBoutique(d, 0).y + 5 })
  const carte = L.carteParId(j.e.carteId)
  const pos = carte.emplacements[0]
  const p = { x: d.plateau.x + pos.x, y: d.plateau.y + pos.y }
  rempart.appui(j, p)
  const tour = j.e.partie.tours.find((t) => t.emplacement === 0)
  assert.ok(tour, 'la tour n’a pas été posée — le test lui-même est cassé')
  return { j, d, p, tour }
}

test('un appui bref sur une tour posée propose de l’améliorer, sans rien dépenser tout seul', () => {
  const { j, p, tour } = poseUneTour()
  const ferrailleAvant = j.e.partie.ferraille
  const niveauAvant = tour.niveau

  rempart.appui(j, p) // presse la tour posée
  assert.equal(j.e.appuiTour.instanceId, tour.instanceId)
  rempart.relache(j) // relâchée aussitôt, sans passer par `maj` : pas un maintien

  assert.equal(j.e.appuiTour, null)
  assert.equal(j.e.peekStats, null)
  assert.equal(j.e.propose, tour.instanceId, 'l’appui bref devrait proposer l’amélioration, pas l’appliquer')
  assert.equal(tour.niveau, niveauAvant, 'le niveau n’a pas dû bouger avant confirmation')
  assert.equal(j.e.partie.ferraille, ferrailleAvant, 'la ferraille n’a pas dû bouger avant confirmation')

  const bouton = zoneInspect(j).bouton
  rempart.appui(j, { x: bouton.x + 5, y: bouton.y + 5 })
  assert.equal(j.e.propose, null, 'confirmer referme la proposition')
  assert.equal(tour.niveau, niveauAvant + 1, 'confirmer doit améliorer la tour')
  assert.ok(j.e.partie.ferraille < ferrailleAvant, 'confirmer doit dépenser de la ferraille')
})

test('un appui tenu sur une tour posée montre ses stats et ne l’améliore jamais', () => {
  const { j, p, tour } = poseUneTour()
  const ferrailleAvant = j.e.partie.ferraille
  const niveauAvant = tour.niveau

  rempart.appui(j, p)
  j.maintenu = true
  for (let i = 0; i < 30; i++) rempart.maj(j, 1 / 60) // largement au-delà du seuil d'appui long

  assert.equal(j.e.peekStats, tour.instanceId, 'le maintien devrait afficher les stats')
  assert.equal(j.e.propose, null)

  j.maintenu = false
  rempart.relache(j)
  assert.equal(j.e.peekStats, null, 'les stats s’éteignent au relâchement, comme un simple coup d’œil')
  assert.equal(j.e.propose, null, 'un appui tenu ne doit jamais se transformer en proposition')
  assert.equal(tour.niveau, niveauAvant, 'regarder les stats ne doit jamais améliorer la tour')
  assert.equal(j.e.partie.ferraille, ferrailleAvant)
})

test('la proposition d’amélioration se referme sur un appui ailleurs, sans rien changer', () => {
  const { j, p, tour } = poseUneTour()
  rempart.appui(j, p)
  rempart.relache(j)
  assert.equal(j.e.propose, tour.instanceId)

  rempart.appui(j, { x: 2, y: 2 }) // loin du bouton, loin de tout
  assert.equal(j.e.propose, null)
  assert.equal(tour.niveau, 1)
})
