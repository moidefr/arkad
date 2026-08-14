/**
 * FRONT vu du doigt.
 *
 * Ce test joue **par le vrai chemin d'appui** : il dessine, cherche la zone
 * tactile là où elle a été peinte, et tape dedans. C'est la leçon du bug de
 * l'usine, où plus rien n'était achetable pendant que les tests tapaient au
 * hasard en vérifiant seulement que rien ne plantait. Ici, chaque geste doit
 * **changer quelque chose**, et on l'affirme.
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import front from '../src/massif/front.js'
import * as B from '../src/massif/front/bataille.js'
import * as Cie from '../src/massif/front/compagnie.js'
import { fauxJeu, fauxCtx, PAS, W, H, HUD } from './faux.js'
import * as VC from '../src/massif/front/vue/champ.js'
import * as VD from '../src/massif/front/vue/dispo.js'
import { cle } from '../src/massif/front/hex.js'
import { OBJECTIFS } from '../src/massif/front/carte.js'
import { APT } from '../src/massif/front/donnees/aptitudes.js'
import { largeurTexte } from '../src/dessin.js'

/** La fenêtre du champ, telle que le jeu la calcule lui-même. */
const champDe = (j) => VD.bataille(j).champ

const dessine = (j) => {
  const ctx = fauxCtx()
  front.dessine(j, ctx)
  return ctx
}

/** Tape au centre d'une zone, en passant par dessin → appui → relâchement. */
function tape(j, quoi, filtre) {
  dessine(j)
  const z = j.e.zones.find((x) => x.quoi === quoi && (!filtre || filtre(x)))
  assert.ok(z, `aucune zone « ${quoi} » à l’écran ${j.e.vue}`)
  const p = { x: z.x + z.w / 2, y: z.y + z.h / 2 }
  front.appui(j, p)
  front.relache(j, p)
  return z
}

/** Tape sur un hexagone précis du champ de bataille. */
function tapeHex(j, q, r) {
  dessine(j)
  const ch = champDe(j)
  const p = VC.place(ch, j.e.vueChamp, q, r)
  assert.ok(p.y > ch.y && p.y < ch.y + ch.h, `l’hexagone ${q},${r} n’est pas à l’écran`)
  front.appui(j, p)
  front.relache(j, p)
  return p
}

/** Un point est-il dans la fenêtre du champ ? */
const visible = (j, p) => VC.dansChamp(champDe(j), p)

/** Une partie amenée jusqu'à la bataille, en tapant comme un joueur. */
function jusquAuFeu(graine = 5) {
  const j = fauxJeu(front, { graine, neuve: true })
  tape(j, 'nouvelle')
  assert.equal(j.e.vue, 'camp')
  tape(j, 'campagne')
  tape(j, 'offre', (z) => z.k === 0)
  tape(j, 'engager')
  assert.equal(j.e.vue, 'bataille', 'l’engagement n’a pas démarré')
  return j
}

// --- L'enchaînement des écrans ---------------------------------------------------

test('on lève une compagnie et on arrive au camp en un appui', () => {
  const j = fauxJeu(front, { graine: 1, neuve: true })
  assert.equal(j.e.vue, 'titre')
  tape(j, 'nouvelle')
  assert.equal(j.e.vue, 'camp')
  assert.ok(j.e.c.troupes.length === 3)
  assert.ok(j.e.c.or > 0)
})

test('chaque écran du camp s’ouvre et se referme', () => {
  const j = fauxJeu(front, { graine: 2, neuve: true })
  tape(j, 'nouvelle')
  for (const ecran of ['campagne', 'caserne', 'uniques', 'compagnie', 'ville']) {
    tape(j, ecran)
    assert.equal(j.e.vue, ecran, `${ecran} ne s’ouvre pas`)
    tape(j, 'retour')
    assert.equal(j.e.vue, 'camp', `${ecran} ne se referme pas`)
  }
})

