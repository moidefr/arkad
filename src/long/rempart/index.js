/**
 * REMPART — un tower defense à méta-progression persistante.
 *
 * Une défense se joue en temps réel (`maj(j, dt)` fait avancer les ennemis et
 * tirer les tours) mais ne « meurt » jamais au sens des jeux courts : perdre
 * une défense fait tomber le rempart, pas la partie. Ce qui distingue REMPART
 * d'un mini-jeu de tower defense, c'est que les ÉCLATS gagnés vague après
 * vague restent acquis même dans la défaite, et s'échangent — seulement entre
 * deux défenses, jamais pendant — contre de nouvelles tours et des
 * améliorations permanentes. C'est `logique.js` qui figure les bonus au
 * lancement de chaque défense : la partie en cours ne change jamais de force
 * sous le pied du joueur.
 *
 * Seule la méta-progression traverse une fermeture de l'appli, comme dans
 * RUÉE — une défense en cours n'est pas reprise au lancement suivant, mais
 * rien de ce qu'elle a déjà rapporté n'est perdu : les éclats sont crédités
 * vague par vague, pas à la fin.
 */
import { C } from '../../palette.js'
import { TOURS, CARTES, AMELIORATIONS_META } from './donnees.js'
import * as L from './logique.js'
import * as V from './vues.js'
import { dispo, dans, zoneCarte, zoneOnglet, zoneLigne, zoneTourBoutique, emplacementSous, toursBoutique } from './dispo.js'

export default {
  id: 'rempart',
  nom: 'REMPART',
  pitch: 'Chaque défense laisse quelque chose. La prochaine commence un peu plus forte',
  couleur: C.cyan,
  persistant: true,
  sansScore: true,
  // Un plateau avec un chemin d'un bord à l'autre et un panneau de boutique à
  // côté : c'est la disposition qui a le moins de raisons de changer entre
  // deux tailles d'écran, et paysage lui donne toute la largeur qu'il lui faut.
  paysage: true,
  confort: 'paysage',

  titreHud(j) {
    const e = j.e
    if (e.vue === 'jeu' && e.partie) {
      if (e.partie.phase === 'defaite') return 'LE REMPART TOMBE'
      return `VAGUE ${e.partie.vague} · VIE ${Math.ceil(e.partie.vie)}/${e.partie.vieMax}`
    }
    return `${e.meta.eclats} ÉCLATS`
  },

  init(j) {
    const meta = L.migre(j.charge()) ?? L.metaNeuve()
    j.e = { meta, vue: 'menu', ongletMenu: 'tours', carteId: null, partie: null, selection: null }
  },

  /** Le plateau ne se recalcule pas d'un format à l'autre : on efface juste le choix en cours. */
  redim(j) {
    j.e.selection = null
  },

  maj(j, dt) {
    const e = j.e
    if (e.vue !== 'jeu' || !e.partie) return
    const carte = L.carteParId(e.carteId)
    const rempart = carte.chemin[carte.chemin.length - 1]
    const d = dispo(j)
    const ax = d.plateau.x + rempart.x
    const ay = d.plateau.y + rempart.y

    L.avance(e.partie, dt, j.hasard, {
      ennemiTue: () => j.son.touche(3),
      percee: () => {
        j.son.rate()
        j.fx.secoue(4)
      },
      vagueTerminee: (vague, gain) => {
        j.son.record()
        L.crediteEclats(e.meta, gain)
        L.noteMeilleureVague(e.meta, e.carteId, vague)
        j.sauve(L.sauvegarde(e.meta))
        j.fx.bulle(ax, ay - 24, `+${gain} éclat${gain > 1 ? 's' : ''}`, C.accent, 14)
      },
      defaite: () => {
        j.son.mort()
        j.fx.secoue(10)
        j.fx.eclat(ax, ay, C.rouge, { n: 24, vitesse: 200 })
        L.noteDefaite(e.meta)
        j.sauve(L.sauvegarde(e.meta))
      },
    })
  },

  quitte(j) {
    j.sauve(L.sauvegarde(j.e.meta))
  },

  dessine(j, ctx) {
    const e = j.e
    const d = dispo(j)
    if (e.vue === 'menu') return V.dessineMenu(ctx, d, e.meta, e.ongletMenu)

    const carte = L.carteParId(e.carteId)
    V.dessinePlateau(ctx, d, carte, e.partie, e.selection)
    V.dessinePanneau(ctx, d, e.meta, e.partie, e.selection)
    if (e.partie.phase === 'defaite') V.dessineDefaite(ctx, j, e.partie)
  },

  appui(j, p) {
    const d = dispo(j)
    if (j.e.vue === 'menu') return appuiMenu(j, p, d)
    return appuiJeu(j, p, d)
  },
}

