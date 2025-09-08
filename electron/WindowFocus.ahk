; RadPal Window Focus Script
; Hotkey: Ctrl+Alt+A
; Target Window: powerscribe
; Key to Send: F4

#NoEnv
#SingleInstance Force
SendMode Input
SetWorkingDir %A_ScriptDir%
SetTitleMatchMode, 2  ; Allow partial window title matching

^!A::
    ; Save current window
    WinGet, CurrentWindow, ID, A
    
    ; Find and activate target window using partial match
    SetTitleMatchMode, 2
    IfWinExist, powerscribe
    {
        WinActivate
        WinWaitActive, powerscribe, , 2
        if ErrorLevel
        {
            MsgBox, 0, RadPal, Failed to activate window "powerscribe"
            return
        }
        Sleep, 100  ; Small delay to ensure window is ready
        Send, {F4}
        
        ; Optional: Return to original window
        ; WinActivate, ahk_id %CurrentWindow%
    }
    else
    {
        MsgBox, 0, RadPal, Window containing "powerscribe" not found!
    }
return

; Exit hotkey
^Escape::ExitApp