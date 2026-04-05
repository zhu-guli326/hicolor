import re

path = r"d:\AI_coding\26年\0405 hicolor\src\App.tsx"

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Check line endings
crlf_count = content.count('\r\n')
lf_count = content.count('\n') - crlf_count
print(f"CRLF lines: {crlf_count}, LF-only: {lf_count}")

# Show exact bytes around line 943
lines = content.split('\n')
for i in range(942, 950):
    line = lines[i]
    print(f"Line {i+1} (len={len(line)}): {repr(line[:80])}")

# Check if there's trailing whitespace on key lines
print(f"\nLine 944: {repr(lines[943])}")
print(f"Line 945: {repr(lines[944])}")
print(f"Line 946: {repr(lines[945])}")
print(f"Line 947: {repr(lines[946])}")
