$content = Get-Content -Path "C:\dev\radpal\package.json" -Raw
$content = $content -replace '"oneClick": false', '"oneClick": true'
$content = $content -replace '"allowElevation": true,\s*', ''
$content = $content -replace '"allowToChangeInstallationDirectory": true', '"allowToChangeInstallationDirectory": false'
$content = $content -replace '"perMachine": false,\s*', ''
$content = $content -replace '"include": "build/installer.nsh",?\s*', ''
Set-Content -Path "C:\dev\radpal\package.json" -Value $content -NoNewline
Write-Host "Package.json updated successfully"