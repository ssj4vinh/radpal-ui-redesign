# PowerShell script to test the llama server binary
Write-Host "Testing llama-server.exe..." -ForegroundColor Yellow

$serverPath = Join-Path $PSScriptRoot "..\llama.cpp\build\bin\llama-server.exe"

if (Test-Path $serverPath) {
    Write-Host "✓ Server binary found at: $serverPath" -ForegroundColor Green
    
    # Check file properties
    $file = Get-Item $serverPath
    Write-Host "  File size: $([math]::Round($file.Length / 1MB, 2)) MB" -ForegroundColor Cyan
    Write-Host "  Created: $($file.CreationTime)" -ForegroundColor Cyan
    Write-Host "  Modified: $($file.LastWriteTime)" -ForegroundColor Cyan
    
    # Check if it's blocked
    $stream = Get-Item $serverPath -Stream *
    if ($stream | Where-Object { $_.Stream -eq "Zone.Identifier" }) {
        Write-Host "  ⚠ File is blocked (downloaded from internet)" -ForegroundColor Yellow
        Write-Host "  Unblocking file..." -ForegroundColor Cyan
        Unblock-File -Path $serverPath
        Write-Host "  ✓ File unblocked" -ForegroundColor Green
    } else {
        Write-Host "  ✓ File is not blocked" -ForegroundColor Green
    }
    
    # Try to run with help flag
    Write-Host ""
    Write-Host "Testing if binary can run..." -ForegroundColor Yellow
    try {
        $output = & $serverPath --help 2>&1
        Write-Host "✓ Binary runs successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "First few lines of output:" -ForegroundColor Cyan
        $output | Select-Object -First 5 | ForEach-Object { Write-Host "  $_" }
    } catch {
        Write-Host "✗ Failed to run binary" -ForegroundColor Red
        Write-Host "  Error: $_" -ForegroundColor Red
        
        # Try to get more info
        Write-Host ""
        Write-Host "Getting file details..." -ForegroundColor Yellow
        
        # Check architecture
        try {
            $bytes = [System.IO.File]::ReadAllBytes($serverPath)
            $peOffset = [BitConverter]::ToInt32($bytes, 0x3C)
            $machine = [BitConverter]::ToUInt16($bytes, $peOffset + 4)
            
            $arch = switch ($machine) {
                0x14c { "x86 (32-bit)" }
                0x8664 { "x64 (64-bit)" }
                0xAA64 { "ARM64" }
                default { "Unknown ($machine)" }
            }
            
            Write-Host "  Architecture: $arch" -ForegroundColor Cyan
        } catch {
            Write-Host "  Could not determine architecture" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "✗ Server binary not found at: $serverPath" -ForegroundColor Red
    Write-Host ""
    Write-Host "Run 'npm run electron' to automatically download it" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")