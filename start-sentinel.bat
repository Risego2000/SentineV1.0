@echo off
title Sentinel V16
echo [SENTINEL] Iniciando servidor API...
start "Sentinel API" cmd /k "npm run start"
timeout /t 3 /nobreak >nul
echo [SENTINEL] Iniciando frontend...
start "Sentinel Frontend" cmd /k "npm run dev"
timeout /t 5 /nobreak >nul
echo [SENTINEL] Abriendo navegador...
start http://localhost:3001
echo [SENTINEL] Listo: http://localhost:3001
timeout /t 2 /nobreak >nul
exit