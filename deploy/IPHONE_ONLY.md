# Tout faire depuis l'iPhone (sans ordinateur)

Tu n'as qu'un iPhone et tu veux tester ou déployer l'app DLC Manager.
Deux voies — **A** sans frais ni Apple Developer, **B** pour une vraie app
installée à demeure.

---

## Voie A — Expo Go via dev server hébergé sur ton VPS

C'est le chemin le plus court. Aucun build, aucun compte payant.
Modifications visibles instantanément après chaque push git.

### Pré-requis
- App **Expo Go** installée sur l'iPhone (App Store, gratuit)
- App **Termius** (ou tout client SSH iOS) avec accès root au VPS
- App **Working Copy** ou **GitHub mobile** pour éditer le code (facultatif)

### Étapes

1. **Sur le VPS via Termius**, lance le dev server :
   ```bash
   cd /root/app_soldes
   npm install     # une seule fois
   npx expo start --tunnel
   ```
   `--tunnel` route le trafic à travers l'infra Expo → marche depuis n'importe
   quel réseau (4G, wifi, etc.).

2. Termius affiche un QR code et une URL du genre
   `exp://xx-yyy.anonymous.dlc-manager.exp.direct`. Touche-la longuement,
   copie.

3. **Sur l'iPhone**, ouvre **Expo Go** → bouton "Enter URL manually" → colle
   l'URL → "Connect". L'app se charge.

4. Modifie le code (Editor mobile GitHub ou Working Copy) → push → l'app
   reload toute seule sur l'iPhone (`Fast Refresh`).

### Limites
- Marche uniquement avec les modules Expo de base (déjà le cas pour cette
  app : caméra, sqlite, notifications locales)
- Tant que `npx expo start` tourne sur le VPS — quitte Termius proprement
  avec `Ctrl+C` (ou laisse-le tourner via `tmux`/`screen`)
- N'est **pas** une app installée : il te faut Expo Go pour l'ouvrir

---

## Voie B — Build TestFlight via GitHub Actions

L'app devient une vraie app installable, distribuable via TestFlight ou
l'App Store. **Apple Developer Program requis : 99 $/an.**

### Comptes à créer (depuis Safari iPhone)

1. **Compte Expo** : https://expo.dev/signup
2. **Compte Apple Developer** : https://developer.apple.com/programs/enroll/
   (paiement requis)
3. **Mot de passe spécifique d'app Apple** :
   https://account.apple.com/ → Sign-In and Security → App-Specific
   Passwords → Generate. Note-le.
4. **Token Expo** : https://expo.dev/accounts/[ton-compte]/settings/access-tokens
   → Create token. Copie-le.

### Initialiser le projet Expo (depuis l'iPhone)

`eas init` doit normalement tourner depuis un terminal — sur iPhone, contourne
en créant le projet à la main :

1. https://expo.dev/accounts/[ton-compte]/projects → **Create a project** →
   nom : `dlc-manager` → tu obtiens un **project ID** (UUID).
2. Édite `app.json` via GitHub mobile (icône crayon sur le fichier), ajoute à
   l'intérieur du bloc `"expo": { ... }` :
   ```json
   "extra": {
     "eas": {
       "projectId": "TON-UUID-ICI"
     }
   }
   ```
3. Commit la modif depuis GitHub mobile.

### Configurer les secrets GitHub (depuis Safari iPhone)

Repo GitHub → **Settings** → **Secrets and variables** → **Actions** →
**New repository secret** pour chacun :

| Nom du secret | Valeur |
|---|---|
| `EXPO_TOKEN` | le token Expo de l'étape 4 |
| `EXPO_APPLE_ID` | ton identifiant Apple Developer (email) |
| `EXPO_APPLE_APP_SPECIFIC_PASSWORD` | celui de l'étape 3 |
| `EXPO_APPLE_TEAM_ID` | trouve-le sur https://developer.apple.com/account → Membership |

### Lancer un build (depuis GitHub mobile ou Safari)

Repo → onglet **Actions** → workflow **EAS iOS Build** → bouton **Run
workflow** (en haut à droite, peut nécessiter de scroller) :

- `profile` : `preview` (TestFlight interne) ou `production` (App Store)
- `submit` : `true` pour pousser direct sur TestFlight après le build

Clique **Run workflow**. Le build dure ~20-40 min sur la file gratuite.
Tu reçois un mail Expo quand c'est fini.

### Installer sur l'iPhone

- Si `submit: true` → mail Apple "Build is ready to test" → installe
  **TestFlight** sur l'iPhone → accepte l'invitation → installe DLC Manager
- Sinon → ouvre l'URL du build (mail Expo) sur Safari iPhone → tap install
  (nécessite que ton iPhone soit enregistré dans le profil Ad-Hoc Apple)

### Mettre à jour ensuite

Push un commit sur la branche → Actions → relance le workflow. Pas de
nouvelles étapes manuelles.

---

## Bonus — déclencher le workflow auto à chaque push

Édite `.github/workflows/eas-build-ios.yml` et ajoute un trigger `push` :

```yaml
on:
  push:
    branches: [main]
  workflow_dispatch:
    ...
```

À éviter pendant le développement actif (une build coûte ~25 min de queue
gratuite et tu en as un quota mensuel limité).
