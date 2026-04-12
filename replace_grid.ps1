$content = Get-Content "d:\AI_coding\26年\hicolor0413\hicolor\src\App.tsx" -Raw

$oldPattern = '  // 格子：横纵双向条纹交叉\r?\n  \} else if \(bgConfig\.type === .grid.\) \{.*?^\s*\}\s*\} else if \(bgConfig\.type === .diagonal.\)'

$newContent = '  // 格子：心形emoji图案
  } else if (bgConfig.type === '\''grid'\'') {
    const heartSize = Math.max(8, bgConfig.stripeSize * 3);
    ctx.fillStyle = bgConfig.color1;
    ctx.fillRect(0, 0, w, h);
    ctx.font = `${heartSize}px sans-serif`;
    ctx.textAlign = '\''center'\'';
    ctx.textBaseline = '\''middle'\'';
    const cols = Math.ceil(w / heartSize) + 1;
    const rows = Math.ceil(h / heartSize) + 1;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const xPos = col * heartSize + heartSize / 2;
        const yPos = row * heartSize + heartSize / 2;
        ctx.fillText(col % 2 === 0 ? '\''❤️'\'' : '\''💕'\'', xPos, yPos);
      }
    }
  }'

if ($content -match $oldPattern) {
    Write-Host "Found pattern, replacing..."
    $content = $content -replace $oldPattern, $newContent
    Set-Content -Path "d:\AI_coding\26年\hicolor0413\hicolor\src\App.tsx" -Value $content -NoNewline
    Write-Host "Done!"
} else {
    Write-Host "Pattern not found"
}
