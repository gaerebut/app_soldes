# Context — DLC Manager / App Soldes

Ce fichier est lu automatiquement par Claude Code au démarrage de chaque session.
Il est mis à jour manuellement ou à la fin de chaque session significative.

---

## Projet

Application mobile React Native (Expo 56) pour les employés Carrefour franchise.
Permet de gérer les dates limites de consommation (DLC), scanner les produits, flasher les étiquettes électroniques Pricer, et imprimer des étiquettes soldées sur une Zebra ZQ620.

**Repo** : `gaerebut/app_soldes`
**Branche de dev active** : `claude/busy-maxwell-bLKe1`
**PR ouverte** : #6 (draft)

---

## Stack technique

| Composant | Technologie |
|---|---|
| App mobile | Expo 56 + Expo Router v56, React Native 0.85.3 |
| Architecture | New Architecture activée (`newArchEnabled: true`) |
| Backend | Node.js / Express (`server/`) — toutes les données passent par l'API |
| Auth | JWT (AsyncStorage) |
| Temps réel | Socket.IO |
| Notifications | expo-notifications (local uniquement) |
| BLE imprimante | react-native-ble-manager@^12.3.2 |

> ⚠️ La base de données est **server-side uniquement** via `apiClient`. `src/database/` contient
> des wrappers qui appellent l'API, PAS du SQLite local. Pas de `db.ts` / migrations locales.

---

## Structure clé

```
app/                     Routes Expo Router
  _layout.tsx            Layout racine + auth guard + navigation-bar Android
  index.tsx              Écran d'accueil (liste des contrôles du jour)
  check/[id].tsx         ⭐ Écran de contrôle DLC (principal flux)
  product/[id].tsx       Édition produit
  product/add.tsx        Ajout produit (scan EAN)
  products.tsx           Liste produits
  settings.tsx           Paramètres (sync, compte)
  device.tsx             Nommage de l'appareil (setup 1 fois)
  setup-aisles.tsx       Création du premier rayon (setup 1 fois)
  login.tsx              Connexion (credentials par défaut : Honfleur / Honfleur0711!)

src/
  api/client.ts          Client HTTP centralisé (apiClient, serverUrl, JWT)
  database/
    products.ts          Wrappers API produits (pas de SQLite)
    aisles.ts            Wrappers API rayons (pas de SQLite)
  services/
    ZebraPrinterService.ts  ⭐ Singleton BLE Zebra (react-native-ble-manager)
  hooks/
    useZebraPrinter.ts   ⭐ Hook React état imprimante
  utils/
    zplBuilder.ts        ⭐ Générateur ZPL étiquettes soldées
    date.ts              Formatage dates FR
    device.ts            getOrCreateDeviceId / setDeviceName
  components/
    PrinterConfigModal.tsx  ⭐ Modal config imprimante (partagé index + check)
    NetworkGuard.tsx     Vérifie la connexion serveur toutes les 3s, bloque si hors ligne
  realtime/
    SocketManager.ts     Socket.IO (connect/disconnect/events)
    NetworkGuard.tsx     (voir ci-dessus)
  constants/theme.ts     Colors, Categories

server/
  index.js               Serveur Express principal
  sync.js                Routes sync multi-appareils
```

---

## Flux d'auth / navigation

```
launch
  └─ NetworkGuard (ping serveur toutes les 3s, bloque si offline)
      └─ _layout.tsx guard
          ├─ pas de token → /login
          ├─ pas de dlc_device_name → /device
          ├─ getAllAisles() == 0 → /setup-aisles
          └─ sinon → / (index)
```

---

## Fonctionnalités implémentées

- [x] Scan EAN + lookup Open Food Facts
- [x] Gestion DLC (calendrier, validation, rupture)
- [x] Étiquettes électroniques Pricer (flash)
- [x] Multi-utilisateurs avec rôles (admin/user)
- [x] Isolation données par utilisateur
- [x] Sync multi-appareils (LWW, offline-first)
- [x] Notifications locales
- [x] Back-office web (users, stats)
- [x] Config WhatsApp (numéros)
- [x] **Imprimante Zebra ZQ620 Bluetooth BLE** ✅
- [x] Barre de navigation Android cachée (`expo-navigation-bar`)

---

## Imprimante Zebra — état actuel

### Matériel
- Modèle : **Zebra ZQ620**
- Connexion : **Bluetooth Low Energy (BLE / GATT)**
- Étiquettes : **60×40mm** (480×320 dots à 203 DPI)

### Librairie
`react-native-ble-manager@^12.3.2` — fonctionne Android + iOS, pas de dépendance externe.

> ⚠️ `react-native-ble-plx` v3.x était cassé : dépendait de `MultiplatformBleAdapter@0.2.0`
> qui n'existe pas sur CocoaPods. Ne pas revenir à cette lib.

### Template ZPL
Label "A CONSOMMER RAPIDEMENT" avec badge de remise, nom produit et code-barres.
Généré par `src/utils/zplBuilder.ts` → `buildSoldeLabel(name, barcode, discountPercent, quantity)`.

### GATT UUIDs Zebra (ZQ620 / Link-OS)
- Service  : `38EB4A80-C570-11E3-9507-0002A5D5C51B`
- Write char: `38EB4A82-C570-11E3-9507-0002A5D5C51B`

