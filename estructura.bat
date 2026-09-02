@echo off
setlocal EnableExtensions

REM 1) Colócate en la carpeta donde está este .bat
cd /d "%~dp0"

REM 2) Archivo de salida limpio
> "estructura.txt" (
  REM Archivos de la raíz (sin carpetas)
  dir /b /a-d

  REM 3) Recorre solo carpetas de primer nivel EXCLUYENDO .git, node_modules y dist
  for /d %%D in (*) do (
    if /I not "%%~nxD"==".git" if /I not "%%~nxD"=="node_modules" if /I not "%%~nxD"=="dist" (
      echo.
      echo ================================
      echo  %%~nxD
      echo ================================
      tree "%%~fD" /F
    )
  )
)

echo Listado generado en estructura.txt
pause
