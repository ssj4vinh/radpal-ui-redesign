const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Read user shortcut config from localStorage export
// Replace this later with actual config pulled from your app
const stored = JSON.parse(fs.readFileSync(path.join(__dirname, 'shortcuts.json'), 'utf8'));

const enabledShortcuts = stored.filter(s => s.enabled && s.action.startsWith('autofill'));

const buildAhk = (shortcuts) => {
  return shortcuts.map(({ hotkey, text }) => `
${hotkey}::
  if WinExist("RadPal") {
    WinActivate
    WinWaitActive
    SendInput, ${text}
  }
return`).join('\n\n');
};

const ahkCode = buildAhk(enabledShortcuts);
const scriptPath = path.join(__dirname, '..', 'RadPalHotkeys.ahk');
const exePath = path.join(__dirname, '..', 'RadPalHotkeys.exe');
const ahkCompiler = path.join(__dirname, '..', 'Ahk2Exe.exe');
const binFile = path.join(__dirname, '..', 'Unicode 64-bit.bin');

fs.writeFileSync(scriptPath, ahkCode);

exec(`"${ahkCompiler}" /in "${scriptPath}" /out "${exePath}" /bin "${binFile}"`, (err) => {
  if (err) return console.error('❌ Compile error:', err);
  console.log('✅ Hotkey EXE compiled:', exePath);
});