### Flux UX PrinterConfigModal
1. Icône imprimante (rouge/verte) dans le header — écrans accueil ET check
2. **Clic icône** → `PrinterConfigModal` :
   - **[📷 Scanner le code-barres]** — connexion directe via MAC scanné
   - **[🔵 Rechercher via Bluetooth]** — scan BLE actif, liste les appareils trouvés
   - Quand connectée : bouton Déconnecter
   - Stepper remise 10–80% (pas de 5)
3. **Valider la DLC** (si connectée) → modal impression : stepper quantité + [Imprimer] + [Fermer]

### Fichiers concernés
- `src/services/ZebraPrinterService.ts` — BLE init/scan/connect/print
- `src/hooks/useZebraPrinter.ts` — hook React (startScan, stopScan, connect, disconnect, print, foundDevices, isScanning…)
- `src/utils/zplBuilder.ts` — générateur ZPL
- `src/components/PrinterConfigModal.tsx` — modal partagé (caméra + BLE scan + remise)
- `app/check/[id].tsx` — intégration header + modal impression
- `app/index.tsx` — icône imprimante dans header

---

## Pièges connus / fixes appliqués

### expo-navigation-bar (Android uniquement)
`expo-navigation-bar` est Android-only. **Ne pas faire d'import statique** — ça crashe iOS
même avec un guard `Platform.OS === 'android'`.
```ts
// ✅ Correct (dans _layout.tsx)
useEffect(() => {
  if (Platform.OS === 'android') {
    require('expo-navigation-bar').setVisibilityAsync('hidden');
  }
}, []);
```

### sharp
`sharp` était une dépendance parasite dans `package.json`. Supprimée car elle essayait de
compiler depuis les sources sur le runner macOS EAS → build iOS échouait.
Ne pas réintroduire.

### react-native-ble-plx
Ne pas utiliser — v3.x cassé sur CocoaPods (voir section Zebra).

### Credentials par défaut (login.tsx)
- Username : `Honfleur`
- Password : `Honfleur0711!`

---

## iOS — crash en cours d'investigation

**Symptômes** : crash après l'écran de nommage de l'appareil (premier lancement),
puis crash immédiat sans splash screen sur les lancements suivants.

**Ce qui a été testé / écarté** :
- Import statique `expo-navigation-bar` → corrigé (dynamic require)
- `sharp` → supprimé
- `NativeModules.BleManager` non disponible → protégé par guard + try/catch dans `ZebraPrinterService.init()`
- `setup-aisles.tsx` → code normal, pas de crash évident

**Hypothèses restantes** :
- Race condition navigation garde + `router.replace()` depuis `device.tsx`
- Crash dans `BleManager.start()` sur iOS malgré le try/catch
- Unhandled promise rejection dans `zebraPrinterService.init()`

**Diagnostic** : pour obtenir les logs de crash iOS → connecter Xcode → Device → Crash Logs.

---

## Build workflow

### EAS Cloud (recommandé, crédits reset le 1er de chaque mois)
```bash
git pull
npm install
eas build --platform android --profile preview
eas build --platform ios --profile preview
```

### Build Android local (si crédits épuisés)
Prérequis : Android Studio + JDK 21 (`C:\Program Files\Android\openjdk\jdk-21.0.8`),
SDK à `C:\Users\gaeta\AppData\Local\Android\Sdk`.

```powershell
# Dans android/local.properties (ne pas committer)
sdk.dir=C\:\\Users\\gaeta\\AppData\\Local\\Android\\Sdk

# Rebuild
cd android
.\gradlew.bat --stop
.\gradlew.bat assembleDebug --rerun-tasks

# Installer via USB
adb install app\build\outputs\apk\debug\app-debug.apk
```

### Metro hot reload (après build local installé)
```powershell
# Terminal 1 — racine du projet
npx expo start

# Terminal 2 — téléphone branché USB
adb reverse tcp:8081 tcp:8081
```
L'app se reconnecte à Metro et charge le JS à jour sans recompiler.
Appuyer sur `r` dans le terminal Metro pour forcer le rechargement.

### Notes build Android
- `BUNDLE_IN_DEBUG=true` dans `android/gradle.properties` → intègre le JS dans l'APK debug
  (permet de lancer l'APK sans Metro si nécessaire)
- `--rerun-tasks` au lieu de `clean` pour éviter l'erreur CMake cache
- Si erreur "Le processus ne peut pas accéder au fichier" → `.\gradlew.bat --stop` puis réessayer

---

## Variables d'environnement serveur (server/.env)

```
JWT_SECRET=...
SEED_LOGIN=admin
SEED_PASSWORD=...
PORT=3000
```

Voir `server/.env.example` pour la liste complète.

---

## Comment mettre à jour ce fichier

À la fin de chaque session, mettre à jour :
- La section "Fonctionnalités implémentées" (cocher/ajouter)
- La section "Pièges connus / fixes appliqués" (nouveaux bugs rencontrés)
- La section iOS crash si avancement
- La date de dernière mise à jour ci-dessous

**Dernière mise à jour** : 2026-07-07
