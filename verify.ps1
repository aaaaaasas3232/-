$lines = Get-Content 'c:\Users\Administrator\Desktop\小听启动\js\apps\chat-app\index.js'
Write-Host ('TOTAL=' + $lines.Count)
$lines[2209..2215]
'---DIVIDER---'
$lines[2680..2690]