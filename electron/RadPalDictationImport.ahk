
#NoEnv  ; Recommended for performance and compatibility
#SingleInstance Force
SendMode Input  ; Recommended for new scripts due to its superior speed and reliability
SetWorkingDir %A_ScriptDir%  ; Ensures a consistent starting directory
SetTitleMatchMode, 2  ; Allow partial window title matching
CoordMode, Mouse, Window  ; Use window-relative coordinates
SetKeyDelay, 10, 10  ; Small delay between keystrokes for reliability


; Report Generation Hotkey
F6::
    ; Store current window to return to later
    WinGet, radpalWindow, ID, A
    
    ; Clear clipboard first to ensure clean state
    Clipboard := ""
    
    ; Try to find and activate dictation window
    found := false
    
    if WinExist("PowerScribe")
    {
        WinActivate
        found := true
    }
    else 
    if WinExist("Fluency")
    {
        WinActivate
        found := true
    }
    else 
    if WinExist("Dragon")
    {
        WinActivate
        found := true
    }
    
    if (!found)
    {
        MsgBox, 0, RadPal, No dictation window found!, 2
        return
    }
    
    ; Wait for window to be active
    WinWaitActive, , , 2
    Sleep, 200
    
    ; Select all text in dictation window
    Send, ^a
    Sleep, 150
    
    ; Copy to clipboard
    Send, ^c
    ClipWait, 2  ; Wait up to 2 seconds for clipboard to contain data
    
    if (!Clipboard)
    {
        MsgBox, 0, RadPal, Failed to copy text from dictation window!, 2
        return
    }
    
    ; Store the clipboard content
    copiedText := Clipboard
    
    ; Return to RadPal window
    WinActivate, ahk_id %radpalWindow%
    WinWaitActive, ahk_id %radpalWindow%, , 2
    Sleep, 300
    
    ; Ensure RadPal window is fully focused
    WinActivate, RadPal
    Sleep, 200
    
    ; Focus the findings textbox with a more reliable method
    ; Save mouse position
    MouseGetPos, origX, origY
    
    ; Method 1: Click directly in the textbox
    ; Assuming the findings textbox is the main input area
    WinGetPos, winX, winY, winWidth, winHeight, RadPal
    
    ; Calculate click position (adjust these values based on UI)
    ; Findings textbox is typically in the upper-middle area
    clickX := winWidth / 2
    clickY := 200  ; Adjust based on your UI
    
    ; Click to focus the textbox
    Click, %clickX%, %clickY%
    Sleep, 200
    
    ; Double-click to select any word (ensures we're in text area)
    Click, 2
    Sleep, 100
    
    ; Select all existing text
    Send, ^a
    Sleep, 150
    
    ; Clear existing content
    Send, {Delete}
    Sleep, 100
    
    ; Alternative: Use Tab navigation from a known position
    ; Send, {F6}  ; Focus address bar in many browsers/Electron apps
    ; Sleep, 100
    ; Send, {Tab}  ; Tab to first field (findings)
    ; Sleep, 100
    
    ; Restore mouse position
    MouseMove, %origX%, %origY%, 0
    
    ; Restore clipboard and paste
    Clipboard := copiedText
    Sleep, 100
    Send, ^v
    Sleep, 300
    
    
    ; Trigger Report Generation with keyboard shortcut
    Send, ^!f  ; Control+Alt+F for report
return
