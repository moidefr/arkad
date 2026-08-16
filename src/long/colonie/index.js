/**
 * COLONIE — une population qui mange, qui construit, qui grandit, ou qui
 * s'éteint si on la néglige.
 *
 * La différence avec l'USINE tient en une phrase : l'USINE ne meurt jamais
 * (au pire elle stagne), COLONIE le peut. La nourriture nourrit la
 * population, la population fournit les bras, les bras font tourner les
 * bâtiments, les bâtiments produisent de nouvelles ressources qui reviennent
 * nourrir la colonie — un vrai réseau plutôt qu'une ligne, et casser un
 * maillon fait reculer tous les autres.
 */
import { C } from '../../palette.js'
import { texte } from '../../dessin.js'
import { BATIMENTS } from './donnees.js'
import * as L from './logique.js'
import * as V from './vues.js'
import { dispo, zoneOnglet, zoneBatiment, dans } from './dispo.js'

const SAUVE_PAS = 4 // secondes entre deux écritures : chaque tour n'a pas besoin de son sauvegarde

export default {
  id: 'colonie',
  nom: 'COLONIE',
  pitch: 'Une population qui mange, qui construit, qui grandit — ou qui s’éteint si on la néglige',
  couleur: C.rouge,
  sansScore: true,
  persistant: true,

  titreHud: (j) => `${Math.floor(j.e.e.population)} / ${L.logements(j.e.e)} HABITANTS`,
  finTitre: () => ({ texte: 'COLONIE ÉTEINTE', couleur: C.rouge }),

  init(j) {
    const e = L.migre(j.charge()) ?? L.neuve()
    const horsLigne = L.credite(e, j.hasard)
    const avis =
      e.population > 0 && horsLigne > 60 ? { texte: `pendant ton absence : ${L.duree(horsLigne)} ont passé`, reste: 4 } : null
    j.e = { e, palier: 0, depuisSauve: 0, avis }
  },

  // Une colonie déjà éteinte (morte pendant l'absence, voir `credite` dans
  // `init`) traverse `avance` comme n'importe quelle autre image : la garde
  // vit dans `logique.js`, pas ici, pour ne l'écrire qu'une fois.
  maj(j, dt) {
    const e = j.e.e

    if (j.e.avis) {
      j.e.avis.reste -= dt
      if (j.e.avis.reste <= 0) j.e.avis = null
    }

    const ev = L.avance(e, dt, j.hasard)
    if (ev.abandon !== undefined) {
      j.son.rate()
      j.fx.bulle(j.W / 2, 200, `${BATIMENTS[ev.abandon].nom} ABANDONNÉ`, C.rouge, 14)
      j.e.avis = { texte: `la famine a coûté un(e) ${BATIMENTS[ev.abandon].nom.toLowerCase()}`, reste: 4 }
    }

    if (ev.effondree) {
      j.son.rate()
      j.fx.eclat(j.W / 2, j.H / 2, C.rouge, { n: 30, vitesse: 220 })
      j.efface()
      return j.perdu()
    }

    j.e.depuisSauve += dt
    if (j.e.depuisSauve > SAUVE_PAS) {
      j.e.depuisSauve = 0
      j.sauve(L.sauvegarde(e))
    }
  },

  quitte: (j) => j.e.e.population > 0 && j.sauve(L.sauvegarde(j.e.e)),

  dessine(j, ctx) {
    const d = dispo(j)
    V.dessine(ctx, d, j, j.e.e, j.e.palier)
    if (j.e.avis?.texte) {
      ctx.globalAlpha = Math.min(1, j.e.avis.reste)
      ctx.textAlign = 'center'
      texte(ctx, j.e.avis.texte, j.W / 2, j.H - 16, 12, C.accent, 700, j.W - 40)
      ctx.globalAlpha = 1
    }
  },

  appui(j, p) {
    const d = dispo(j)
    const e = j.e.e

    const onglet = [0, 1, 2].findIndex((k) => dans(p, zoneOnglet(d, k)))
    if (onglet >= 0) {
      j.e.palier = onglet
      return j.son.clic()
    }

    const liste = BATIMENTS.map((_, i) => i).filter((i) => BATIMENTS[i].palier === j.e.palier)
    const rang = liste.findIndex((_, k) => dans(p, zoneBatiment(d, k)))
    if (rang < 0) return
    const i = liste[rang]
    if (!L.ouvert(e, i)) return j.son.rate()
    if (!L.construit(e, i)) return j.son.rate()

    j.son.clic()
    j.fx.bulle(j.W / 2, 160, `+1 ${BATIMENTS[i].nom}`, BATIMENTS[i].couleur, 13)
    j.sauve(L.sauvegarde(e))
  },
}
