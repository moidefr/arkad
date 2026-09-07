/**
 * Le seul endroit d'ARKAD qui pose du HTML sur la toile.
 *
 * Tout le reste de la borne est peint dans un canvas, et c'est très bien tant
 * qu'il s'agit de boutons. Taper un mot de passe, non : un clavier dessiné à
 * la main serait laid, lent, sans gestionnaire de mots de passe, sans
 * correction, sans accents, et catastrophique au lecteur d'écran. Alors pour
 * l'inscription et la connexion — et pour elles seules — on ouvre un vrai
 * formulaire, en vrais `<input>`, posé par-dessus la toile et habillé aux
 * couleurs du terminal.
 *
 * Il se referme en emportant tout : plus un nœud dans la page, plus un
 * écouteur. La borne reprend exactement là où elle en était.
 */
import { C } from '../palette.js'
import { inscris, connexion, session, connecte, oublie, changeSnap } from './compte.js'

const CSS = `
.arkad-voile {
  position: fixed; inset: 0; z-index: 20;
  display: grid; place-items: center;
  background: rgba(11, 14, 13, 0.94);
  font-family: ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, monospace;
  overscroll-behavior: contain;
  overflow: auto;
  padding: 16px;
}
.arkad-boite {
  width: min(360px, 100%);
  border: 2px solid ${C.bord};
  background: ${C.panneau};
  padding: 18px;
  box-shadow: 0 6px 0 rgba(0, 0, 0, 0.45);
}
.arkad-boite h2 {
  color: ${C.accent}; font-size: 22px; letter-spacing: 2px; margin-bottom: 4px;
}
.arkad-boite p.aide { color: ${C.faible}; font-size: 11px; line-height: 1.5; margin-bottom: 14px; }
.arkad-boite label { display: block; color: ${C.texte}; font-size: 11px; letter-spacing: 1px; margin: 12px 0 5px; }
.arkad-boite input {
  width: 100%; padding: 10px; font: inherit; font-size: 15px;
  color: ${C.texte}; background: ${C.fond};
  border: 2px solid ${C.bord}; border-radius: 0; outline: none;
  -webkit-user-select: text; user-select: text;
}
.arkad-boite input:focus { border-color: ${C.accent}; }
.arkad-boite .note { color: ${C.faible}; font-size: 10px; margin-top: 5px; line-height: 1.5; }
.arkad-boite .erreur { color: ${C.rouge}; font-size: 12px; margin-top: 12px; min-height: 16px; line-height: 1.4; }
.arkad-boite .boutons { display: flex; gap: 8px; margin-top: 16px; }
.arkad-boite button {
  flex: 1; padding: 12px 8px; font: inherit; font-size: 14px; font-weight: 700; letter-spacing: 1px;
  cursor: pointer; border: 2px solid ${C.faible}; border-radius: 0;
  color: ${C.texte}; background: ${C.panneau};
}
.arkad-boite button.vif { border-color: ${C.accent}; color: ${C.accent}; }
.arkad-boite button:disabled { opacity: 0.5; cursor: progress; }
.arkad-boite .bascule {
  display: block; width: 100%; margin-top: 14px; padding: 0; border: 0; background: none;
  color: ${C.faible}; font-size: 11px; text-decoration: underline; cursor: pointer;
}
`

let feuille = null
function habille() {
  if (feuille || typeof document === 'undefined') return
  feuille = document.createElement('style')
  feuille.textContent = CSS
  document.head.append(feuille)
}

const champ = (id, libelle, type, note) => `
  <label for="${id}">${libelle}</label>
  <input id="${id}" type="${type}" autocomplete="${type === 'password' ? 'current-password' : 'off'}"
         autocapitalize="off" autocorrect="off" spellcheck="false">
  ${note ? `<p class="note">${note}</p>` : ''}`

/**
 * Ouvre le formulaire. Rend une promesse résolue à la fermeture — `true` si
 * quelque chose a changé (connexion, inscription, déconnexion), `false` si le
 * joueur a simplement refermé.
 *
 * `mode` vaut `'connexion'`, `'inscription'` ou `'compte'` (l'écran de celui
 * qui est déjà connecté).
 */
