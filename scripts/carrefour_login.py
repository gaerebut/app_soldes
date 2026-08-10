#!/usr/bin/env python3
"""
Automatisation de la connexion Carrefour
Lance Edge, navigue vers le site, remplit le formulaire et se connecte
"""

import os
import time
from pathlib import Path
from dotenv import load_dotenv
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.edge.options import Options as EdgeOptions

# Charger les variables d'environnement
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(env_path)

LOGIN = os.getenv('CARREFOUR_LOGIN')
PASSWORD = os.getenv('CARREFOUR_PASSWORD')
URL = 'https://caro-super.fr.carrefour.com/carologin'

if not LOGIN or not PASSWORD:
    raise ValueError('Les variables d\'environnement CARREFOUR_LOGIN et CARREFOUR_PASSWORD sont obligatoires')

def automate_carrefour_login():
    """Automatise la connexion à Carrefour"""

    # Configurer Edge avec options
    edge_options = EdgeOptions()
    # Décommenter la ligne suivante pour lancer Edge en arrière-plan (headless)
    # edge_options.add_argument('--headless')
    edge_options.add_argument('--no-sandbox')
    edge_options.add_argument('--disable-dev-shm-usage')

    print(f"🚀 Lancement d'Edge...")
    driver = webdriver.Edge(options=edge_options)

    try:
        print(f"📍 Navigation vers {URL}...")
        driver.get(URL)

        # Attendre le chargement de la page
        time.sleep(2)

        # Chercher le champ login
        print("🔍 Recherche du champ login...")
        login_field = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.ID, "form_login"))
        )
        print("✅ Champ login trouvé")

        # Saisir le login
        print(f"⌨️  Saisie du login...")
        login_field.clear()
        login_field.send_keys(LOGIN)
        time.sleep(0.5)

        # Chercher le champ password
        print("🔍 Recherche du champ password...")
        password_field = driver.find_element(By.ID, "form_password")
        print("✅ Champ password trouvé")

        # Saisir le password
        print("⌨️  Saisie du password...")
        password_field.clear()
        password_field.send_keys(PASSWORD)
        time.sleep(0.5)

        # Cliquer sur le bouton connexion
        print("🖱️  Clic sur le bouton connexion...")
        submit_button = driver.find_element(By.ID, "form_submit")
        submit_button.click()

        # Attendre la redirection
        print("⏳ Attente de la connexion...")
        time.sleep(5)

        print("✨ Connexion effectuée avec succès!")
        print(f"📄 URL actuelle: {driver.current_url}")

        # Garder le navigateur ouvert pour voir le résultat
        input("Appuyez sur Entrée pour fermer le navigateur...")

    except Exception as e:
        print(f"❌ Erreur: {str(e)}")
        raise
    finally:
        driver.quit()

if __name__ == '__main__':
    automate_carrefour_login()
