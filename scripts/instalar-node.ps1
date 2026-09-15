# Baixa e instala o Node.js LTS silenciosamente quando o INICIAR.bat nao o encontra.
# Chamado pelo INICIAR.bat - nao precisa ser rodado a mao.

try {
  $ErrorActionPreference = "Stop"
  [Net.ServicePointManager]::SecurityProtocol =
    [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

  $arco = if ($env:PROCESSOR_ARCHITECTURE -eq "ARM64") { "arm64" } else { "x64" }

  Write-Host "  Consultando a versao mais recente do Node.js (LTS)..."
  $indice = Invoke-RestMethod -Uri "https://nodejs.org/dist/index.json" -UseBasicParsing
  $lts = $indice | Where-Object { $_.lts -ne $false } | Select-Object -First 1
  if (-not $lts) { throw "Nao foi encontrada nenhuma versao LTS na lista da nodejs.org." }
  $versao = $lts.version

  $nomeArquivo = "node-$versao-$arco.msi"
  $url = "https://nodejs.org/dist/$versao/$nomeArquivo"
  $destino = Join-Path $env:TEMP $nomeArquivo

  Write-Host "  Baixando Node.js $versao ($arco)..."
  Invoke-WebRequest -Uri $url -OutFile $destino -UseBasicParsing

  Write-Host "  Instalando - se aparecer um pedido de permissao do Windows, clique em Sim..."
  $processo = Start-Process msiexec.exe -ArgumentList "/i", "`"$destino`"", "/qn", "/norestart" -Wait -PassThru
  Remove-Item $destino -ErrorAction SilentlyContinue

  if ($processo.ExitCode -ne 0 -and $processo.ExitCode -ne 3010) {
    throw "O instalador do Node.js terminou com o codigo $($processo.ExitCode)."
  }

  Write-Host "  Node.js $versao instalado."
  exit 0
} catch {
  Write-Host "  Falha ao instalar o Node.js: $($_.Exception.Message)"
  exit 1
}
