# Déploiement du backoffice DLC Manager

Guide pas-à-pas pour (re)mettre le backoffice en ligne sur le VPS
`187.124.215.103` et le rendre résilient aux reboots / crashs.

> **Contexte actuel (diagnostic)**
> - Process Node vivant, géré par `pm2` (`dlc-manager`, uptime 16h)
> - Écoute sur `*:3000` depuis l'intérieur
> - **UFW bloque le port 3000 en entrée** → d'où l'inaccessibilité
> - Le script lancé par pm2 est `index-dev.js` (base **en mémoire**,
>   données perdues à chaque restart — voir section "Dette technique")
> - OpenLiteSpeed écoute sur 80/443 (processus `lsnode:/usr/local/lsws/...`)

---

## 1. Débloquer maintenant (2 min)

Choisis **une** des deux voies. Les commandes s'exécutent en SSH root sur le VPS.

### 1a. Voie rapide (HTTP clair, moins sécurisé)

```bash
ufw allow 3000/tcp
ufw reload
```

Test depuis ton poste :
```bash
curl http://187.124.215.103:3000/health
# → {"status":"ok","mode":"in-memory","uptime":...}
```

⚠️ Login, mots de passe et JWT circulent en clair. À utiliser temporairement.

### 1b. Voie propre (via OpenLiteSpeed, port 3000 reste fermé)

Suis `deploy/openlitespeed.md`. En résumé :
1. Ajoute un vhost OLS qui proxy `/` → `127.0.0.1:3000`
2. Recharge OLS : `sudo /usr/local/lsws/bin/lswsctrl restart`
3. Test : `curl http://187.124.215.103/health`

Avantage : tu pourras activer HTTPS (Let's Encrypt) depuis CyberPanel sans rien toucher côté Node.

---

## 2. Déployer les changements de cette branche

Sur ton poste, pousse la branche puis sur le VPS :

```bash
cd /root/app_soldes
git fetch origin
git checkout claude/remote-backoffice-setup-3E7FN
git pull --ff-only
```

---

## 3. Créer le fichier `.env` (sécurise JWT_SECRET)

Sur le VPS :

```bash
cd /root/app_soldes/server
cp .env.example .env
# Génère un secret fort et remplace la ligne JWT_SECRET=...
SECRET=$(openssl rand -hex 48)
sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$SECRET|" .env

# Si tu utilises un reverse proxy (1b), bind sur localhost uniquement :
sed -i 's|^HOST=.*|HOST=127.0.0.1|' .env
# Sinon (1a), garde HOST=0.0.0.0 :
# sed -i 's|^HOST=.*|HOST=0.0.0.0|' .env

chmod 600 .env
```

---

## 4. Relancer pm2 en prenant en compte le `.env`

```bash
cd /root/app_soldes/server
pm2 delete dlc-manager 2>/dev/null || true

# Charge le .env dans l'environnement courant puis démarre pm2 avec --update-env.
set -a; . /root/app_soldes/server/.env; set +a
pm2 start index.js --name dlc-manager --update-env
pm2 save
pm2 startup systemd -u root --hp /root   # suit l'instruction affichée
```

> `pm2` ne relit pas `.env` tout seul — il faut le sourcer à chaque
> `pm2 restart`. Alternative plus robuste : créer un `ecosystem.config.js`
> avec un bloc `env: { ... }`. La version systemd (étape 5) lit le `.env`
> automatiquement via `EnvironmentFile=`.

> **Important** : on passe de `index-dev.js` (in-memory) à `index.js` (SQLite).
> Les données existantes côté pm2 `index-dev.js` sont **déjà perdues** à
> chaque restart — la migration ne casse donc rien.

Vérifie :
```bash
pm2 logs dlc-manager --lines 20
curl http://127.0.0.1:3000/health
# → {"status":"ok","mode":"sqlite","uptime":...}
```

---

## 5. (Optionnel) Doubler avec systemd comme filet de sécurité

Si tu veux du service management natif (indépendant de pm2) :

```bash
sudo cp /root/app_soldes/deploy/dlc-manager.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now dlc-manager
sudo systemctl status dlc-manager
```

**Attention** : ne garde **qu'un seul** gestionnaire à la fois (pm2 ou systemd),
sinon les deux tenteront de binder le port 3000. Si tu utilises systemd,
commence par :
```bash
pm2 delete dlc-manager
pm2 save
```

---

## 6. Vérifs finales

Depuis ton poste :
```bash
# Voie 1a (UFW ouvert)
curl -s http://187.124.215.103:3000/health

# Voie 1b (derrière OLS)
curl -s http://187.124.215.103/health

# Login doit retourner un token
curl -s -X POST http://187.124.215.103:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"login":"Honfleur","password":"Honfleur"}'
```

Dans l'app mobile : **Settings → Synchronisation → URL du serveur** →
mets `http://187.124.215.103:3000` (voie 1a) ou `http://187.124.215.103` (voie 1b).

---

## Dette technique à traiter ensuite

1. **`index-dev.js` en production** : base en mémoire → toutes les données
   clients perdues à chaque redémarrage pm2. Migrer vers `index.js` (étape 4
   le fait) puis restaurer/recréer les données depuis les devices via sync.
2. **Mot de passe root du VPS exposé** dans la conversation initiale. À
   changer (`passwd`) et à remplacer par une auth SSH par clé.
3. **Login par défaut `Honfleur/Honfleur`** en dur dans `server/index.js:157`.
   À changer en production (UPDATE direct dans la table `users`).
4. **Pas de HTTPS** tant qu'il n'y a pas de domaine. Options :
   - Acheter un domaine et passer Let's Encrypt via CyberPanel
   - Utiliser un service gratuit (duckdns.org) + Let's Encrypt
   - Cert auto-signé (clients verront un warning)

---

## Troubleshooting

### `curl` depuis l'extérieur → timeout

- UFW bloque ? `sudo ufw status | grep 3000`
- OLS pas configuré ? `sudo /usr/local/lsws/bin/lswsctrl status`
- Le process Node écoute-t-il bien ? `ss -tlnp | grep 3000`

### `curl localhost:3000` fonctionne, pas depuis l'extérieur

C'est exactement le symptôme actuel → voie 1a ou 1b, cf. section 1.

### Après `pm2 restart`, on a `EADDRINUSE`

Il reste un ancien process. `ps aux | grep node` puis `kill <PID>`.

### Les données ont disparu

Normal si pm2 tournait `index-dev.js`. Après l'étape 4 (passage sur
`index.js`), SQLite persiste dans `/root/app_soldes/server/dlc-manager.db`.
Backup recommandé : `cp dlc-manager.db dlc-manager.db.$(date +%F)`.