test('la ville ouvre le détail d’un bâtiment, qui se construit et se referme', () => {
  const j = fauxJeu(front, { graine: 8, neuve: true })
  tape(j, 'nouvelle')
  j.e.c.or = 999999
  j.e.c.niveau = 8
  tape(j, 'ville')
  const z = tape(j, 'batiment', (x) => x.id === 'caserne')
  assert.equal(j.e.vue, 'batiment')
  assert.equal(j.e.batimentId, z.id)
  tape(j, 'construire')
  assert.equal(j.e.c.ville.bat.caserne, 1, 'construire ne construit rien')
  tape(j, 'retour')
  assert.equal(j.e.vue, 'ville', 'le détail ne revient pas à la liste des bâtiments')
  tape(j, 'retour')
  assert.equal(j.e.vue, 'camp', 'la liste des bâtiments ne revient pas au camp')
})

test('recruter à la caserne coûte de l’or et ajoute vraiment une troupe', () => {
  const j = fauxJeu(front, { graine: 3, neuve: true })
  tape(j, 'nouvelle')
  j.e.c.or = 5000
  tape(j, 'caserne')
  const avant = { or: j.e.c.or, n: j.e.c.troupes.length }
  const z = tape(j, 'recrute')
  assert.equal(j.e.c.troupes.length, avant.n + 1, 'aucune recrue')
  assert.ok(j.e.c.or < avant.or, 'le recrutement est gratuit')
  assert.ok(!j.e.c.offre.caserne.some((l) => l.cl === z.cl), 'la ligne reste à l’étal')
})

test('recruter un unique le fait monter en ligne tout de suite', () => {
  const j = fauxJeu(front, { graine: 4, neuve: true })
  tape(j, 'nouvelle')
  j.e.c.or = 99999
  j.e.c.niveau = 6
  Cie.rafraichit(j.e.c)
  tape(j, 'uniques')
  const z = tape(j, 'recruteUnique')
  const recrue = j.e.c.troupes.find((t) => t.uq === z.uq)
  assert.ok(recrue, 'l’unique n’a pas été recruté')
  assert.ok(j.e.c.uniquesVus.includes(z.uq))
  assert.ok(Cie.escouadeDe(j.e.c, recrue.id), 'l’unique dort au dépôt')
})

test('on affecte une troupe à une escouade en deux appuis', () => {
  const j = fauxJeu(front, { graine: 6, neuve: true })
  tape(j, 'nouvelle')
  tape(j, 'compagnie')
  const cible = j.e.c.troupes[0]
  tape(j, 'troupe', (z) => z.id === cible.id)
  assert.equal(j.e.selTroupe, cible.id)
  tape(j, 'depot')
  assert.equal(Cie.escouadeDe(j.e.c, cible.id), null, 'le retrait au dépôt ne fait rien')
  tape(j, 'affecte', (z) => z.k === 0)
  assert.ok(Cie.escouadeDe(j.e.c, cible.id), 'l’affectation ne fait rien')
})

test('la fiche d’une troupe s’ouvre, soigne, et le soin coûte', () => {
  const j = fauxJeu(front, { graine: 7, neuve: true })
  tape(j, 'nouvelle')
  tape(j, 'compagnie')
  const u = j.e.c.troupes[0]
  u.pv = 4
  j.e.c.or = 5000
  tape(j, 'troupe', (z) => z.id === u.id)
  tape(j, 'fiche')
  assert.equal(j.e.vue, 'fiche')
  const avant = j.e.c.or
  tape(j, 'soigne')
  assert.ok(u.pv > 4, 'le soin ne soigne pas')
  assert.ok(j.e.c.or < avant, 'le soin est gratuit')
})

test('la fiche équipe et déséquipe une troupe, par le vrai chemin d’appui', () => {
  const j = fauxJeu(front, { graine: 9, neuve: true })
  tape(j, 'nouvelle')
  const u = j.e.c.troupes[0]
  j.e.c.objets.push({ id: 'lame_courte', tier: 1 })
  tape(j, 'compagnie')
  tape(j, 'troupe', (z) => z.id === u.id)
  tape(j, 'fiche')

  const zVide = tape(j, 'equipSlot', (z) => z.slot === 'arme')
  assert.equal(j.e.selEquip, 'arme', 'le tap sur l’emplacement n’ouvre pas le sélecteur')
  tape(j, 'poseEquip')
  assert.deepEqual(u.equip.arme, { id: 'lame_courte', tier: 1 }, 'l’objet ne s’équipe pas')
  assert.equal(j.e.c.objets.length, 0, 'l’objet reste au dépôt en plus d’être équipé')
  assert.equal(j.e.selEquip, null, 'le sélecteur reste ouvert après le choix')

  tape(j, 'equipSlot', (z) => z.slot === 'arme')
  tape(j, 'deposeEquip')
  assert.equal(u.equip.arme, null, 'le retrait ne retire rien')
  assert.equal(j.e.c.objets.length, 1, 'l’objet retiré ne revient pas au dépôt')
})

