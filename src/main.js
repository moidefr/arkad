import { Moteur } from './engine.js'
import { depuisChemin } from './route.js'
import { son } from './son.js'

const arrivee = depuisChemin(location.pathname)
// Chemin qui ne mène nulle part : on nettoie l'adresse avant de démarrer,
// plutôt que de laisser un favori mort dans la barre pendant qu'on affiche
// l'accueil.
if (!arrivee) history.replaceState(null, '', '/')

const moteur = new Moteur(document.getElementById('scene'), arrivee)
moteur.demarre()

// Pratique pendant que tu bidouilles : depuis la console du navigateur,
// `moteur.j` te donne l'état du jeu en cours, et `son` laisse essayer les
// bruitages un par un.
globalThis.moteur = moteur
globalThis.son = son

// Rend le jeu installable sur l'écran d'accueil du téléphone.
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  // Absolu : sinon une page à /court/corde/ tente d'aller chercher
  // /court/corde/sw.js, qui n'existe pas.
  addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}))
}
