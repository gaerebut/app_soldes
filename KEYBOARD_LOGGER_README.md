# Keyboard Logger - Surveillance PC

Un programme pour enregistrer les frappes clavier sur votre PC et surveiller qui l'utilise.

## Installation

### Sur Windows

1. **Télécharger les fichiers** :
   - `keyboard_logger.py`
   - `install_keylogger.bat`
   - `keyboard_logger.vbs`

2. **Installer les dépendances** :
   ```bash
   pip install pynput pillow pystray
   ```

3. **Lancer l'installation** (en tant qu'administrateur) :
   - Double-cliquez sur `install_keylogger.bat`
   - Ou exécutez dans PowerShell :
     ```powershell
     .\install_keylogger.bat
     ```

4. **Lancement manuel** :
   ```bash
   python keyboard_logger.py
   ```

5. **Lancement automatique au démarrage** :
   - Le script VBS `keyboard_logger.vbs` dans le dossier Démarrage
   - Le logger se lancera automatiquement sans afficher de fenêtre

## Utilisation

### Affichage des logs

Les logs sont enregistrés dans : `%USERPROFILE%\.pc_monitor\`

Format des fichiers : `keylog_YYYYMMDD.json`

Exemple :
```json
[
  {
    "timestamp": "2026-05-11T10:30:45.123456",
    "key": "a",
    "type": "press"
  },
  {
    "timestamp": "2026-05-11T10:30:46.234567",
    "key": "[enter]",
    "type": "press"
  }
]
```

### Consulter les logs

1. Ouvrez l'Explorateur Windows
2. Allez à : `%USERPROFILE%\.pc_monitor\`
3. Ouvrez les fichiers JSON avec un éditeur de texte

### Arrêter l'enregistrement

- Fermez le programme via son icône dans la barre des tâches
- Ou tuez le processus Python avec le Gestionnaire des tâches

## Caractéristiques

✅ Enregistrement continu des frappes clavier  
✅ Exécution en arrière-plan sans fenêtre visible  
✅ Icône dans la barre des tâches (Windows)  
✅ Sauvegarde automatique des logs  
✅ Un fichier par jour  
✅ Format JSON pour facile consultation  
✅ Timestamps précis pour chaque frappe  

## Notes de sécurité

⚠️ Ce programme enregistre TOUTES les frappes, incluant les mots de passe  
⚠️ Les logs sont stockés en clair dans des fichiers JSON  
⚠️ À utiliser uniquement sur votre propre appareil  
⚠️ Ne pas distribuer ou utiliser sans consentement

## Localisation des logs

```
Windows: C:\Users\[VotreNom]\.pc_monitor\
Linux: /home/[votrelogin]/.pc_monitor/
macOS: /Users/[votrelogin]/.pc_monitor/
```

## Dépannage

**Q: Le programme ne démarre pas**
- Vérifiez que Python 3.7+ est installé
- Installez les dépendances : `pip install pynput pillow pystray`

**Q: Pas de logs générés**
- Vérifiez que le dossier `.pc_monitor` existe dans votre répertoire personnel
- Vérifiez les permissions de fichier

**Q: Comment supprimer les logs?**
- Accédez au dossier `.pc_monitor` et supprimez les fichiers JSON

## Support des touches spéciales

Le logger reconnaît et enregistre :
- Lettres : `a`, `b`, `c`, etc.
- Chiffres : `0`, `1`, `2`, etc.
- Touches spéciales : `[enter]`, `[shift]`, `[ctrl]`, `[alt]`, `[tab]`, `[delete]`, etc.
- Caractères spéciaux : `!`, `@`, `#`, etc.
