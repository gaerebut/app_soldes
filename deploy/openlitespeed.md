# OpenLiteSpeed / CyberPanel reverse proxy

The VPS is running OpenLiteSpeed (`lsnode:/usr/local/lsws/Example/html/node/`).
That's why port 80 answers `HTTP 403`. The cleanest fix is to add a proxy
vhost in OLS pointing to `127.0.0.1:3000` — this avoids opening port 3000 to
the Internet.

## Option A — via CyberPanel UI (easiest)

1. Log into CyberPanel: `https://187.124.215.103:8090`
2. **Websites → Create Website** (or pick an existing one).
3. **Websites → List Websites → Manage → vHost Conf**. Append:

   ```conf
   context / {
     type                    proxy
     handler                 dlc_backend
     addDefaultCharset       off
   }

   extprocessor dlc_backend {
     type                    proxy
     address                 127.0.0.1:3000
     maxConns                100
     pcKeepAliveTimeout      60
     initTimeout             60
     retryTimeout            0
     respBuffer              0
   }
   ```

4. Click **Save** then **Graceful Restart** (top-right).
5. Test: `curl https://<your-vhost>/health` → `{"status":"ok",...}`.
6. Add HTTPS via **SSL → Issue SSL** (Let's Encrypt) if the vhost has a domain.

## Option B — raw OLS admin (no CyberPanel)

Edit `/usr/local/lsws/conf/httpd_config.conf` (or the vhost file) and add the
same `extprocessor` + `context /` blocks inside the virtual host. Then:

```
sudo /usr/local/lsws/bin/lswsctrl restart
```

## Option C — bypass OLS and expose Node directly (fastest but least secure)

```
ufw allow 3000/tcp
```

Traffic then goes to `http://187.124.215.103:3000/` in clear text.
Only do this temporarily while you configure the proxy. See `DEPLOY.md`
for the security caveats.
