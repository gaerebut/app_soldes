# Context — DLC Manager / App Soldes

Ce fichier est lu automatiquement par Claude Code au démarrage de chaque session.
Il est mis à jour manuellement ou à la fin de chaque session significative.

---

## Projet

Application mobile React Native (Expo 54) pour les employés Carrefour franchise.
Permet de gérer les dates limites de consommation (DLC), scanner les produits, flasher les étiquettes électroniques Pricer, et imprimer des étiquettes soldées sur une Zebra ZQ620.

**Repo** : `gaerebut/app_soldes`
**Branche de dev active** : `claude/busy-maxwell-bLKe1`

---

## Stack technique

| Composant | Technologie |
|---|---|
| App mobile | Expo 54 + Expo Router v6, React Native 0.81.5 |
| Architecture | New Architecture activée (`newArchEnabled: true`) |
| Base de données | expo-sqlite (SQLite local) |
| Backend | Node.js / Express (`server/`) |
| Auth | JWT (AsyncStorage) |
| Temps réel | Socket.IO |
| Notifications | expo-notifications (local uniquement) |

---

## Structure clé

```
app/                     Routes Expo Router
  _layout.tsx            Layout racine + auth guard
  index.tsx              Écran d'accueil (liste des contrôles du jour)
  check/[id].tsx         ⭐ Écran de contrôle DLC (principal flux)
  product/[id].tsx       Édition produit
  product/add.tsx        Ajout produit (scan EAN)
  products.tsx           Liste produits
  settings.tsx           Paramètres (sync, compte)
  backoffice/            Interface admin (users, stats)

src/
  api/client.ts          Client HTTP centralisé (apiClient)
  database/              products.ts, aisles.ts, db.ts (migrations SQLite)
  services/
    ZebraPrinterService.ts  ⭐ Singleton BLE Zebra (react-native-ble-manager)
  hooks/
    useZebraPrinter.ts   ⭐ Hook React état imprimante
  utils/
    zplBuilder.ts        ⭐ Générateur ZPL étiquettes soldées
    date.ts              Formatage dates FR
  components/
    PrinterConfigModal.tsx  ⭐ Modal config imprimante (partagé index + check)
    Calendar, CameraCapture, SyncStatus…
  sync/                  Sync multi-appareils (SyncManager, etc.)
  constants/theme.ts     Colors, Categories

server/
  index.js               Serveur Express principal
  sync.js                Routes sync multi-appareils
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

### Flux UX
1. Icône imprimante (rouge/verte) dans le header — écrans accueil ET check
2. **Clic icône** → `PrinterConfigModal` :
   - Deux boutons : [📷 Scanner le code-barres] (connexion directe par MAC) + [🔵 Rechercher] (scan BLE actif)
   - Quand connectée : bouton Déconnecter
   - Stepper remise 10–80% (pas de 5)
3. **Valider la DLC** (si connectée) → modal impression : stepper quantité + [Imprimer] + [Fermer]

### Fichiers concernés
- `src/services/ZebraPrinterService.ts` — BLE init/scan/connect/print (react-native-ble-manager)
- `src/hooks/useZebraPrinter.ts` — hook React abonné au service
- `src/utils/zplBuilder.ts` — générateur ZPL
- `src/components/PrinterConfigModal.tsx` — modal partagé (scanner + BLE scan + remise)
- `app/check/[id].tsx` — intégration UI header + modal impression
- `app/index.tsx` — icône imprimante dans header

### Build EAS
- Android APK : `eas build --platform android --profile preview`
- iOS IPA : `eas build --platform ios --profile preview`
- `.easignore` exclut `android/` et `ios/` → EAS fait le prebuild propre
- `react-native.config.js` vide (plus d'exclusions nécessaires)

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

## Lancer le projet

```bash
# Backend
cd server && npm install && npm start

# App (Expo Go — sans BT)
npm start

# Build natif EAS
eas build --platform android --profile preview
eas build --platform ios --profile preview
```

---

## Comment mettre à jour ce fichier

À la fin de chaque session, mettre à jour :
- La section "Fonctionnalités implémentées" (cocher/ajouter)
- La section concernée par les changements en cours
- La date de dernière mise à jour ci-dessous

**Dernière mise à jour** : 2026-05-26
