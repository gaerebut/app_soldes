# Builder l'app iOS via EAS Build

Cible : avoir l'app **DLC Manager** installée sur ton iPhone (TestFlight ou
build interne), pointant par défaut vers le backoffice distant
`http://187.124.215.103:3000`.

Le build se fait **dans le cloud Expo** : tu n'as pas besoin de Xcode ni de
Mac. Pour la première fois il faut quand même un environnement avec Node
(ordinateur emprunté, ou GitHub Actions — voir section finale).

---

## Pré-requis (à faire une fois)

1. **Compte Expo** gratuit : https://expo.dev/signup
2. **Compte Apple Developer** : 99 $/an pour TestFlight, OU compte gratuit
   pour le sideloading 7 jours (build de simulateur ou Ad-Hoc).
3. **Node 20+** installé sur la machine qui lance la commande `eas build`.

---

## Première installation (sur l'ordinateur)

```bash
git clone https://github.com/gaerebut/app_soldes.git
cd app_soldes
npm install                       # installe eas-cli en local
npx eas login                     # se connecte au compte Expo
npx eas init                      # crée un projet Expo et écrit l'ID dans app.json
npx eas credentials               # configure les certificats Apple (interactif)
```

`eas init` ajoute tout seul un bloc `extra.eas.projectId` dans `app.json` —
commit-le.

---

## Lancer un build "preview" (TestFlight interne)

```bash
npm run build:preview
```

- Profil `preview` (cf. `eas.json`)
- Distribution interne (TestFlight Internal Testing)
- iOS uniquement
- Variable `EXPO_PUBLIC_DEFAULT_SERVER_URL` injectée → l'app pointe sur
  `http://187.124.215.103:3000` par défaut
- Durée : ~15-25 min sur la file gratuite Expo, ~5-10 min sur le tier payant

À la fin du build, EAS te donne :
- Un lien direct (`*.ipa`) pour download manuel
- Une commande `eas submit --platform ios --latest` pour pousser
  automatiquement sur TestFlight

```bash
npm run submit:ios   # raccourci pour eas submit --platform ios --latest
```

Apple traite le build (~5-15 min). Une fois validé, tu reçois un mail. Sur
ton iPhone, ouvre **TestFlight**, accepte l'invitation → l'app est
installable.

---

## Builder pour un Android (APK installable directement)

```bash
npm run build:android
```

Te donne une URL `*.apk`. Sur l'Android cible, ouvre l'URL → installe
(Settings → Sécurité → "Sources inconnues" peut être nécessaire).

---

## Builder sans aucun ordinateur (GitHub Actions)

Une fois le projet Expo initialisé (`eas init` fait UNE fois), tu peux
déclencher des builds depuis l'iPhone via GitHub Actions :

1. Sur https://expo.dev → Account Settings → **Access Tokens** → crée un
   token, copie-le.
2. Sur GitHub → Settings du repo → Secrets → **`EXPO_TOKEN`** = ce token.
3. Crée `.github/workflows/eas-build.yml` (à demander si tu veux) avec un
   trigger `workflow_dispatch` et la commande `eas build --platform ios
   --profile preview --non-interactive`.
4. Sur l'iPhone, ouvre GitHub web → Actions → ton workflow → **Run workflow**.

---

## Mettre à jour le code sans re-builder (Over-The-Air)

Pour les modifs JS/CSS/assets — pas pour les natifs (plugins, permissions) :

1. `npx expo install expo-updates` (une fois)
2. Décommente / ajoute `"channel": "preview"` dans le profil correspondant
   de `eas.json`
3. `npx eas update --branch preview --message "..."` après chaque
   modification → push OTA, l'app récupère au prochain démarrage

Les builds natifs ne sont nécessaires que pour les changements de
permissions ou de plugin Expo.

---

## ⚠️ Notes de sécurité

- `app.json` active `NSAllowsArbitraryLoads` (iOS) et `usesCleartextTraffic`
  (Android) parce que le backoffice est en HTTP clair (pas de TLS). Apple
  refuse normalement les connexions HTTP — sans ce flag, l'app ne peut
  même pas joindre le serveur.
- À supprimer **dès que tu auras mis HTTPS** (Let's Encrypt + un domaine,
  ou la voie 1b de `DEPLOY.md` derrière OpenLiteSpeed).
- En attendant : ne pas distribuer publiquement cette build, les
  identifiants `Honfleur/Honfleur` voyagent en clair.

---

## Changer l'URL du backoffice à la volée

L'utilisateur de l'app peut overrider l'URL par défaut sans rebuild :

**Settings → Synchronisation → URL du serveur → coller la nouvelle URL →
Sauvegarder.**

Stocké en `AsyncStorage`. Reste prioritaire sur la variable
`EXPO_PUBLIC_DEFAULT_SERVER_URL`.
