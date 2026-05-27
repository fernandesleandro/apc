# Limpeza Rápida de Cache - Script PowerShell
# Execute este script para limpar cache automaticamente

Write-Host "🧹 Limpeza de Cache - APC Construções" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

# Passo 1: Parar servidor (se está rodando)
Write-Host "📌 Passo 1: Verificando servidor..." -ForegroundColor Yellow
$serverProcess = Get-Process node -ErrorAction SilentlyContinue
if ($serverProcess) {
    Write-Host "✓ Processo Node encontrado, encerrando..." -ForegroundColor Green
    Stop-Process -Name node -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    Write-Host "✓ Servidor parado" -ForegroundColor Green
} else {
    Write-Host "✓ Nenhum processo Node em execução" -ForegroundColor Green
}
Write-Host ""

# Passo 2: Limpar npm cache
Write-Host "📌 Passo 2: Limpando cache npm..." -ForegroundColor Yellow
npm cache clean --force
Write-Host "✓ Cache npm limpo" -ForegroundColor Green
Write-Host ""

# Passo 3: Limpar node_modules e reinstalar
Write-Host "📌 Passo 3: Reinstalando dependências..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Remove-Item "node_modules" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "✓ node_modules removido" -ForegroundColor Green
}
if (Test-Path "package-lock.json") {
    Remove-Item "package-lock.json" -Force -ErrorAction SilentlyContinue
    Write-Host "✓ package-lock.json removido" -ForegroundColor Green
}
npm install
Write-Host "✓ Dependências reinstaladas" -ForegroundColor Green
Write-Host ""

# Passo 4: Resumir servidor
Write-Host "📌 Passo 4: Reiniciando servidor..." -ForegroundColor Yellow
Write-Host ""
Write-Host "IMPORTANTE: O servidor iniciará agora. NÃO feche este terminal!" -ForegroundColor Red
Write-Host ""
Write-Host "Após iniciar, abra seu navegador e:" -ForegroundColor Cyan
Write-Host "1. Pressione Ctrl + Shift + Delete (para limpar cache)"
Write-Host "2. Limpe cookies e cache"
Write-Host "3. Acesse: http://localhost:3000/admin/edit-project/{projectId}"
Write-Host "4. Verifique se o fundo está AZUL ESCURO"
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host ""

npm start
