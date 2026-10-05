@echo off
cd /d "%~dp0"
(
echo === STATUS ===
git status --short
echo === BRANCH ===
git status -sb
echo === LOG ===
git log -3 --oneline
) > revisar-git.log 2>&1
