# PowerShell script to clean up for fresh Windows install test
Write-Host "Cleaning up for fresh install test..." -ForegroundColor Yellow

# Delete the server binary
$serverPath = Join-Path $PSScriptRoot "..\llama.cpp\build\bin\llama-server.exe"
if (Test-Path $serverPath) {
    Write-Host "Deleting llama-server.exe..." -ForegroundColor Cyan
    Remove-Item $serverPath -Force
    Write-Host "✓ Deleted old server binary" -ForegroundColor Green
}

# Delete any temp ZIP files
$zipPath = Join-Path $PSScriptRoot "..\llama-temp.zip"
if (Test-Path $zipPath) {
    Write-Host "Deleting temporary ZIP..." -ForegroundColor Cyan
    Remove-Item $zipPath -Force
    Write-Host "✓ Deleted temp ZIP" -ForegroundColor Green
}

# Delete temp extract folder
$extractPath = Join-Path $PSScriptRoot "..\llama-temp-extract"
if (Test-Path $extractPath) {
    Write-Host "Deleting temp extract folder..." -ForegroundColor Cyan
    Remove-Item $extractPath -Recurse -Force
    Write-Host "✓ Deleted temp extract folder" -ForegroundColor Green
}

# Delete partial model downloads (optional)
$modelPath = Join-Path $PSScriptRoot "..\models\mistral-7b-instruct-q4_k_m.gguf"
$response = Read-Host "Delete model file too? (y/n)"
if ($response -eq 'y') {
    if (Test-Path $modelPath) {
        Write-Host "Deleting model file..." -ForegroundColor Cyan
        Remove-Item $modelPath -Force
        Write-Host "✓ Deleted model file" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "✓ Cleanup complete! You can now run RadPal for a fresh install." -ForegroundColor Green
Write-Host "The app will automatically download the correct Windows binary." -ForegroundColor Cyan
Write-Host ""
Write-Host "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")