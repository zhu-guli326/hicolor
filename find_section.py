path = r"d:\AI_coding\26年\0405 hicolor\src\App.tsx"

with open(path, 'r', encoding='utf-8', errors='replace') as f:
    content = f.read()

# Find the start marker
marker1 = "    // 1. Render Main Image with Holes"
marker2 = "    // 2. Render Background Block"

idx1 = content.find(marker1)
idx2 = content.find(marker2)

print(f"Found '// 1. Render Main Image with Holes' at index {idx1}")
print(f"Found '// 2. Render Background Block' at index {idx2}")

if idx1 == -1 or idx2 == -1:
    print("ERROR: Could not find markers")
    exit(1)

# Find the beginning of line containing idx1
line_start1 = content.rfind('\n', 0, idx1) + 1
# Find the beginning of line containing idx2
line_start2 = content.rfind('\n', 0, idx2) + 1

print(f"Section starts at line char offset {line_start1}")
print(f"'// 2. Render Background Block' line starts at {line_start2}")
print(f"First char of old section: {repr(content[line_start1:line_start1+60])}")
print(f"Old section end: {repr(content[line_start2:line_start2+80])}")
