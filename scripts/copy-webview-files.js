const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, '../src/webview');
const targetDir = path.join(__dirname, '../media/webview');

function copyRecursively(src, dest) {
  // Ensure target directory exists
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyRecursively(srcPath, destPath);
    } else {
      // Copy all files (HTML, CSS, JS)
      fs.copyFileSync(srcPath, destPath);
      console.log(`Copied: ${path.relative(process.cwd(), srcPath)} -> ${path.relative(process.cwd(), destPath)}`);
    }
  }
}

console.log('Copying webview files...');
copyRecursively(sourceDir, targetDir);
console.log('✓ Webview files copied successfully to media/webview/');
