/**
 * EXPÉDITION — neuf cents kilomètres, quatre pays, un choix par jour.
 *
 * Refonte complète : l'ancienne version n'avait que six journées fixes par
 * étape (revues plusieurs fois sur une traversée de 8 à 15 jours), des
 * effets tous déterministes (donc un seul choix optimal, connu d'avance dès
 * qu'on l'avait lu une fois), et trois objets-clés qu'on pouvait manquer en
 * silence. `logique.js` résout maintenant des issues probabilistes dans un
 * pool bien plus large, pondéré par l'état, avec une fatigue cumulative qui
 * punit l'enchaînement de journées dures, des objets-clés garantis avant
 * qu'ils ne deviennent nécessaires, et un embranchement de route à chaque
 * frontière de pays.
 */
import { C } from '../../palette.js'
import { OBJETS } from './donnees.js'
import * as L from './logique.js'
import * as V from './vues.js'
import { dispo, zoneOption, dans } from './dispo.js'

export default {
  id: 'expedition',
  nom: 'EXPÉDITION',
  pitch: 'Neuf cents kilomètres, quatre pays, un choix par jour',
  couleur: C.violet,
  unite: 'km',
  ciel: C.accent,
  persistant: true,

  finTitre: (j) =>
    j.e.h.km >= L.arriveeDe(j.e.h) ? { texte: 'ARRIVÉ', couleur: C.accent } : { texte: 'PERDU EN ROUTE', couleur: C.rouge },

  init(j) {
    const h = L.migre(j.charge()) ?? L.neuf()
    j.e = { h, dernier: h.jour > 1 ? 'tu reprends la route' : 'premier jour de marche' }
    j.e.journee = L.tire(h, j.hasard)
    j.score = Math.floor(h.km)
  },

  dessine(j, ctx) {
    const d = dispo(j)
    V.dessine(ctx, d, j, j.e.h, j.e.journee)
  },

  appui(j, p) {
    const h = j.e.h
    const liste = L.optionsDe(j.e.journee)
    const i = liste.findIndex((_, k) => dans(p, zoneOption(dispo(j), k)))
    if (i < 0) return
    const o = liste[i]
    if (!L.ouverte(h, o)) return j.son.rate()

    const ev = L.avancer(h, o, j.hasard)
    j.score = Math.floor(h.km)
    j.e.journee = ev.arrive || ev.mort ? j.e.journee : L.tire(h, j.hasard)

    if (ev.route) {
      j.e.dernier = ev.route === 'sur' ? 'tu prends la route la plus sûre' : 'tu tentes le raccourci'
      j.son.clic()
    } else {
      j.e.dernier = ev.mal || (ev.objet ? `tu ramasses : ${OBJETS[ev.objet]}` : `${o.km} km parcourus`)
      j.son.touche(Math.min(9, 1 + Math.floor(o.km / 6)))
      if (o.km > 0) j.fx.bulle(j.W / 2, 150, `+${o.km} km`, C.accent, 16)
    }

    if (ev.etapeChangee) {
      const e = L.etapeDe(h)
      j.e.dernier = `tu entres dans ${e.nom.toLowerCase()}`
      j.son.niveau()
      j.fx.eclat(j.W / 2, 115, e.couleur, { n: 20, vitesse: 180 })
    }

    if (ev.arrive) {
      j.son.record()
      j.fx.eclat(j.W / 2, j.H / 2, C.accent, { n: 34, vitesse: 260 })
      j.efface()
      return j.perdu()
    }
    if (ev.mort) {
      j.son.rate()
      j.efface()
      return j.perdu()
    }

    // Chaque journée est écrite : on peut fermer entre deux choix.
    j.sauve(h)
  },
}
