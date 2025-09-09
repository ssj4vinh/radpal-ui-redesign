# RadPal UI Redesign Project

This is a UI-only version of RadPal for restyling work. All backend functionality has been mocked to allow focus on visual design and styling.

## 🚀 Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Build the app:**
   ```bash
   npm run ui-build
   ```

3. **Launch the Electron app:**
   ```bash
   npm run electron-ui
   ```

   Or run both build and launch:
   ```bash
   npm run ui-test
   ```

## 📁 Project Structure

```
radpal/
├── src/                    # React components (YOUR FOCUS AREA)
│   ├── components/         # All UI components to restyle
│   ├── styles/            # Global styles and themes
│   ├── App.tsx            # Main app component
│   └── index.css          # Global CSS
├── dist/                  # Built files (auto-generated)
├── electron/              # Electron files (DO NOT MODIFY)
│   ├── mock-main.js       # Mock Electron main process
│   └── mock-preload.js    # Mock API endpoints
└── package.json           # Project dependencies
```

## 🎨 Styling Guidelines

### Current Stack
- **React 18** with TypeScript
- **Tailwind CSS** (partially implemented)
- **CSS Modules** in some components
- **Inline styles** (to be refactored)

### Your Tasks
1. **Create a design system** with consistent tokens for:
   - Colors
   - Typography
   - Spacing
   - Shadows
   - Border radii

2. **Restyle all components** to match the Figma design

3. **Ensure consistency** across all screens

4. **Maintain functionality** - don't change component logic

## 🖥️ Key Screens to Style

1. **Login Screen** (`src/components/LoginPanel.tsx`)
2. **Main Editor** (`src/App.tsx`)
3. **Report Editor** (`src/components/RichTextEditor.tsx`)
4. **Medical Terms Manager** (`src/components/MedicalTermsManager.tsx`)
5. **Report History** (`src/components/ReportHistory.tsx`)
6. **Settings Panel** (various modals)
7. **Dataset Collection Sidebar** (`src/components/DatasetCollectionPanel.tsx`)
8. **Template Manager** (`src/components/TemplateCreator.tsx`)

## 🔧 Development Commands

| Command | Description |
|---------|-------------|
| `npm run ui-dev` | Start Vite dev server (hot reload) |
| `npm run ui-build` | Build the React app |
| `npm run electron-ui` | Launch Electron with mock backend |
| `npm run ui-test` | Build + Launch (full test) |

## ⚠️ Important Notes

### DO NOT:
- ❌ Modify any logic in components
- ❌ Change API calls or data flow
- ❌ Edit files in `/electron` folder
- ❌ Alter component prop interfaces
- ❌ Remove existing functionality

### DO:
- ✅ Update all styling and CSS
- ✅ Create reusable style utilities
- ✅ Implement the Figma design precisely
- ✅ Improve responsive behavior
- ✅ Add smooth transitions/animations
- ✅ Ensure consistent theming

## 🎯 Design Specifications

- **App Window Size:** 1400x900px (desktop)
- **Popup Window Size:** 400x600px (compact mode)
- **Color Scheme:** Dark theme primary
- **Font:** System fonts (can be updated)
- **Border Radius:** Consistent across components
- **Spacing:** 4px base unit recommended

## 📝 Mock Data

All API calls return mock data, so the app appears fully functional:
- Mock user is logged in as "demo@radpal.com"
- Sample medical terms are pre-loaded
- Generated reports return placeholder text
- All save operations show success (but don't persist)

## 🐛 Troubleshooting

**App won't start:**
- Make sure you've run `npm install`
- Build the app first with `npm run ui-build`
- Check that port 5173 is free (for dev server)

**Styles not updating:**
- Clear the `/dist` folder and rebuild
- Make sure you're editing files in `/src`
- Check for CSS specificity issues

**Mock data issues:**
- All data is defined in `electron/mock-preload.js`
- Data resets on each app launch
- This is expected behavior for UI development

## 💬 Communication

- **Ask questions** if any design aspect is unclear
- **Flag issues** if component structure prevents exact design implementation  
- **Suggest improvements** if you see opportunities for better UX
- **Document changes** in your commit messages

## 🚀 Delivery

Please deliver:
1. Updated source code with all styling changes
2. Brief documentation of design tokens/system used
3. List of any third-party UI libraries added
4. Screenshots of all restyled screens
5. Any notes on implementation challenges or suggestions

---

**Remember:** This is a restyling project. The app is fully functional - your job is to make it look amazing while maintaining all existing functionality.

Good luck! 🎨