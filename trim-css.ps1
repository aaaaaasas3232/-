# 删除 settings.css 中的废弃选择器
$f = 'css\settings.css'
$lines = Get-Content -LiteralPath $f
# 找到所有起始行 + 段长
$targets = @(
    # ★ v0.14 拼接维度（含临近的 inject 相关）— 整段删除
    @{ start = 3223; end = 3296 },
    # ★ v0.12 社媒 · 世界视角 — 删除到下一段前
    @{ start = 3298; end = 3327 },
    # 社媒账号（renderSocialAccounts 用）— 删除整段
    @{ start = 3807; end = 4004 },
    # App 绑定 — 删除整段
    @{ start = 4922; end = 4950 },
    # 社交上下文 + injection — 删除
    @{ start = 5577; end = 5592 }
)
# 按行号从大到小删（否则索引会乱）
$targets = $targets | Sort-Object -Property start -Descending
foreach ($t in $targets) {
    $start = $t.start
    $end = $t.end
    Write-Host ("removing lines {0}-{1}" -f $start, $end)
    $lines = $lines[0..($start-2)] + $lines[$end..($lines.Length-1)]
}
Set-Content -LiteralPath $f -Value $lines -Encoding UTF8
Write-Host ("done, new size {0}" -f $lines.Length)