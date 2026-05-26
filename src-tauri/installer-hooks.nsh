; "Open in Ferax" shell verbs for folders, folder backgrounds, and drives.
; HKCU matches installer currentUser scope. %V = clicked path.
; NoWorkingDirectory keeps Explorer from overriding %V (System32 on Drive).

!macro NSIS_HOOK_POSTINSTALL
  WriteRegStr HKCU "Software\Classes\Directory\shell\OpenInFerax" "" "Open in Ferax"
  WriteRegStr HKCU "Software\Classes\Directory\shell\OpenInFerax" "Icon" '"$INSTDIR\ferax.exe",0'
  WriteRegStr HKCU "Software\Classes\Directory\shell\OpenInFerax" "NoWorkingDirectory" ""
  WriteRegStr HKCU "Software\Classes\Directory\shell\OpenInFerax\command" "" '"$INSTDIR\ferax.exe" "%V"'

  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\OpenInFerax" "" "Open in Ferax"
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\OpenInFerax" "Icon" '"$INSTDIR\ferax.exe",0'
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\OpenInFerax" "NoWorkingDirectory" ""
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\OpenInFerax\command" "" '"$INSTDIR\ferax.exe" "%V"'

  WriteRegStr HKCU "Software\Classes\Drive\shell\OpenInFerax" "" "Open in Ferax"
  WriteRegStr HKCU "Software\Classes\Drive\shell\OpenInFerax" "Icon" '"$INSTDIR\ferax.exe",0'
  WriteRegStr HKCU "Software\Classes\Drive\shell\OpenInFerax" "NoWorkingDirectory" ""
  WriteRegStr HKCU "Software\Classes\Drive\shell\OpenInFerax\command" "" '"$INSTDIR\ferax.exe" "%V"'
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  DeleteRegKey HKCU "Software\Classes\Directory\shell\OpenInFerax"
  DeleteRegKey HKCU "Software\Classes\Directory\Background\shell\OpenInFerax"
  DeleteRegKey HKCU "Software\Classes\Drive\shell\OpenInFerax"
!macroend
