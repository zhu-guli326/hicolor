const fs = require('fs');
const path = 'd:/AI_coding/26年/hicolor0413/hicolor/src/App.tsx';
let content = fs.readFileSync(path, 'utf8');

const oldCode = `        ctx.strokeRect(bx + bigS + smallS / 2, by + bigS + smallS / 2, bigS - smallS, bigS - smallS);
      }
    }
  }
  // 斜纹：笔记本横条纹（细线）
  } else if (bgConfig.type === 'diagonal') {`;

const newCode = `        ctx.strokeRect(bx + bigS + smallS / 2, by + bigS + smallS / 2, bigS - smallS, bigS - smallS);
      }
    }
  }
  // 格子：心形emoji图案
  } else if (bgConfig.type === 'grid') {
    const heartSize = Math.max(8, bgConfig.stripeSize * 3);
    ctx.fillStyle = bgConfig.color1;
    ctx.fillRect(0, 0, w, h);
    ctx.font = \`\${heartSize}px sans-serif\`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const cols = Math.ceil(w / heartSize) + 1;
    const rows = Math.ceil(h / heartSize) + 1;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const xPos = col * heartSize + heartSize / 2;
        const yPos = row * heartSize + heartSize / 2;
        ctx.fillText(col % 2 === 0 ? '❤️' : '💕', xPos, yPos);
      }
    }
  }
  // 斜纹：笔记本横条纹（细线）
  } else if (bgConfig.type === 'diagonal') {`;

if (content.includes(oldCode)) {
  content = content.replace(oldCode, newCode);
  fs.writeFileSync(path, content, 'utf8');
  console.log('Replacement successful!');
} else {
  console.log('Pattern not found');
}