test('taper deux fois le même emplacement referme le sélecteur sans rien choisir', () => {
  const j = fauxJeu(front, { graine: 10, neuve: true })
  tape(j, 'nouvelle')
  tape(j, 'compagnie')
  tape(j, 'troupe', (z) => z.id === j.e.c.troupes[0].id)
  tape(j, 'fiche')
  tape(j, 'equipSlot', (z) => z.slot === 'armure')
  assert.equal(j.e.selEquip, 'armure')
  tape(j, 'equipSlot', (z) => z.slot === 'armure')
  assert.equal(j.e.selEquip, null, 'un second tap sur le même emplacement ne referme rien')
})

test('une aptitude se déplie et se replie au tap, sans rien casser autour', () => {
  const j = fauxJeu(front, { graine: 11, neuve: true })
  tape(j, 'nouvelle')
  tape(j, 'compagnie')
  tape(j, 'troupe', (z) => z.id === j.e.c.troupes[0].id)
  tape(j, 'fiche')
  const z = tape(j, 'aptToggle')
  assert.ok(j.e.aptOuvertes.has(z.id), 'le tap n’ouvre pas la description')
  tape(j, 'aptToggle', (x) => x.id === z.id)
  assert.ok(!j.e.aptOuvertes.has(z.id), 'un second tap ne referme pas la description')
})

// --- La bataille -------------------------------------------------------------------

test('on engage, et le champ est planté avec les deux armées', () => {
  const j = jusquAuFeu()
  const bat = j.e.bat
  assert.ok(B.vivantes(bat, 0).length >= 3)
  assert.ok(B.vivantes(bat, 1).length >= 1)
  assert.equal(bat.camp, 0)
  assert.ok(j.e.vueChamp.R >= 19, 'les hexagones sont trop petits pour le doigt')
})

test('une vignette choisit la troupe et recentre la caméra dessus', () => {
  const j = jusquAuFeu()
  const u = B.vivantes(j.e.bat, 0)[1]
  tape(j, 'troupe', (z) => z.ref === u.ref)
  assert.equal(j.e.sel.unite, u, 'la vignette ne choisit rien')
  const p = VC.place(champDe(j), j.e.vueChamp, u.q, u.r)
  assert.ok(visible(j, p), 'la troupe choisie n’est pas à l’écran')
  assert.ok(j.e.sel.deplacements.size > 0, 'aucune case atteignable proposée')
})

test('un appui sur une case atteignable déplace la troupe, et REVENIR la ramène', () => {
  const j = jusquAuFeu()
  const u = B.vivantes(j.e.bat, 0)[0]
  tape(j, 'troupe', (z) => z.ref === u.ref)
  const depart = { q: u.q, r: u.r, pm: u.pm }
  const dest = [...j.e.sel.deplacements]
    .map((k) => k.split(':').map(Number))
    .find(([q, r]) => {
      const ch = champDe(j)
      const p = VC.place(ch, j.e.vueChamp, q, r)
      return p.y > ch.y + 20 && p.y < ch.y + ch.h - 20
    })
  assert.ok(dest, 'aucune case atteignable visible')
  tapeHex(j, dest[0], dest[1])
  assert.ok(u.q !== depart.q || u.r !== depart.r, 'la troupe n’a pas bougé')
  assert.ok(u.pm < depart.pm, 'le déplacement est gratuit')
  tape(j, 'annuler')
  assert.deepEqual({ q: u.q, r: u.r, pm: u.pm }, depart, 'REVENIR ne remet pas en place')
})

