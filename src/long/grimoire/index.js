/**
 * GRIMOIRE — un deck qui grossit combat après combat. Le mauvais choix reste
 * dans la pioche.
 *
 * Chaque victoire propose une carte à ajouter au deck (jamais imposée : « AUCUNE »
 * reste toujours possible). Le risque n'est pas une jauge qui vide — c'est le
 * deck lui-même : plus il grossit, plus une bonne carte se noie parmi les
 * autres au moment de la piocher. La défaite referme la partie en cours mais
 * ne touche jamais les victoires à vie, qui débloquent le pool pour la
 * suivante — la seule chose qui survit à la mort, comme il se doit d'une
 * méta-progression.
 */
import { C } from '../../palette.js'
import * as L from './logique.js'
import * as V from './vues.js'
import { dispo, zoneCarte, dans } from './dispo.js'

export default {
  id: 'grimoire',
  nom: 'GRIMOIRE',
  pitch: 'Un deck qui grossit combat après combat. Le mauvais choix reste dans la pioche',
  couleur: C.vert,
  sansScore: true,
  persistant: true,

  titreHud: (j) => {
    const run = j.e.s.run
    return run ? `PROFONDEUR ${run.profondeur} · ${Math.floor(run.pv)}/${run.pvMax} PV` : 'GRIMOIRE'
  },
  finTitre: (j) => ({ texte: `REFERMÉ · PROFONDEUR ${j.e.dernierProfondeur ?? 0}`, couleur: C.rouge }),

  init(j) {
    const s = L.migre(j.charge()) ?? L.neuf()
    if (!s.run) L.demarrer(s, j.hasard)
    j.e = { s, dernierProfondeur: 0 }
  },

  dessine(j, ctx) {
    V.dessine(ctx, dispo(j), j, j.e.s)
  },

  appui(j, p) {
    const s = j.e.s
    const run = s.run
    const d = dispo(j)

    if (run.phase === 'combat') {
      if (dans(p, d.finTour)) return apres(j, L.finirTour(s, j.hasard))
      const total = Math.max(1, run.main.length)
      const i = run.main.findIndex((_, k) => dans(p, zoneCarte(d, j, k, total)))
      if (i < 0) return
      const ev = L.jouerCarte(s, i, j.hasard)
      if (ev.rate) return j.son.rate()
      return apres(j, ev)
    }

    // phase === 'recompense' : les cartes proposées, plus une case « aucune » (id null).
    const options = [...run.recompense, null]
    const i = options.findIndex((_, k) => dans(p, zoneCarte(d, j, k, options.length)))
    if (i < 0) return
    const ev = L.choisirRecompense(s, options[i], j.hasard)
    j.son.clic()
    if (ev.ajoute) {
      const carte = L.carteDe(ev.ajoute)
      j.fx.bulle(j.W / 2, d.ennemi.y - 10, carte.nom, C.vert, 14)
    }
    j.sauve(s)
  },
}

function apres(j, ev) {
  const s = j.e.s
  const d = dispo(j)

  if (ev.carte) j.son.clic()
  if (ev.degatsInfliges) {
    j.son.touche(Math.min(9, 1 + Math.floor(ev.degatsInfliges / 4)))
    j.fx.bulle(j.W / 2, d.ennemi.y + 40, `-${ev.degatsInfliges}`, C.rouge, 16)
  }
  if (ev.soin) j.fx.bulle(j.W / 2, d.joueur.y, `+${ev.soin}`, C.vert, 13)
  if (ev.poison) j.fx.bulle(j.W / 2, d.ennemi.y + 40, `poison -${ev.poison}`, C.violet, 13)
  if (ev.subis) {
    j.son.rate()
    j.fx.secoue(6)
    j.fx.bulle(j.W / 2, d.joueur.y, `-${ev.subis}`, C.rouge, 16)
  }
  if (ev.buffEnnemi) j.fx.bulle(j.W / 2, d.ennemi.y + 20, 'RENFORCÉ', C.violet, 12)

  if (ev.victoire) {
    j.son.record()
    j.fx.eclat(j.W / 2, d.ennemi.y + 50, C.vert, { n: 22, vitesse: 200 })
  }

  if (ev.defaite) {
    j.son.rate()
    j.fx.secoue(10)
    j.e.dernierProfondeur = ev.profondeur
    // La partie s'arrête, mais les victoires à vie (`meta`) restent : on
    // sauvegarde l'état avec `run` vidé plutôt que d'effacer d'un bloc comme
    // EXPÉDITION — sans quoi le pool débloqué disparaîtrait avec la partie.
    s.run = null
    j.sauve(s)
    return j.perdu()
  }

  j.sauve(s)
}
