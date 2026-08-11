/**
 * Tout ce qui survit à la fermeture du jeu passe par ici : records, sourdine,
 * progression de l'aventure.
 *
 * Un seul préfixe, un seul endroit où le changer — et un rattrapage pour les
 * données écrites quand le projet s'appelait encore ARCADE, pour ne pas
 * effacer les records de ceux qui ont déjà l'application.
 */
const PREFIXE = 'arkad.'
const ANCIEN = 'arcade.'

;(function migre() {
  try {
    if (localStorage.getItem(PREFIXE + 'migre')) return
    // On fige la liste des clés avant d'écrire : sinon l'index glisse pendant
    // qu'on ajoute.
    for (const cle of Object.keys(localStorage)) {
      if (!cle.startsWith(ANCIEN)) continue
      const neuve = PREFIXE + cle.slice(ANCIEN.length)
      if (localStorage.getItem(neuve) === null) localStorage.setItem(neuve, localStorage.getItem(cle))
    }
    localStorage.setItem(PREFIXE + 'migre', '1')
  } catch {
    // Navigation privée, quota plein : le jeu marche, il n'oublie juste rien.
  }
})()

export function lis(cle, defaut = null) {
  try {
    const v = localStorage.getItem(PREFIXE + cle)
    return v === null ? defaut : v
  } catch {
    return defaut
  }
}

export function ecris(cle, valeur) {
  try {
    localStorage.setItem(PREFIXE + cle, String(valeur))
  } catch {
    /* rien à faire : perdre un record ne doit pas casser une partie */
  }
}
