# Clavier Save - Surveillance PC

Un programme discret pour enregistrer les frappes clavier sur votre PC et surveiller qui l'utilise.

## Installation

### Sur Windows

1. **Télécharger les fichiers** :
   - `clavier_save.py`
   - `install_clavier_save.bat`
   - `clavier_save.vbs`

2. **Installer les dépendances** :
   ```bash
   pip install pynput pillow pystray
   ```

3. **Lancer l'installation** (en tant qu'administrateur) :
   - Double-cliquez sur `install_clavier_save.bat`
   - Ou exécutez dans PowerShell :
     ```powershell
     .\install_clavier_save.bat
     ```

4. **Lancement manuel** :
   ```bash
   python clavier_save.py
   ```

5. **Lancement automatique au démarrage** :
   - Le script VBS `clavier_save.vbs` dans le dossier Démarrage
   - Le programme se lancera automatiquement sans afficher de fenêtre

## Utilisation

### Affichage des logs

Les logs sont enregistrés dans : `%USERPROFILE%\.clavier_save\` (ou votre dossier personnalisé)

Format des fichiers : `save_YYYYMMDD.txt` (un fichier par jour)

Exemple de contenu :
```
[2026-05-11T10:30:45.123456] a
[2026-05-11T10:30:46.234567] [shift]
[2026-05-11T10:30:47.345678] b
[2026-05-11T10:30:48.456789] c
[2026-05-11T10:30:49.567890] [enter]
```

### Consulter les logs

1. Ouvrez l'Explorateur Windows
2. Allez à : `%USERPROFILE%\.clavier_save\`
3. Ouvrez les fichiers JSON avec un éditeur de texte

### Arrêter l'enregistrement

- Fermez le programme via son icône dans la barre des tâches
- Ou tuez le processus Python avec le Gestionnaire des tâches

## Caractéristiques

✅ Enregistrement continu et discret
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

## Configuration du dossier personnalisé

Pour sauvegarder les logs dans un dossier spécifique, modifiez le fichier `clavier_save.py` :

```python
# Environ ligne 140, décommentez et modifiez :
custom_log_dir = r"C:\Votre\Chemin\Personnalisé"
```

## Localisation des logs

Par défaut :
```
Windows: C:\Users\[VotreNom]\.clavier_save\
Linux: /home/[votrelogin]/.clavier_save/
macOS: /Users/[votrelogin]/.clavier_save/
```

Avec dossier personnalisé : le chemin que vous avez configuré

## Dépannage

**Q: Le programme ne démarre pas**
- Vérifiez que Python 3.7+ est installé
- Installez les dépendances : `pip install pynput pillow pystray`

**Q: Pas de logs générés**
- Vérifiez que le dossier `.clavier_save` existe dans votre répertoire personnel
- Vérifiez les permissions de fichier

**Q: Comment supprimer les logs?**
- Accédez au dossier `.clavier_save` et supprimez les fichiers JSON

## Support des touches spéciales

Le programme reconnaît et enregistre :
- Lettres : `a`, `b`, `c`, etc.
- Chiffres : `0`, `1`, `2`, etc.
- Touches spéciales : `[enter]`, `[shift]`, `[ctrl]`, `[alt]`, `[tab]`, `[delete]`, etc.
- Caractères spéciaux : `!`, `@`, `#`, etc.