test('un glissement ne déplace jamais une troupe', () => {
  const j = jusquAuFeu()
  const u = B.vivantes(j.e.bat, 0)[0]
  tape(j, 'troupe', (z) => z.ref === u.ref)
  const depart = { q: u.q, r: u.r }
  dessine(j)
  const p = VC.place(champDe(j), j.e.vueChamp, u.q, u.r)
  front.appui(j, { x: p.x, y: p.y })
  j.maintenu = true
  for (let i = 1; i <= 8; i++) {
    j.pointer.x = p.x - i * 6
    j.pointer.y = p.y - i * 3
    front.maj(j, PAS)
  }
  j.maintenu = false
  front.relache(j, { x: j.pointer.x, y: j.pointer.y })
  assert.deepEqual({ q: u.q, r: u.r }, depart, 'un glissement a déplacé la troupe')
  assert.ok(j.e.vueChamp.cam.x !== 0 || j.e.vueChamp.cam.y !== 0)
})

test('viser affiche exactement les dégâts que la frappe inflige', () => {
  // On monte une bataille où deux troupes se touchent, pour être sûr d'avoir
  // une cible dès le premier tour.
  const j = jusquAuFeu(11)
  const bat = j.e.bat
  const mien = B.vivantes(bat, 0)[0]
  const sien = B.vivantes(bat, 1)[0]
  const voisin = { q: sien.q + 1, r: sien.r }
  mien.q = voisin.q
  mien.r = voisin.r
  mien.depart = { q: mien.q, r: mien.r, pm: mien.pm }
  tape(j, 'troupe', (z) => z.ref === mien.ref)
  assert.ok(j.e.sel.ciblesUnite.includes(sien), 'la cible voisine n’est pas proposée')

  tapeHex(j, sien.q, sien.r)
  assert.equal(j.e.sel.visee, sien, 'l’appui sur l’ennemi n’ouvre pas la prévision')
  const prevu = B.prevision(bat, mien, sien)
  const pvAvant = sien.pv
  tape(j, 'confirme')
  assert.equal(sien.pv, Math.max(0, pvAvant - prevu.final), 'les dégâts annoncés ne sont pas ceux qui tombent')
  assert.ok(mien.aAgi, 'la troupe a frappé sans dépenser son action')
})

test('un ordre à soi part réellement, par le vrai chemin d’appui — régression', () => {
  // L'éclaireur du départ porte SPRINT (forme « soi ») depuis le lot 2 : ce
  // chemin plantait, sel.apt n'étant posé qu'après le court-circuit qui
  // lance l'ordre self-target tout de suite.
  const j = jusquAuFeu()
  const eclaireur = B.vivantes(j.e.bat, 0).find((u) => u.cl === 'eclaireur')
  assert.ok(eclaireur, 'la compagnie de départ n’a pas d’éclaireur')
  tape(j, 'troupe', (z) => z.ref === eclaireur.ref)
  assert.ok(B.ordresJouables(j.e.bat, eclaireur).some((a) => a.id === 'sprint'))
  const avant = eclaireur.pm
  dessine(j)
  const zOrdre = j.e.zones.find((z) => z.quoi === 'ordre' && z.id === 'sprint')
  assert.ok(zOrdre, 'le bouton SPRINT n’apparaît pas')
  const p = { x: zOrdre.x + zOrdre.w / 2, y: zOrdre.y + zOrdre.h / 2 }
  front.appui(j, p)
  front.relache(j, p)
  assert.ok(eclaireur.pm > avant, 'sprint n’a donné aucun point de mouvement')
  assert.ok(B.froidDe(eclaireur, 'sprint') > 0, 'sprint n’a pas pris son refroidissement')
})

