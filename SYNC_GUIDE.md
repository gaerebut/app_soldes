# Guide de Synchronisation Multi-Appareils

## 📱 Vue d'ensemble

L'application DLC Manager supporte maintenant la synchronisation multi-appareils. Vous pouvez utiliser l'app sur votre téléphone, tablette ou tout autre appareil et tous les changements seront synchronisés en temps réel via un serveur central.

## 🚀 Démarrage rapide

### 1. Démarrer le serveur backend

```bash
cd server
npm install
npm start
```

Le serveur démarre sur `http://localhost:3000`

### 2. Configurer l'app cliente

L'app se connecte automatiquement à `http://localhost:3000` par défaut. Pour changer le serveur :
- Allez dans Settings → Synchronisation → Voir synchronisation
- Vous pouvez configurer une autre URL

### 3. Lancer l'app

```bash
npm start
# Ou en développement avec reload automatique
npm run dev
```

## 🔄 Flux de Synchronisation

### Automatique (toutes les 5 minutes)
- L'app synchronise automatiquement en arrière-plan
- Quand l'app revient au premier plan
- Quand une connexion Internet se rétablit

### Manuel
- Appuyez sur "Synchroniser maintenant" dans Settings

### Offline-First
- Les modifications sont enqueued localement
- Aucune connexion requise pour modifier les données
- Sync automatique quand connexion disponible

## 📊 Statut de Synchronisation

### Dans Settings → Multi-Appareils

Vous verrez :
- **Statut** : Synced ✓ ou Changements en attente ⏳
- **Nombre de changements** : Combien de modifications attendent d'être synchronisées
- **Dernier sync** : Quand la dernière synchronisation a eu lieu
- **Cet appareil** : Identifiant unique et nom
- **Autres appareils** : Liste des autres appareils connectés

## 🧪 Tests

### Test 1 : Sync Simple
```
1. Ouvrir Settings → Multi-Appareils → Voir synchronisation
2. Voir le statut et le nombre de changements
3. Cliquer "Synchroniser maintenant"
4. Attendre confirmation
```

### Test 2 : Deux Appareils
```
Device A (Tablette):
1. Ajouter "Produit X"
2. Aller dans Settings → Multi-Appareils
3. Cliquer "Synchroniser maintenant"

Device B (Téléphone):
1. Attendre (ou sync manuel)
2. Aller dans Products
3. "Produit X" devrait apparaître
```

### Test 3 : Mode Offline
```
Device A:
1. Aéroplane mode ON
2. Ajouter/modifier un produit
3. Aller Settings → Multi-Appareils
4. Voir "2 changements en attente"
5. Aéroplane mode OFF
6. Sync automatique après quelques secondes
7. Vérifier sur Device B
```

### Test 4 : Conflit
```
Device A:
1. Modifier "Fromage" → DLC = 2025-05-10
2. Sync

Device B:
1. Modifier même "Fromage" → DLC = 2025-05-20
2. Sync

Résultat:
- Server utilise Last-Write-Wins (timestamp le plus récent)
- Les deux devices voient la même version finale
```

## ⚙️ Architecture Technique

### Backend (`server/`)
- **sync.js** : Routes de synchronisation (`/api/sync/push`, `/api/sync/pull`)
- **conflictResolver.js** : Logique Last-Write-Wins
- **deviceRegistry.js** : Gestion des appareils enregistrés
- **index.js** : Express server avec tables de sync

### Client (`src/sync/`)
- **SyncManager.ts** : Orchestration principale
- **SyncQueue.ts** : Queue locale des changements
- **DeviceRegistry.ts** : Gestion device_id unique
- **ConflictResolver.ts** : Fusion intelligente
- **types.ts** : Types TypeScript

### UI (`src/components/`)
- **SyncStatus.tsx** : Affichage statut de sync

### Database (`src/database/`)
- Colonnes ajoutées : `version`, `device_id`, `updated_at`, `is_deleted`
- Tables ajoutées : `sync_metadata`, `sync_queue`

## 🔐 Sécurité

### Device ID
- Généré automatiquement et unique par appareil
- Stocké localement dans AsyncStorage
- Utilisé pour identifier l'appareil auprès du serveur

### Token d'authentification
- JWT token stocké de manière sécurisée
- Inclus dans toutes les requêtes API

### Validation
- Chaque changement est validé côté serveur
- Foreign keys et contraintes maintenues
- Audit trail complet des modifications

## 📝 Configuration

Voir `src/constants/syncConfig.ts` pour:
- Intervalle de sync (défaut: 5 min)
- Stratégie de résolution de conflits
- Comportement offline-first
- Clés de stockage

## 🐛 Dépannage

### "Impossible de se connecter au serveur"
```
✓ Vérifier que le serveur est lancé (npm start dans /server)
✓ Vérifier que localhost:3000 est accessible
✓ Vérifier les logs du serveur
```

### "Changements en attente qui ne synchronisent pas"
```
✓ Vérifier la connexion Internet
✓ Cliquer "Synchroniser maintenant" manuellement
✓ Vérifier les logs: `SyncManager.sync error`
```

### "Conflit détecté"
```
- Automatiquement résolu avec Last-Write-Wins
- L'appareil avec timestamp le plus récent gagne
- Consultez sync_history pour audit trail
```

### "Device ID différent sur 2 launches"
```
✓ À ne devrait pas arriver (stocké en AsyncStorage)
✓ Si ça arrive: AsyncStorage peut être cleared
✓ Considérez de restaurer une sauvegarde
```

## 📚 Resources Supplémentaires

### Endpoints API
```
POST   /api/sync/device/register        - Register device
POST   /api/sync/push                   - Push changes
GET    /api/sync/pull                   - Pull changes
POST   /api/sync/conflict-resolve/{id}  - Resolve conflict
GET    /api/sync/status                 - Get sync status
GET    /api/sync/devices                - List devices
GET    /api/sync/history                - Get sync history
```

### Tables Database

**sync_metadata**
- `last_sync` : Last successful sync timestamp
- `last_sync_version` : Version of last sync
- `pending_count` : Number of pending changes

**sync_queue**
- `table_name` : 'products'|'checks'|'aisles'
- `operation` : 'CREATE'|'UPDATE'|'DELETE'
- `entity_id` : ID of entity
- `data` : JSON of changes
- `timestamp` : When change occurred
- `synced_at` : When sent to server (null = pending)

**sync_history** (serveur)
- Audit trail de tous les changements

**conflicts** (serveur)
- Records de conflits détectés

**device_registry** (serveur)
- Appareil enregistrés et métadonnées

## 🎯 Prochaines Étapes

### MVP (Prêt)
✅ Sync bidirectionnel
✅ Offline-first
✅ Conflict resolution
✅ Device registry
✅ UI status

### Futur (Optional)
- [ ] Real-time WebSocket sync
- [ ] UUID migration pour IDs globaux
- [ ] Selective sync (sync certaines tables seulement)
- [ ] Data encryption
- [ ] Compression for large payloads
- [ ] Cloud storage (S3/Cloudinary) pour images
- [ ] Analytics dashboard
- [ ] User profiles et permission

## ✉️ Support

Pour les questions ou problèmes :
1. Vérifier `console.log` pour les messages de debug
2. Consulter `server/` logs
3. Vérifier les tables `sync_history` et `conflicts`
4. Lire les types dans `src/sync/types.ts`

---

**Version** : 1.0.0  
**Date** : Avril 2026  
**Status** : Production Ready MVP
