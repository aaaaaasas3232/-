$lines = Get-Content 'c:\Users\Administrator\Desktop\小听启动\js\apps\chat-app\index.js'
# 0-based
Write-Host ('TOTAL=' + $lines.Count)
# 我要删除的区间:第2213行(0-based 2212)到第2753行(0-based 2752)共 541 行
# 因为 2212..2752 inclusive = 541 elements
# 然后 top = 0..2211, bot = 2753..(Count-1)
$top = $lines[0..2211]
$mid = $lines[2212..2752]
$bot = $lines[2753..($lines.Count-1)]
Write-Host ('TOP=' + $top.Count)
Write-Host ('MID=' + $mid.Count)
Write-Host ('BOT=' + $bot.Count)
$mid | Select-Object -First 5
'---MID END---'
$mid | Select-Object -Last 5
'---BOT START---'
$bot | Select-Object -First 3
'---TOP END---'
$top | Select-Object -Last 3