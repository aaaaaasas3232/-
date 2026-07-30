$f = 'css\settings.css'
$lines = Get-Content -LiteralPath $f
$start = 3224
$end = 3254
$lines = $lines[0..($start-2)] + $lines[$end..($lines.Length-1)]
Set-Content -LiteralPath $f -Value $lines -Encoding UTF8
Write-Host ("removed lines {0}-{1}, new size {2}" -f $start, $end, $lines.Length)