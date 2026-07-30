$f = 'js\apps\setting\world\library.js'
$lines = Get-Content -LiteralPath $f
$start = 1610
$end = 1995
$kept = $lines[0..($start-2)] + $lines[$end..($lines.Length-1)]
Set-Content -LiteralPath $f -Value $kept -Encoding UTF8
Write-Host ("removed lines {0}-{1}, new size {2}" -f $start, $end, $kept.Length)