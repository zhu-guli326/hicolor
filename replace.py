import re

path = 'd:/AI_coding/26年/hicolor0413/hicolor/src/App.tsx'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# 找到需要替换的行范围
# 从 "  // 斜纹：笔记本横条纹（细线）" 之前的 } 往回找到开头
new_lines = []
skip_mode = False
skip_count = 0

i = 0
while i < len(lines):
    line = lines[i]
    
    # 检测到格子代码块的结束
    if "  // 斜纹：笔记本横条纹（细线）" in line and i > 0 and "} else if (bgConfig.type === 'diagonal')" in lines[i+1]:
        # 插入新的格子代码
        new_lines.append("  // 格子：心形emoji图案\n")
        new_lines.append("  } else if (bgConfig.type === 'grid') {\n")
        new_lines.append("    const heartSize = Math.max(8, bgConfig.stripeSize * 3);\n")
        new_lines.append("    ctx.fillStyle = bgConfig.color1;\n")
        new_lines.append("    ctx.fillRect(0, 0, w, h);\n")
        new_lines.append("    ctx.font = `${heartSize}px sans-serif`;\n")
        new_lines.append("    ctx.textAlign = 'center';\n")
        new_lines.append("    ctx.textBaseline = 'middle';\n")
        new_lines.append("    const cols = Math.ceil(w / heartSize) + 1;\n")
        new_lines.append("    const rows = Math.ceil(h / heartSize) + 1;\n")
        new_lines.append("    for (let row = 0; row < rows; row++) {\n")
        new_lines.append("      for (let col = 0; col < cols; col++) {\n")
        new_lines.append("        const xPos = col * heartSize + heartSize / 2;\n")
        new_lines.append("        const yPos = row * heartSize + heartSize / 2;\n")
        new_lines.append("        ctx.fillText(col % 2 === 0 ? '❤️' : '💕', xPos, yPos);\n")
        new_lines.append("      }\n")
        new_lines.append("    }\n")
        new_lines.append("  }\n")
        new_lines.append("\n")
        # 跳过旧的格子代码
        # 找到格子代码块的起始
        j = i - 1
        while j >= 0:
            if "} else if (bgConfig.type === 'grid')" in lines[j]:
                # 找到开头
                break
            j -= 1
        # 从开头到 i-1 是旧格子代码，跳过
        i = j
    else:
        new_lines.append(line)
    
    i += 1

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print('Done!')
