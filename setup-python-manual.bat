@echo off
REM Script para descargar Python manualmente (ya que python.org está bloqueado)
REM Después de descargar el ZIP, este script lo extrae e instala PaddleOCR

setlocal enabledelayedexpansion

echo.
echo ============================================================
echo  SentinelV16 - Configuración Manual de Python
echo ============================================================
echo.

REM Verificar si Python ya existe
if exist "resources\python\python.exe" (
    echo ✓ Python ya está instalado
    goto INSTALL_PADDLEOCR
)

REM Si el ZIP está en Descargas, copiarlo
if exist "%USERPROFILE%\Downloads\python-3.10*-embed-amd64.zip" (
    echo ✓ Encontrado ZIP de Python en Descargas
    for %%f in ("%USERPROFILE%\Downloads\python-3.10*-embed-amd64.zip") do (
        echo Extrayendo: %%f
        powershell -Command "Expand-Archive -Path '%%f' -DestinationPath 'resources\python' -Force"
        if !errorlevel! equ 0 (
            echo ✓ Python extraído exitosamente
            goto INSTALL_PADDLEOCR
        )
    )
)

REM Si no se encuentra, mostrar instrucciones
echo ⏳ Se necesita descargar Python manualmente:
echo.
echo 1. Abre en tu navegador:
echo    https://www.python.org/downloads/windows/
echo.
echo 2. Busca "Python 3.10" (o una versión 3.10.x más reciente)
echo.
echo 3. Descarga "Windows embeddable package (64-bit)"
echo    (Busca: python-3.10.x-embed-amd64.zip)
echo.
echo 4. Guarda el archivo en: %USERPROFILE%\Downloads\
echo.
echo 5. Una vez descargado, ejecuta este script nuevamente
echo.
pause
exit /b 1

:INSTALL_PADDLEOCR
echo.
echo ✓ Python listo. Instalando PaddleOCR...
echo.

if not exist "resources\python\python.exe" (
    echo ✗ Error: python.exe no encontrado en resources\python\
    exit /b 1
)

echo Descargando e instalando PaddleOCR (esto puede tomar 10-15 minutos)...
echo Por favor espera...
echo.

resources\python\python.exe -m pip install paddleocr paddlepaddle pillow

if !errorlevel! equ 0 (
    echo.
    echo ✓ PaddleOCR instalado exitosamente
    echo.
    echo Siguientes pasos:
    echo  1. npm run test:electron
    echo  2. npm run electron
    echo.
) else (
    echo ✗ Error instalando PaddleOCR
    exit /b 1
)