test('un ordre ciblé montre sa prévision avant de partir, et RENONCER annule tout', () => {
  const j = jusquAuFeu(11)
  const bat = j.e.bat
  const archer = B.vivantes(bat, 0).find((u) => u.cl === 'archer')
  assert.ok(archer, 'la compagnie de départ n’a pas d’archer')
  const ennemi = B.vivantes(bat, 1)[0]
  ennemi.q = archer.q + 1
  ennemi.r = archer.r
  tape(j, 'troupe', (z) => z.ref === archer.ref)
  dessine(j)
  const zOrdre = j.e.zones.find((z) => z.quoi === 'ordre')
  assert.ok(zOrdre, 'aucun bouton d’ordre pour l’archer')
  const p1 = { x: zOrdre.x + zOrdre.w / 2, y: zOrdre.y + zOrdre.h / 2 }
  front.appui(j, p1)
  front.relache(j, p1)
  assert.equal(j.e.sel.mode, 'ordre')

  tapeHex(j, ennemi.q, ennemi.r)
  assert.ok(j.e.sel.previsionOrdre, 'la case choisie n’ouvre pas la prévision — l’ordre est parti tout de suite')
  const pvAvant = ennemi.pv
  dessine(j)
  assert.ok(
    j.e.zones.some((z) => z.quoi === 'confirmeOrdre'),
    'aucun bouton LANCER',
  )
  assert.ok(
    j.e.zones.some((z) => z.quoi === 'renonceOrdre'),
    'aucun bouton RENONCER',
  )

  tape(j, 'renonceOrdre')
  assert.equal(ennemi.pv, pvAvant, 'renoncer a quand même changé des points de vie')
  assert.equal(j.e.sel.previsionOrdre, null)
  assert.equal(j.e.sel.unite, archer, 'renoncer a perdu la troupe choisie')
})

test('CONFIRMER un ordre applique exactement ce que la prévision annonçait', () => {
  const j = jusquAuFeu(19)
  const bat = j.e.bat
  const archer = B.vivantes(bat, 0).find((u) => u.cl === 'archer')
  assert.ok(archer)
  const ennemi = B.vivantes(bat, 1)[0]
  ennemi.q = archer.q + 1
  ennemi.r = archer.r
  tape(j, 'troupe', (z) => z.ref === archer.ref)
  dessine(j)
  const zOrdre = j.e.zones.find((z) => z.quoi === 'ordre')
  const p1 = { x: zOrdre.x + zOrdre.w / 2, y: zOrdre.y + zOrdre.h / 2 }
  front.appui(j, p1)
  front.relache(j, p1)
  tapeHex(j, ennemi.q, ennemi.r)

  const prevu = B.previsionOrdre(bat, archer, APT.tir_rapide, j.e.sel.previsionOrdre)
  const pvAvant = ennemi.pv
  tape(j, 'confirmeOrdre')
  assert.equal(
    ennemi.pv,
    Math.max(0, pvAvant - prevu.cibles[0].degats),
    'les dégâts annoncés ne sont pas ceux qui tombent',
  )
  assert.ok(B.froidDe(archer, 'tir_rapide') > 0, 'l’ordre n’a pas pris son refroidissement')
  // Un ordre qui termine le tour désélectionne la troupe (elle a fini de
  // jouer) : sel.previsionOrdre disparaît alors avec tout sel, pas mis à
  // null explicitement — les deux disent « plus rien en attente ».
  assert.ok(!j.e.sel.previsionOrdre, 'la prévision reste ouverte après confirmation')
})

test('un tap qui ne touche rien perd la sélection choisie', () => {
  const j = jusquAuFeu(23)
  const u = B.vivantes(j.e.bat, 0)[0]
  tape(j, 'troupe', (z) => z.ref === u.ref)
  assert.equal(j.e.sel.unite, u)
  dessine(j)
  const ch = champDe(j)
  let cible = null
  for (let q = -10; q <= 10 && !cible; q++) {
    for (let r = -10; r <= 10 && !cible; r++) {
      if (j.e.sel.deplacements.has(cle(q, r)) || B.uniteA(j.e.bat, q, r)) continue
      const p = VC.place(ch, j.e.vueChamp, q, r)
      if (visible(j, p)) cible = p
    }
  }
  assert.ok(cible, 'aucun hexagone vide visible pour ce test')
  front.appui(j, cible)
  front.relache(j, cible)
  assert.equal(j.e.sel.unite, undefined, 'la sélection survit à un tap dans le vide')
})

test('le journal reste visible pendant la sélection d’une troupe', () => {
  const j = jusquAuFeu(29)
  const u = B.vivantes(j.e.bat, 0)[0]
  const cible = B.vivantes(j.e.bat, 1)[0]
  u.q = cible.q + 1
  u.r = cible.r
  B.attaque(j.e.bat, u, cible)
  assert.ok(j.e.bat.journal.length, 'l’attaque n’a rien écrit au journal')
  const autre = B.vivantes(j.e.bat, 0).find((x) => x.ref !== u.ref)
  tape(j, 'troupe', (z) => z.ref === autre.ref)
  const ctx = dessine(j)
  const dernier = j.e.bat.journal.at(-1)
  const vu = ctx.ops.some((o) => o.type === 'texte' && dernier.startsWith(o.s.replace('…', '')))
  assert.ok(vu, 'le journal a disparu pendant la sélection d’une troupe')
})

