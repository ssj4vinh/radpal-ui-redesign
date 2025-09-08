# Running RadPal with Latest Logic Editor Changes

## Steps to see the enhanced Logic Editor:

1. **Build the app:**
```bash
cd /home/ssj4vinh/projects/radpal
npm run build
```

2. **Run Electron:**
```bash
npm run electron
```

3. **Open the Logic Editor:**
- Log in to the app
- Click on the Logic Editor button/menu
- You should now see the enhanced features

## New Features in Logic Editor:

### Custom Instructions (Enhanced)
- **Individual Items**: Each instruction is displayed as a separate, numbered item
- **Edit Button**: Click "Edit" next to any instruction to modify it in-place
- **Delete Button**: Remove individual instructions
- **Clear Presentation**: No more run-on sentences in a single textbox

### Section Management
- **+ Add Section**: Create new logic sections
- **Delete Section**: Remove sections with confirmation
- **Auto exclude_by_default**: Impression sections automatically get this field

### Rule Management  
- **+ Add Rule**: Add new rules within any section
- **Delete**: Remove individual rules with confirmation

### Visual Improvements
- Numbered badges for custom instructions
- Color-coded sections and actions
- Keyboard shortcuts (Ctrl+Enter to save, Esc to cancel)

## Troubleshooting:

If you don't see the changes:

1. **Clear cache and rebuild:**
```bash
rm -rf dist/
npm run build
```

2. **Check for errors:**
```bash
npm run build 2>&1 | grep -i error
```

3. **Ensure you're using the LogicEditorEnhanced component:**
The app should be using `LogicEditorEnhanced.tsx` not the old `LogicEditor.tsx`

4. **Check browser console:**
Press F12 in Electron to open DevTools and check for any JavaScript errors

## Alternative: Run in Development Mode

If production build has issues, try development mode:

```bash
# Terminal 1 - Start Vite dev server
npm run dev

# Terminal 2 - Start Electron (after Vite is running)
npm run electron
```

The dev server will show the URL it's running on (usually http://localhost:5173).