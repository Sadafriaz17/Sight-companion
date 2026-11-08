$p = "D:\Sight_Companion\Frontend\src\Pages.tsx"
$lines = Get-Content $p
$lines[6] = "  getProfile,`n  updateProfile,"
$lines[8] = 'import { type Session, updateSession } from "./auth.ts"'
Set-Content $p $lines
"DONE"