export function ouvre(mode = 'connexion') {
  habille()
  return new Promise((resolu) => {
    const voile = document.createElement('div')
    voile.className = 'arkad-voile'
    const boite = document.createElement('div')
    boite.className = 'arkad-boite'
    voile.append(boite)

    let courant = connecte() ? 'compte' : mode === 'compte' ? 'connexion' : mode
    let change = false

    const ferme = () => {
      voile.remove()
      removeEventListener('keydown', echappe)
      resolu(change)
    }
    const echappe = (e) => {
      if (e.key === 'Escape') ferme()
    }
    addEventListener('keydown', echappe)
    // Un clic à côté referme, comme partout ; un clic dedans ne doit pas.
    voile.addEventListener('pointerdown', (e) => {
      if (e.target === voile) ferme()
    })

    function peins() {
      if (courant === 'compte') return peinsCompte()
      const inscription = courant === 'inscription'
      boite.innerHTML = `
        <h2>${inscription ? 'CRÉER UN COMPTE' : 'SE CONNECTER'}</h2>
        <p class="aide">${
          inscription
            ? 'Ton pseudo apparaîtra aux classements. Pas d’adresse électronique demandée — et donc pas de mot de passe récupérable : note-le quelque part.'
            : 'Le compte suit tes scores d’un appareil à l’autre.'
        }</p>
        ${champ('arkad-pseudo', 'PSEUDO', 'text', inscription ? '3 à 16 caractères : lettres, chiffres, - et _' : '')}
        ${champ('arkad-mdp', 'MOT DE PASSE', 'password', inscription ? '6 caractères minimum' : '')}
        ${
          inscription
            ? champ(
                'arkad-snap',
                'SNAP (FACULTATIF)',
                'text',
                'Vraiment facultatif : il n’est affiché à aucun classement. Cette option a été espérée par Greg Boulard.',
              )
            : ''
        }
        <p class="erreur" id="arkad-erreur"></p>
        <div class="boutons">
          <button type="button" id="arkad-annule">RETOUR</button>
          <button type="button" class="vif" id="arkad-valide">${inscription ? 'CRÉER' : 'ENTRER'}</button>
        </div>
        <button type="button" class="bascule" id="arkad-bascule">${
          inscription ? 'j’ai déjà un compte' : 'créer un compte'
        }</button>`

      const erreur = boite.querySelector('#arkad-erreur')
      const valide = boite.querySelector('#arkad-valide')
      const pseudo = boite.querySelector('#arkad-pseudo')
      if (inscription) boite.querySelector('#arkad-mdp').autocomplete = 'new-password'

      const envoie = async () => {
        erreur.textContent = ''
        valide.disabled = true
        const donnees = {
          pseudo: pseudo.value,
          motDePasse: boite.querySelector('#arkad-mdp').value,
          snap: boite.querySelector('#arkad-snap')?.value,
        }
        const r = inscription ? await inscris(donnees) : await connexion(donnees)
        valide.disabled = false
        if (r.erreur) {
          erreur.textContent = r.erreur
          return
        }
        change = true
        courant = 'compte'
        peins()
      }

      valide.addEventListener('click', envoie)
      boite.querySelector('#arkad-annule').addEventListener('click', ferme)
      boite.querySelector('#arkad-bascule').addEventListener('click', () => {
        courant = inscription ? 'connexion' : 'inscription'
        peins()
      })
      // Entrée valide, depuis n'importe quel champ : c'est ce que fait tout
      // formulaire, et l'absence de <form> ne doit pas se sentir.
      boite.querySelectorAll('input').forEach((i) =>
        i.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') envoie()
        }),
      )
      pseudo.focus()
    }

    function peinsCompte() {
      boite.innerHTML = `
        <h2>${session.pseudo}</h2>
        <p class="aide">Tes scores partent au classement à la fin de chaque partie.</p>
        ${champ('arkad-snap', 'SNAP (FACULTATIF)', 'text', 'Modifiable quand tu veux, et jamais affiché aux classements. Option espérée par Greg Boulard.')}
        <p class="erreur" id="arkad-erreur"></p>
        <div class="boutons">
          <button type="button" id="arkad-sors">SE DÉCONNECTER</button>
          <button type="button" class="vif" id="arkad-ferme">FERMER</button>
        </div>`
      const snap = boite.querySelector('#arkad-snap')
      snap.value = session.snap ?? ''
      const erreur = boite.querySelector('#arkad-erreur')

      boite.querySelector('#arkad-sors').addEventListener('click', () => {
        oublie()
        change = true
        courant = 'connexion'
        peins()
      })
      boite.querySelector('#arkad-ferme').addEventListener('click', async () => {
        // Enregistrer le Snap en fermant évite un bouton de plus pour un
        // champ que personne n'ouvrira deux fois.
        if ((snap.value ?? '') !== (session.snap ?? '')) {
          const r = await changeSnap(snap.value)
          if (r.erreur) {
            erreur.textContent = r.erreur
            return
          }
          change = true
        }
        ferme()
      })
    }

    peins()
    document.body.append(voile)
  })
}
