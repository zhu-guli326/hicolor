path = r"d:\AI_coding\26年\0405 hicolor\src\App.tsx"

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Verify markers exist
idx1 = content.find("    // 1. Render Main Image with Holes")
idx2 = content.find("    // 2. Render Background Block")

if idx1 == -1 or idx2 == -1:
    print(f"ERROR: markers not found. idx1={idx1}, idx2={idx2}")
    exit(1)

# Start of old section: beginning of the line containing "// 1. Render..."
line_start1 = content.rfind('\n', 0, idx1) + 1

# End of old section: end of the line "// 2. Render Background Block\n"
end_marker = "    // 2. Render Background Block\n"
idx2_start = idx2
end_pos = idx2_start + len(end_marker)

old_section = content[line_start1:end_pos]
print(f"Old section ({len(old_section)} chars):")
print("--- start ---")
print(old_section[:100])
print("--- end ---")
print(repr(old_section[-100:]))

print(f"\nChar immediately after old section: {repr(content[end_pos:end_pos+60])}")

new_section = """    // 1. 先画色块画布（条纹/纯色背景）
    blockCtx.clearRect(0, 0, canvasWidth, canvasHeight);
    blockCtx.fillStyle = bgConfig.color1;
    blockCtx.fillRect(0, 0, canvasWidth, canvasHeight);

    if (bgConfig.type === 'stripes') {
      blockCtx.fillStyle = bgConfig.color2;
      const isVertical = composition === 'block-left' || composition === 'block-right';
      if (isVertical) {
        for (let i = 0; i < canvasWidth; i += bgConfig.stripeSize * 2) {
          blockCtx.fillRect(i, 0, bgConfig.stripeSize, canvasHeight);
        }
      } else {
        for (let i = 0; i < canvasHeight; i += bgConfig.stripeSize * 2) {
          blockCtx.fillRect(0, i, canvasWidth, bgConfig.stripeSize);
        }
      }
    }

    // 从色块画布读取像素数据用于主图画孔洞
    const blockImageData = blockCtx.getImageData(0, 0, canvasWidth, canvasHeight);
    const blockData = blockImageData.data;

    function sampleFromBlockData(nx: number, ny: number): string {
      const px = Math.round(nx * (canvasWidth - 1));
      const py = Math.round(ny * (canvasHeight - 1));
      const idx = (py * canvasWidth + px) * 4;
      return `rgba(${blockData[idx]},${blockData[idx + 1]},${blockData[idx + 2]},${blockData[idx + 3] / 255})`;
    }

    // 2. 画主图（照片 + 填色孔洞）
    mainCtx.clearRect(0, 0, canvasWidth, canvasHeight);
    mainCtx.save();
    mainCtx.drawImage(image, 0, 0, imgWidth, imgHeight);

    cutouts.forEach((c) => {
      const currentSize = (cutoutConfig.baseSize + c.sizeFactor * cutoutConfig.variation * 10) * (canvasWidth / 800);
      const sym = symmetricNormOnBlock(c.x, c.y, composition);
      const holeColor = sampleFromBlockData(sym.nx, sym.ny);
      mainCtx.save();
      mainCtx.translate(c.x * imgWidth, c.y * imgHeight);
      mainCtx.rotate(c.angle);
      fillCutoutShapeAtOrigin(
        mainCtx,
        c,
        currentSize,
        holeColor,
        cutoutConfig.customShapeSymbol
      );
      mainCtx.restore();
    });

    mainCtx.restore();

    // 3. 色块画布画形状孔洞（透照片）
"""

new_content = content[:line_start1] + new_section + content[end_pos:]

# Verify the transition looks correct
transition_pos = line_start1 + len(new_section)
print(f"\nTransition check (end of new section):")
print(repr(new_content[transition_pos-60:transition_pos+60]))

with open(path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print("\nFile written successfully!")
