!macro customInit
  # Show loading message immediately when installer starts
  # Using /set 76 to set the main text
  Banner::show /NOUNLOAD /set 76 "RadPal Installer Loading..." "Please wait..."
  
  # Add a small delay to ensure banner is visible
  Sleep 200
  
  # Kill any running RadPal processes before update
  DetailPrint "Checking for running instances..."
  nsExec::Exec 'taskkill /F /IM RadPal.exe'
  nsExec::Exec 'taskkill /F /IM radpal.exe'
  nsExec::Exec 'taskkill /F /IM RadPalHotkeys.exe'
  nsExec::Exec 'taskkill /F /IM llama-server.exe'
  Pop $0
  
  # Additional delay to show progress
  Sleep 300
  
  # Hide the banner after initialization
  Banner::destroy
!macroend

!macro customInstallMode
  # Force updates to restart the app after installation
  # Note: This macro may be called during install mode selection
!macroend

!macro customUnInstall
  # Kill any running RadPal processes during uninstall
  nsExec::Exec 'taskkill /F /IM RadPal.exe'
  nsExec::Exec 'taskkill /F /IM radpal.exe'
  nsExec::Exec 'taskkill /F /IM RadPalHotkeys.exe'
  nsExec::Exec 'taskkill /F /IM llama-server.exe'
!macroend

!macro customInstall
  # Ensure app runs after silent install/update
  ${if} ${isUpdated}
    # Force run app after any update (silent or not)
    WriteRegStr HKCU "Software\RadPal" "RestartAfterUpdate" "1"
  ${endif}
  
  # Always create desktop shortcut (in case it was deleted or this is an update)
  CreateShortcut "$DESKTOP\RadPal.lnk" "$INSTDIR\RadPal.exe"
  
  # Also ensure Start Menu shortcut exists
  CreateDirectory "$SMPROGRAMS\RadPal"
  CreateShortcut "$SMPROGRAMS\RadPal\RadPal.lnk" "$INSTDIR\RadPal.exe"
  CreateShortcut "$SMPROGRAMS\RadPal\Uninstall RadPal.lnk" "$INSTDIR\Uninstall RadPal.exe"
!macroend

!macro customInstSuccess
  # Force app restart after successful update installation
  ${if} ${isUpdated}
    # Always restart the app after an update
    # Use Exec instead of ExecShell for better reliability
    Exec '"$INSTDIR\${APP_EXECUTABLE_FILENAME}"'
  ${endif}
!macroend

# Also ensure app launches after installation for updates
!macro customInstFinish
  ${if} ${isUpdated}
    # Launch app after finish page
    Exec '"$INSTDIR\${APP_EXECUTABLE_FILENAME}"'
  ${endif}
!macroend