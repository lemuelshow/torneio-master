@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title Torneio de Futevolei - servidor local
cd /d "%~dp0"

echo.
echo  ==========================================================
echo   TORNEIO DE FUTEVOLEI - CATEGORIA MASTER
echo   Servidor local  ^|  banco de dados: dados\torneio.xlsx
echo  ==========================================================
echo.

rem ---------------------------------------------------- Node.js instalado?
set "PATH=%PATH%;%ProgramFiles%\nodejs\"
where node >nul 2>nul
if errorlevel 1 (
  echo  Node.js nao encontrado nesta maquina.
  echo  Baixando e instalando automaticamente ^(Node.js LTS^)...
  echo  O Windows pode pedir permissao ^(UAC^) - clique em "Sim".
  echo.
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\instalar-node.ps1"
  if errorlevel 1 (
    echo.
    echo  [ERRO] Nao foi possivel instalar o Node.js automaticamente.
    echo  Baixe a versao LTS em https://nodejs.org e rode este arquivo de novo.
    echo.
    pause
    exit /b 1
  )
  set "PATH=%PATH%;%ProgramFiles%\nodejs\"
  where node >nul 2>nul
  if errorlevel 1 (
    echo.
    echo  [ERRO] O Node.js foi instalado, mas esta janela ainda nao enxerga ele.
    echo  Feche esta janela e de dois cliques no INICIAR.bat de novo.
    echo.
    pause
    exit /b 1
  )
  echo.
  echo  Node.js instalado com sucesso!
  echo.
)

for /f "delims=" %%v in ('node -v') do set NODEVER=%%v
echo  Node.js !NODEVER! encontrado.

rem ------------------------------------------------------- dependencias
if not exist "node_modules\" (
  echo.
  echo  Primeira execucao: instalando dependencias. Isso leva alguns minutos.
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo  [ERRO] A instalacao falhou. Verifique sua conexao e tente de novo.
    echo.
    pause
    exit /b 1
  )
)

rem ------------------------------------------------------------- build
if not exist ".next\BUILD_ID" (
  echo.
  echo  Preparando a aplicacao ^(build de producao^)...
  echo.
  call npm run build
  if errorlevel 1 (
    echo.
    echo  [ERRO] O build falhou. Nada foi iniciado.
    echo.
    pause
    exit /b 1
  )
)

rem -------------------------------------------------------- porta livre
set PORTA=3000
for /f "delims=" %%p in ('node scripts\porta-livre.js') do set PORTA=%%p

rem -------- aviso se a planilha estiver aberta no Excel (bloqueia gravacao)
tasklist /fi "imagename eq EXCEL.EXE" 2>nul | find /i "EXCEL.EXE" >nul
if not errorlevel 1 (
  echo.
  echo  [ATENCAO] O Excel esta aberto. Se a planilha dados\torneio.xlsx
  echo            estiver aberta nele, o sistema nao conseguira gravar.
  echo            Feche o arquivo antes de cadastrar ou sortear.
)

echo.
echo  ----------------------------------------------------------
echo   Endereco:  http://localhost:!PORTA!
echo   Planilha:  %~dp0dados\torneio.xlsx
echo.
echo   Para PARAR o servidor: feche esta janela ou aperte Ctrl+C.
echo  ----------------------------------------------------------
echo.

rem abre o navegador depois de um instante, com o servidor ja subindo
rem ping em vez de timeout: funciona mesmo com a entrada redirecionada
start "" /b cmd /c "ping -n 6 127.0.0.1 >nul & start "" http://localhost:!PORTA!"

call npm start -- -p !PORTA!

echo.
echo  O servidor foi encerrado.
echo.
pause
