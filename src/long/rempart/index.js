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
import { TOURS, CARTES, AMELIORATIONS_META, LONG_APPUI } from './donnees.js'
import * as L from './logique.js'
import * as V from './vues.js'
import { dispo, dans, zoneCarte, zoneOnglet, zoneLigne, zoneTourBoutique, emplacementSous, toursBoutique, zoneInspect } from './dispo.js'

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
    j.e = {
      meta,
      vue: 'menu',
      ongletMenu: 'tours',
      carteId: null,
      partie: null,
      selection: null,
      // La tour qu'on est en train de presser (durée du maintien), celle
      // dont les stats s'affichent pendant qu'on la tient, et celle dont on
      // propose l'amélioration après un appui bref — jamais deux à la fois.
      appuiTour: null,
      peekStats: null,
      propose: null,
    }
  },

  /** Le plateau ne se recalcule pas d'un format à l'autre : on efface juste le choix en cours. */
  redim(j) {
    j.e.selection = null
    j.e.appuiTour = null
    j.e.peekStats = null
    j.e.propose = null
  },

  maj(j, dt) {
    const e = j.e

    // Tenir le doigt sur une tour posée en affiche les stats ; le relâcher
    // vite propose plutôt de l'améliorer — `appuiJeu`/`relacheJeu` décident,
    // ici on ne fait qu'écouter la durée, comme la croix de PICROSS.
    const a = e.appuiTour
    if (a && !a.fait && j.maintenu) {
      a.duree += dt
      if (a.duree >= LONG_APPUI) {
        a.fait = true
        e.propose = null
        e.peekStats = a.instanceId
        j.son.rebond()
      }
    }

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
    else if (e.peekStats) V.dessineInspection(ctx, j, e.partie, e.peekStats, false)
    else if (e.propose) V.dessineInspection(ctx, j, e.partie, e.propose, true)
  },

  appui(j, p) {
    const d = dispo(j)
    if (j.e.vue === 'menu') return appuiMenu(j, p, d)
    return appuiJeu(j, p, d)
  },

  relache(j) {
    if (j.e.vue === 'jeu') relacheJeu(j)
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
      e.appuiTour = null
      e.peekStats = null
      e.propose = null
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
    e.appuiTour = null
    e.peekStats = null
    e.propose = null
    return j.son.clic()
  }

  // Une proposition d'amélioration affichée n'attend que deux choses : le
  // bouton pour l'acheter, ou n'importe quel autre appui pour se refermer —
  // jamais les deux à la fois. Une fois refermée, l'appui continue son
  // chemin normalement : retaper la même tour la rouvre, taper ailleurs fait
  // ce que ça aurait fait sans la proposition ouverte.
  if (e.propose) {
    const tour = partie.tours.find((t) => t.instanceId === e.propose)
    if (tour && dans(p, zoneInspect(j).bouton)) {
      e.propose = null
      if (!L.ameliorerTour(partie, tour.instanceId)) return j.son.rate()
      j.son.niveau()
      const pos = carte.emplacements[tour.emplacement]
      return j.fx.eclat(d.plateau.x + pos.x, d.plateau.y + pos.y, L.tourParId(tour.tourId).couleur, { n: 10, vitesse: 140 })
    }
    e.propose = null
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
    // Ni amélioration ni stats tout de suite : on attend de savoir si
    // l'appui est bref (proposer d'améliorer) ou tenu (afficher les stats),
    // décidé par `maj` et `relacheJeu` — comme la croix de PICROSS.
    e.appuiTour = { instanceId: posee.instanceId, duree: 0, fait: false }
    return
  }

  if (!e.selection) return
  if (!L.poseTour(partie, e.meta, e.selection, iEmp)) return j.son.rate()
  j.son.clic()
  j.fx.eclat(ax, ay, L.tourParId(e.selection).couleur, { n: 14, vitesse: 160 })
}

function relacheJeu(j) {
  const e = j.e
  const a = e.appuiTour
  e.appuiTour = null
  if (!a) return
  if (a.fait) {
    // Ce n'était qu'un coup d'œil pendant le maintien : il s'éteint au
    // relâchement, sans rien proposer d'autre.
    e.peekStats = null
  } else {
    e.propose = a.instanceId
  }
}
