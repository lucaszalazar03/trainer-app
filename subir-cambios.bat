@echo off
cd /d "%~dp0"
echo Subiendo cambios de Z-Performance a GitHub...
(
echo === ANTES ===
git status --short
git add -A
git reset -q -- "src/components/TrainingSession (1).tsx" revisar-git.bat revisar-git.log subir-cambios.bat subir-cambios.log
echo === COMMIT ===
git commit -m "Biblioteca: lista completa, busqueda instantanea y borrado rapido"
echo === PUSH ===
git push
echo === DESPUES ===
git status -sb
git log -3 --oneline
) > subir-cambios.log 2>&1
echo Listo. Esta ventana se cierra sola.
timeout /t 4 >nul
