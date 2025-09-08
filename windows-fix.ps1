#!/usr/bin/env powershell
# RadPal Windows Fix Script
# Installs required dependencies and fixes common Windows issues

Write-Host "🔧 RadPal Windows Fix Script" -ForegroundColor Cyan
Write-Host "============================" -ForegroundColor Cyan
Write-Host ""

# Check if we're in the right directory
if (!(Test-Path "package.json")) {
    Write-Host "❌ Error: package.json not found!" -ForegroundColor Red
    Write-Host "Please run this script from the RadPal root directory" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "📦 Installing missing npm packages..." -ForegroundColor Green

# Install core dependencies
$packages = @("mic", "node-hid")
foreach ($package in $packages) {
    Write-Host "Installing $package..." -ForegroundColor Yellow
    $result = npm install $package
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ $package installed successfully" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Warning: Failed to install $package" -ForegroundColor Yellow
        Write-Host "You may need to run as administrator" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "🔧 Building application..." -ForegroundColor Green
$buildResult = npm run build
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Build completed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🎉 Setup complete!" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "📝 Next steps:" -ForegroundColor Yellow
    Write-Host "   1. Run: npm run electron" -ForegroundColor White
    Write-Host "   2. Click the microphone button to test" -ForegroundColor White
    Write-Host "   3. Grant microphone permissions when prompted" -ForegroundColor White
    Write-Host ""
    Write-Host "💡 PowerMic Notes:" -ForegroundColor Yellow
    Write-Host "   - Physical PowerMic should work now" -ForegroundColor White
    Write-Host "   - If not working, check USB connection" -ForegroundColor White
    Write-Host "   - Some devices may need driver installation" -ForegroundColor White
    Write-Host ""
    Write-Host "🚀 The app should now work without sox errors!" -ForegroundColor Green
} else {
    Write-Host "❌ Build failed. Please check error messages above." -ForegroundColor Red
}

Write-Host ""
Read-Host "Press Enter to continue"