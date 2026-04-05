path = r"d:\AI_coding\26年\0405 hicolor\src\App.tsx"

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

lines = content.split('\n')
# Show lines 968-1000
for i in range(967, 1000):
    line = lines[i]
    print(f"Line {i+1} (len={len(line)}): {repr(line)}")
