# Install Supabase CLI for Windows

Write-Host "Installing Supabase CLI..." -ForegroundColor Green

# Download the latest release
$downloadUrl = "https://github.com/supabase/cli/releases/latest/download/supabase_windows_amd64.zip"
$zipPath = "$env:TEMP\supabase.zip"
$extractPath = "$env:TEMP\supabase"

Write-Host "Downloading Supabase CLI..."
Invoke-WebRequest -Uri $downloadUrl -OutFile $zipPath

Write-Host "Extracting..."
Expand-Archive -Path $zipPath -DestinationPath $extractPath -Force

# Move to a location in PATH
$installPath = "$env:LOCALAPPDATA\supabase"
if (!(Test-Path $installPath)) {
    New-Item -ItemType Directory -Path $installPath | Out-Null
}

Move-Item -Path "$extractPath\supabase.exe" -Destination "$installPath\supabase.exe" -Force

# Add to PATH if not already there
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$installPath*") {
    Write-Host "Adding Supabase to PATH..."
    [Environment]::SetEnvironmentVariable("Path", "$userPath;$installPath", "User")
    $env:Path = "$env:Path;$installPath"
}

# Cleanup
Remove-Item $zipPath -Force
Remove-Item $extractPath -Recurse -Force

Write-Host "✅ Supabase CLI installed successfully!" -ForegroundColor Green
Write-Host "You may need to restart your terminal for PATH changes to take effect." -ForegroundColor Yellow

# Test installation
supabase --version