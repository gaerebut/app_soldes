# Automatisation Connexion Carrefour

Ce script automatise la connexion au site Carrefour (https://caro-super.fr.carrefour.com/carologin) à l'aide de Selenium et Microsoft Edge.

## Installation

### 1. Installer Python (si pas encore installé)
Téléchargez Python 3.8+ depuis https://www.python.org/downloads/

### 2. Installer les dépendances Python
```bash
pip install -r requirements.txt
```

### 3. Télécharger EdgeDriver
Le script utilise Microsoft Edge. Vous devez télécharger le WebDriver correspondant à votre version d'Edge :

1. Vérifiez votre version d'Edge : Menu > Paramètres > À propos de Microsoft Edge
2. Téléchargez le WebDriver depuis : https://developer.microsoft.com/en-us/microsoft-edge/tools/webdriver/
3. Placez le fichier `msedgedriver.exe` dans le PATH ou dans le répertoire du script

**Alternative plus simple** : Installer via pip
```bash
pip install msedgedriver
```

### 4. Vérifier le fichier `.env`
Le fichier `.env` contient vos identifiants (ne pas commiter ce fichier !) :
```
CARREFOUR_LOGIN=coralie_rebut
CARREFOUR_PASSWORD=Honfleur2304!
```

## Utilisation

### Lancer le script
```bash
python scripts/carrefour_login.py
```

Ou si vous êtes sur Windows :
```bash
python.exe scripts/carrefour_login.py
```

### Comportement
1. Un navigateur Edge se lance automatiquement
2. Le script navigue vers https://caro-super.fr.carrefour.com/carologin
3. Les champs de connexion sont remplis automatiquement
4. Le bouton de connexion est cliqué
5. Le navigateur reste ouvert pour vérifier le résultat
6. Appuyez sur Entrée pour fermer

## Ajustement des sélecteurs

Si le script ne trouve pas les champs ou le bouton, c'est probablement parce que les sélecteurs HTML ont changé.

Pour trouver les bons sélecteurs :
1. Ouvrez le site manuellement dans Edge
2. Faites clic droit sur le champ login > Inspecter (F12)
3. Notez l'ID ou le sélecteur CSS (par exemple : `id="email"` ou `class="input-login"`)
4. Modifiez le script en remplaçant les sélecteurs

Exemple de modification dans le script :
```python
# Ancien
login_field = driver.find_element(By.ID, "form_login")

# Nouveau (si l'ID a changé)
login_field = driver.find_element(By.ID, "email")

# Ou avec une classe CSS
login_field = driver.find_element(By.CSS_SELECTOR, "input.email-field")
```

## Troubleshooting

### ❌ "msedgedriver.exe" not found
→ Installez msedgedriver ou téléchargez-le manuellement

### ❌ Element not found
→ Les sélecteurs CSS/ID ont changé, inspectez la page et mettez à jour le script

### ❌ Connexion échoue
→ Vérifiez les identifiants dans `.env`
→ Vérifiez que le site est accessible

### ❌ Module not found (selenium, dotenv)
→ Installez les dépendances : `pip install -r requirements.txt`

## Améliorations possibles

- [ ] Ajouter des logs plus détaillés
- [ ] Gérer les cas d'erreur de connexion
- [ ] Créer un mode "headless" (sans interface)
- [ ] Intégrer le script dans l'app Node.js