test('rompre le combat demande deux appuis', () => {
  const j = jusquAuFeu(13)
  tape(j, 'retraite')
  assert.equal(j.e.bat.fini, null, 'un seul appui a suffi à rompre')
  tape(j, 'retraite')
  assert.equal(j.e.bat.fini, 'retraite')
})

test('le zoom change la taille des hexagones sans perdre la troupe choisie', () => {
  const j = jusquAuFeu(17)
  const u = B.vivantes(j.e.bat, 0)[0]
  tape(j, 'troupe', (z) => z.ref === u.ref)
  const avant = j.e.vueChamp.R
  tape(j, 'zoom')
  assert.notEqual(j.e.vueChamp.R, avant, 'le zoom ne change rien')
  assert.equal(j.e.sel.unite, u)
  const p = VC.place(champDe(j), j.e.vueChamp, u.q, u.r)
  assert.ok(visible(j, p), 'la troupe choisie est sortie de l’écran')
})

test('une bataille se joue jusqu’au bilan, rien qu’en passant les tours', () => {
  const j = jusquAuFeu(23)
  for (let garde = 0; garde < 3000 && j.e.vue === 'bataille'; garde++) {
    if (j.e.bat && j.e.bat.camp === 0 && !j.e.bat.fini) tape(j, 'finTour')
    front.maj(j, PAS)
    dessine(j)
  }
  assert.equal(j.e.vue, 'bilan', 'la bataille ne se termine pas')
  assert.ok(j.e.rapport, 'aucun rapport')
  tape(j, 'suite')
  assert.ok(j.e.vue === 'camp' || j.fini, 'on ne revient pas au camp')
})

test('la partie se sauvegarde et se relit en pleine bataille', () => {
  const memoire = { valeur: null }
  const j = fauxJeu(front, { graine: 29, neuve: true, memoire })
  tape(j, 'nouvelle')
  tape(j, 'campagne')
  tape(j, 'offre', (z) => z.k === 0)
  tape(j, 'engager')
  const u = B.vivantes(j.e.bat, 0)[0]
  tape(j, 'troupe', (z) => z.ref === u.ref)
  tape(j, 'finTour')
  for (let i = 0; i < 600; i++) front.maj(j, PAS)
  front.quitte(j)

  const relu = fauxJeu(front, { memoire })
  assert.equal(relu.e.vue, 'bataille', 'la bataille en cours est perdue')
  assert.equal(relu.e.bat.tour, j.e.bat?.tour ?? relu.e.bat.tour)
  assert.equal(relu.e.c.troupes.length, j.e.c.troupes.length)
  // Et elle se rejoue : les objets relus sont bien des objets de bataille.
  assert.ok(B.vivantes(relu.e.bat, 0).length > 0)
  dessine(relu)
  assert.ok(relu.e.zones.length > 0)
})

// --- Les contraintes d'écran -----------------------------------------------------------

