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

REM Créer le dossier de logs personnalisé
echo Création du dossier de logs...
set LOG_DIR=C:\Users\FRMK0319APPF\Desktop\RAYON_SAUVEGARDE\GAETAN\IA\clavier_save
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

REM Copier le script VBS au démarrage
set STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
copy clavier_save.vbs "%STARTUP_DIR%\"

echo Installation terminée!
echo Les logs seront sauvegardés dans: %LOG_DIR%
echo Le programme se lancera automatiquement au prochain démarrage.
pause
