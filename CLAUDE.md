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
    ZebraPrinterService.ts  ⭐ Singleton Bluetooth Zebra (NOUVEAU)
  hooks/
    useZebraPrinter.ts   ⭐ Hook React état imprimante (NOUVEAU)
  utils/
    zplBuilder.ts        ⭐ Générateur ZPL étiquettes soldées (NOUVEAU)
    date.ts              Formatage dates FR
  components/            Calendar, CameraCapture, SyncStatus…
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
- [x] **Imprimante Zebra ZQ620 Bluetooth** ← en cours

---

## Imprimante Zebra — état actuel

### Matériel
- Modèle : **Zebra ZQ620**
- Connexion : **Bluetooth Classic (SPP)**
- Étiquettes : **60×40mm** (480×320 dots à 203 DPI)

### Template ZPL
Label "A CONSOMMER RAPIDEMENT" avec badge de remise, nom produit et code-barres.
Généré par `src/utils/zplBuilder.ts` → `buildSoldeLabel(name, barcode, discountPercent, quantity)`.

### Librairie
`react-native-bluetooth-classic@^1.60.0-rc0` — **requiert une build native** (pas compatible Expo Go).

### ⚠️ Prérequis pour que ça fonctionne
```bash
npm install
npx expo prebuild          # génère les dossiers android/ et ios/
npx expo run:android       # ou EAS Build
```

### Flux UX (check/[id].tsx)
1. Icône imprimante (rouge/verte) à droite du bouton flash dans le header
2. **Clic icône** → modal config : Connect/Déconnecter + réglage remise (10-80%, pas de 5)
3. **Valider la DLC** (si imprimante connectée) → modal impression : stepper quantité + [Imprimer] + [Fermer]
   - [Imprimer] → envoie ZPL → enregistre le check → produit suivant
   - [Fermer] → enregistre le check sans imprimer → produit suivant

### Fichiers concernés
- `src/services/ZebraPrinterService.ts` — connexion BT + état persisté (AsyncStorage)
- `src/hooks/useZebraPrinter.ts` — hook React abonné au service
- `src/utils/zplBuilder.ts` — générateur ZPL
- `app/check/[id].tsx` — intégration UI (badge + 2 modals)

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

# App avec BT (build native requise)
npx expo prebuild
npx expo run:android
```

---

## Comment mettre à jour ce fichier

À la fin de chaque session, mettre à jour :
- La section "Fonctionnalités implémentées" (cocher/ajouter)
- La section concernée par les changements en cours
- La date de dernière mise à jour ci-dessous

**Dernière mise à jour** : 2026-05-22
