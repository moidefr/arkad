/**
 * La façade des bandes-son.
 *
 * Elle ne fait que trois choses : choisir un morceau, le lancer, l'arrêter —
 * et se taire quand le joueur l'a demandé. Le reste vit dans `musique/` :
 * `table.js` pour les fiches, `composition.js` pour la partition,
 * `joueur.js` pour la sortie audio.
 */
import { son } from './son.js'
import { Joueur } from './musique/joueur.js'
import { PAR_ID, pourJeu, pourPalier, TOUTES } from './musique/table.js'

class Musique {
  constructor() {
    this.joueur = new Joueur()
    this.voulue = null
  }

  /** Le contexte audio n'existe qu'après le premier geste : on se branche tard. */
  _prete() {
    if (!son.ctx) return false
    this.joueur.branche(son.ctx, son.maitre)
    return true
  }

  /**
   * Demande une bande. On mémorise toujours ce qui est voulu, même quand la
   * musique est coupée : rallumer le son en pleine partie doit reprendre le
   * bon morceau, pas le silence.
   */
  joue(quoi) {
    const fiche = typeof quoi === 'string' ? PAR_ID[quoi] : quoi
    if (!fiche) return
    this.voulue = fiche
    if (!son.musique || !this._prete()) return
    this.joueur.joue(fiche)
  }

  arrete(fondu) {
    this.voulue = null
    this.joueur.arrete(fondu)
  }

  /** Rejoue ou coupe selon le mode courant. Appelée quand le joueur bascule le son. */
  accorde() {
    if (!this._prete()) return
    if (son.musique && this.voulue) this.joueur.joue(this.voulue)
    else if (!son.musique) this.joueur.arrete(0.25)
  }
}

export const musique = new Musique()
export { pourJeu, pourPalier, TOUTES }