/** Tous les écrans, chacun dans un état où il a quelque chose à montrer. */
function tousLesEcrans() {
  const ecrans = []
  const j = fauxJeu(front, { graine: 31, neuve: true })
  ecrans.push(['titre', dessine(j), j.e.zones.slice()])
  tape(j, 'nouvelle')
  j.e.c.or = 99999
  j.e.c.niveau = 8
  Cie.rafraichit(j.e.c)
  for (const vue of ['camp', 'campagne', 'caserne', 'uniques', 'compagnie']) {
    j.e.vue = vue
    if (vue === 'campagne') j.e.choix = 0
    if (vue === 'compagnie') j.e.selTroupe = j.e.c.troupes[0].id
    ecrans.push([vue, dessine(j), j.e.zones.slice()])
  }
  j.e.vue = 'fiche'
  ecrans.push(['fiche', dessine(j), j.e.zones.slice()])

  // La ville, et un bâtiment de chaque genre : un sans rien de propre
  // (l'infirmerie), un avec une fenêtre en plus (la caserne, ses sessions).
  j.e.vue = 'ville'
  ecrans.push(['ville', dessine(j), j.e.zones.slice()])
  j.e.c.ville.bat.caserne = 2
  j.e.vue = 'batiment'
  j.e.batimentId = 'caserne'
  ecrans.push(['batiment/caserne', dessine(j), j.e.zones.slice()])
  j.e.batimentId = 'infirmerie'
  ecrans.push(['batiment/infirmerie', dessine(j), j.e.zones.slice()])

  const k = jusquAuFeu(37)
  ecrans.push(['bataille', dessine(k), k.e.zones.slice()])
  const u = B.vivantes(k.e.bat, 0)[0]
  tape(k, 'troupe', (z) => z.ref === u.ref)
  ecrans.push(['bataille/troupe', dessine(k), k.e.zones.slice()])
  const sien = B.vivantes(k.e.bat, 1)[0]
  u.q = sien.q + 1
  u.r = sien.r
  k.e.sel.visee = sien
  ecrans.push(['bataille/prévision', dessine(k), k.e.zones.slice()])
  k.e.sel = { inspect: sien }
  ecrans.push(['bataille/ennemi', dessine(k), k.e.zones.slice()])

  k.e.bat.fini = 'gagne'
  front.maj(k, PAS)
  ecrans.push(['bilan', dessine(k), k.e.zones.slice()])
  return ecrans
}

test('aucune zone tactile ne sort de l’écran ni ne passe sous le bandeau', () => {
  for (const [nom, , zones] of tousLesEcrans()) {
    for (const z of zones) {
      assert.ok(z.y >= HUD, `${nom} : une zone démarre à ${z.y}, sous le bandeau du moteur`)
      assert.ok(z.y + z.h <= H, `${nom} : une zone finit à ${z.y + z.h}, hors de l’écran`)
      assert.ok(z.x >= 0 && z.x + z.w <= W, `${nom} : une zone déborde en largeur`)
      assert.ok(z.w >= 40 && z.h >= 24, `${nom} : une zone de ${z.w}×${z.h} est trop petite pour un doigt`)
    }
  }
})

test('deux zones ne se recouvrent jamais sur un même écran', () => {
  for (const [nom, , zones] of tousLesEcrans()) {
    for (let i = 0; i < zones.length; i++) {
      for (let k = i + 1; k < zones.length; k++) {
        const a = zones[i]
        const b = zones[k]
        const chevauche = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
        assert.ok(!chevauche, `${nom} : « ${a.quoi} » et « ${b.quoi} » se recouvrent`)
      }
    }
  }
})

test('rien ne se dessine hors de l’écran', () => {
  for (const [nom, ctx] of tousLesEcrans()) {
    for (const op of ctx.ops) {
      if (op.alpha === 0) continue
      assert.ok(op.x > -200 && op.x < W + 200, `${nom} : dessin à x=${Math.round(op.x)}`)
      assert.ok(op.y > -200 && op.y < H + 200, `${nom} : dessin à y=${Math.round(op.y)}`)
    }
  }
})

test('chaque écran dessine réellement quelque chose', () => {
  for (const [nom, ctx, zones] of tousLesEcrans()) {
    assert.ok(ctx.ops.length > 14, `${nom} : écran presque vide (${ctx.ops.length} traits)`)
    assert.ok(zones.length > 0, `${nom} : aucun bouton`)
    assert.ok(
      ctx.ops.some((o) => o.type === 'texte' && o.s.length > 2),
      `${nom} : aucun texte`,
    )
  }
})

test('le libellé d’objectif tient dans la place que lui laisse le bandeau', () => {
  const ctx = fauxCtx()
  for (const o of OBJECTIFS) {
    const c = Cie.nouvelle(5)
    c.niveau = 12
    Cie.planifie(c)
    c.plan[0].objectif = o.id
    const bat = Cie.prepare(c, 0)
    const s = B.etatObjectif(bat)
    // 118 px : ce que laisse le bouton ZOOM, qui commence à x = 136.
    assert.ok(largeurTexte(ctx, s, 11) <= 118, `« ${s} » fait ${Math.round(largeurTexte(ctx, s, 11))} px`)
  }
})
