@echo off
REM Installation de Clavier Save
REM Exécuter en tant qu'administrateur pour l'intégration au démarrage

echo Installation de Clavier Save...

REM Installer les dépendances Python
pip install pynput pillow pystray

REM Créer le dossier d'installation
set INSTALL_DIR=%ProgramFiles%\ClavierSave
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

REM Copier le script Python
copy clavier_save.py "%INSTALL_DIR%\"

REM Créer un raccourci au démarrage
set STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
copy clavier_save.vbs "%STARTUP_DIR%\"

echo Installation terminée!
echo Le programme se lancera automatiquement au prochain démarrage.
pause
