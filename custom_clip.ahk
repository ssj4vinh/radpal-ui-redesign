#NoTrayIcon

; Custom clipboard auto-capture script
DetectHiddenWindows On
SetTitleMatchMode, 2

IfWinExist, Powerscribe
{
  WinActivate
  Sleep 300
  Send ^a
  Sleep 100
  Send ^c
}
