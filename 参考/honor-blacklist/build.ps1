# 王者曝光台 - 单文件打包工具（生成单个 index.html）
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  王者曝光台 - 单文件打包工具" -ForegroundColor Cyan
Write-Host "  生成单个 index.html（含所有页面）" -ForegroundColor Gray
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$distDir = Join-Path $scriptDir "dist"

# 创建 dist 目录
if (-not (Test-Path $distDir)) {
    New-Item -ItemType Directory -Path $distDir | Out-Null
}

# 读取源文件
Write-Host "[1/6] 读取源文件..." -ForegroundColor Yellow

$htmlFiles = @{
    "index.html"        = Join-Path $scriptDir "index.html"
    "submit.html"       = Join-Path $scriptDir "submit.html"
    "admin.html"        = Join-Path $scriptDir "admin.html"
    "admin-login.html"  = Join-Path $scriptDir "admin-login.html"
}

$htmlContents = @{}
foreach ($key in $htmlFiles.Keys) {
    if (Test-Path $htmlFiles[$key]) {
        $htmlContents[$key] = Get-Content $htmlFiles[$key] -Raw -Encoding UTF8
        Write-Host "  [OK] $key" -ForegroundColor Green
    } else {
        Write-Host "  [SKIP] $key (不存在)" -ForegroundColor Gray
    }
}

# 读取 CSS 和 JS
$cssContent = Get-Content (Join-Path $scriptDir "styles.css") -Raw -Encoding UTF8
$jsContent  = Get-Content (Join-Path $scriptDir "common.js") -Raw -Encoding UTF8

Write-Host ""
Write-Host "[2/6] 生成单页应用 index.html..." -ForegroundColor Yellow

# 取 index.html 作为基础模板
$baseHtml = $htmlContents["index.html"]

# 将样式和脚本内嵌
$baseHtml = $baseHtml -replace '<link rel="stylesheet" href="styles.css">', "<style>`n$cssContent`n</style>"
$baseHtml = $baseHtml -replace '<script src="common\.js"></script>', "<script>`n$jsContent`n</script>"

# 提取各页面的 <main> 内容
function Extract-MainContent($html) {
    if ($html -match '(?s)<!-- page-content -->.*?<main class="page">(.*?)</main>.*?<!-- /page-content -->') {
        return $Matches[1]
    }
    if ($html -match '(?s)<main class="page">(.*?)</main>') {
        return $Matches[1]
    }
    return ""
}

# 提取各页面特有元素（弹窗、表单等，放在 main 之外的）
function Extract-PageElements($html) {
    $elements = @()

    # submit.html 特有的弹窗
    if ($html -match '(?s)(<!-- 用户登录状态.*?</div>\s*</div>\s*</div>\s*</div>)') {
        $elements += $Matches[1]
    }

    # admin-login.html 特有元素
    if ($html -match '(?s)(<!-- 用户登录状态.*?)$') {
        # 已经包含了
    }

    return $elements -join "`n"
}

$submitMain  = Extract-MainContent ($htmlContents["submit.html"])
$adminMain   = Extract-MainContent ($htmlContents["admin.html"])
$loginMain   = Extract-MainContent ($htmlContents["admin-login.html"])

# 构建 PAGE_DATA JS 对象
$pageDataJS = @"
window.PAGE_DATA = {
  'submit.html': `$1` + `$(
    $submitMain -replace '`', '``' -replace '\$', '`$' -replace "['\"`n]", { if ($_ -eq "`n") { " " } elseif ($_ -eq '"') { '\"' } else { $_ } }
  ) + `$1,
  'admin.html': `$1` + `$(
    $adminMain -replace '`', '``' -replace '\$', '`$'
  ) + `$1,
  'admin-login.html': `$1` + `$(
    $loginMain -replace '`', '``' -replace '\$', '`$'
  ) + `$1,
};
"@

# 更简单的方式：直接构建 pageData 对象
$submitEsc = $submitMain -replace '`', '``' -replace '\$', '`$'
$adminEsc  = $adminMain  -replace '`', '``' -replace '\$', '`$'
$loginEsc  = $loginMain  -replace '`', '``' -replace '\$', '`$'

$pageDataJS = @"
window.PAGE_DATA = {
  'submit.html': '$submitEsc',
  'admin.html': '$adminEsc',
  'admin-login.html': '$loginEsc',
};
"@

# 插入 PAGE_DATA 到 </body> 之前
$pageDataScript = "<script>`n$pageDataJS`n</script>"
$baseHtml = $baseHtml -replace '</body>', "$pageDataScript`n</body>"

Write-Host "  [OK] index.html (含内嵌 PAGE_DATA)" -ForegroundColor Green

Write-Host ""
Write-Host "[3/6] 写入 dist/index.html..." -ForegroundColor Yellow
$baseHtml | Out-File -FilePath (Join-Path $distDir "index.html") -Encoding UTF8 -NoNewline

Write-Host "  [OK] dist/index.html" -ForegroundColor Green

Write-Host ""
Write-Host "[4/6] 生成静态资源文件..." -ForegroundColor Yellow
# 复制 CSS
Copy-Item (Join-Path $scriptDir "styles.css") (Join-Path $distDir "styles.css") -Force
Write-Host "  [OK] styles.css" -ForegroundColor Green

# 复制 JS
Copy-Item (Join-Path $scriptDir "common.js") (Join-Path $distDir "common.js") -Force
Write-Host "  [OK] common.js" -ForegroundColor Green

Write-Host ""
Write-Host "[5/6] 复制服务器文件..." -ForegroundColor Yellow
$serverDir = Join-Path $scriptDir "server"
if (Test-Path $serverDir) {
    $serverFiles = Get-ChildItem $serverDir -File | Where-Object { $_.Extension -in @('.js', '.json', '.md') }
    foreach ($f in $serverFiles) {
        $dest = Join-Path $distDir $f.Name
        Copy-Item $f.FullName $dest -Force
        Write-Host "  [OK] $($f.Name)" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "[6/6] 生成说明文件..." -ForegroundColor Yellow
$readme = @"
# 王者曝光台 - 单文件版

## 文件说明

- `index.html` - **单文件入口**，包含所有页面，双击即可在浏览器中运行
- `styles.css` - 样式文件（可选，若 index.html 已内嵌则无需部署）
- `common.js` - 脚本文件（可选，若 index.html 已内嵌则无需部署）
- `server/` - 后端服务文件（需 Node.js 环境）

## 使用方式

### 方式一：直接打开（本地模式）
双击 `index.html` 在浏览器中打开，使用本地 localStorage 存储数据。

### 方式二：后端模式（需要 Node.js）
1. 安装依赖：`npm install`
2. 启动服务：`node server/server.js`
3. 访问 `http://localhost:3000`

### 方式三：打包后部署
将 `index.html`、`styles.css`、`common.js` 上传到服务器即可。
"@
$readme | Out-File -FilePath (Join-Path $distDir "README.md") -Encoding UTF8

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  打包完成！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "生成的文件位于: $distDir" -ForegroundColor Cyan
Write-Host ""
Write-Host "  dist\index.html  - 单文件版（含所有页面）" -ForegroundColor White
Write-Host "  dist\styles.css  - 样式文件" -ForegroundColor White
Write-Host "  dist\common.js   - 脚本文件" -ForegroundColor White
Write-Host ""
Write-Host "双击 index.html 即可在浏览器中运行！" -ForegroundColor Yellow
Write-Host ""