function appuiMenu(j, p, d) {
  const e = j.e

  const kCarte = CARTES.findIndex((_, k) => dans(p, zoneCarte(d, k)))
  if (kCarte >= 0) {
    const carte = CARTES[kCarte]
    if (e.meta.cartesDeblocs.includes(carte.id)) {
      e.carteId = carte.id
      e.partie = L.partieNeuve(carte.id, e.meta)
      e.selection = null
      e.vue = 'jeu'
      return j.son.clic()
    }
    if (L.debloqueCarte(e.meta, carte.id)) {
      j.son.record()
      return j.sauve(L.sauvegarde(e.meta))
    }
    return j.son.rate()
  }

  const kOnglet = V.ONGLETS_MENU.findIndex((_, k) => dans(p, zoneOnglet(d, k)))
  if (kOnglet >= 0) {
    e.ongletMenu = V.ONGLETS_MENU[kOnglet].id
    return j.son.clic()
  }

  if (e.ongletMenu === 'tours') {
    const kTour = TOURS.findIndex((_, k) => dans(p, zoneLigne(d, k)))
    if (kTour < 0) return
    if (L.debloqueTour(e.meta, TOURS[kTour].id)) {
      j.son.record()
      return j.sauve(L.sauvegarde(e.meta))
    }
    return j.son.rate()
  }

  const kAm = AMELIORATIONS_META.findIndex((_, k) => dans(p, zoneLigne(d, k)))
  if (kAm < 0) return
  if (L.ameliore(e.meta, AMELIORATIONS_META[kAm].id)) {
    j.son.record()
    return j.sauve(L.sauvegarde(e.meta))
  }
  return j.son.rate()
}

function appuiJeu(j, p, d) {
  const e = j.e
  const partie = e.partie
  const carte = L.carteParId(e.carteId)

  // La défaite se referme d'un appui, n'importe où : rien à viser, la
  // défense est finie.
  if (partie.phase === 'defaite') {
    e.vue = 'menu'
    e.partie = null
    e.selection = null
    return j.son.clic()
  }

  const enBoutique = toursBoutique(e.meta)
  const kTour = enBoutique.findIndex((_, k) => dans(p, zoneTourBoutique(d, k)))
  if (kTour >= 0) {
    const id = enBoutique[kTour].id
    e.selection = e.selection === id ? null : id
    return j.son.clic()
  }

  if (partie.phase === 'attente' && dans(p, d.lancer)) {
    L.lanceVagueMaintenant(partie)
    return j.son.clic()
  }

  if (!dans(p, d.plateau)) return
  const iEmp = emplacementSous(carte, d, p)
  if (iEmp < 0) return
  const pos = carte.emplacements[iEmp]
  const ax = d.plateau.x + pos.x
  const ay = d.plateau.y + pos.y

  const posee = partie.tours.find((t) => t.emplacement === iEmp)
  if (posee) {
    if (!L.ameliorerTour(partie, posee.instanceId)) return j.son.rate()
    j.son.niveau()
    return j.fx.eclat(ax, ay, L.tourParId(posee.tourId).couleur, { n: 10, vitesse: 140 })
  }

  if (!e.selection) return
  if (!L.poseTour(partie, e.meta, e.selection, iEmp)) return j.son.rate()
  j.son.clic()
  j.fx.eclat(ax, ay, L.tourParId(e.selection).couleur, { n: 14, vitesse: 160 })
}
