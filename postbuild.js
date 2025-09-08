
const fs = require('fs');
const path = require('path');

// Source directories
const distDir = path.join(__dirname, 'dist');
const popupHtmlSrc = path.join(distDir, 'popup.html');
const assetsSrc = path.join(distDir, 'assets');

// Destination directories
const electronDir = path.join(__dirname, 'electron');
const popupHtmlDest = path.join(electronDir, 'popup.html');
const assetsDest = path.join(electronDir, 'assets');

// Copy popup.html
fs.copyFileSync(popupHtmlSrc, popupHtmlDest);
console.log('✅ Copied popup.html to electron/');

// Ensure electron/assets exists
if (!fs.existsSync(assetsDest)) {
  fs.mkdirSync(assetsDest, { recursive: true });
}

// Copy assets folder
fs.readdirSync(assetsSrc).forEach(file => {
  fs.copyFileSync(
    path.join(assetsSrc, file),
    path.join(assetsDest, file)
  );
});
console.log('✅ Copied assets to electron/assets/');
