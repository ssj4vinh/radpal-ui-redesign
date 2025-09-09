# RadPal Development Workflow Context

## Project Structure
- **Main Private Repo**: https://github.com/ssj4vinh/radpalapp.git (private, contains sensitive code)
- **UI-Only Public Repo**: https://github.com/ssj4vinh/radpal-ui-redesign.git (public, for freelancer)
- **Primary Development Branch**: `wsl-development` (full app with backend)
- **UI-Only Branch**: `ui-freelancer` (no sensitive files)

## Branch Overview

### wsl-development (Primary)
- Full application with all backend code
- Contains sensitive files: agent/, supabase/, .env files
- This is where main development happens

### ui-freelancer
- UI-only version for freelancer redesign work
- Removed: agent/, supabase/, .env files
- Added mock files in src/mocks/ to replace backend functionality
- Pushed to separate public repo for freelancer access

### main
- Original main branch (has sensitive info)
- Not actively used, wsl-development is primary

## Mock Files Created for UI-Only Version

Located in `src/mocks/`:
- `agent.ts` - Mock generateReport and generateImpression functions
- `defaultAgentLogic.ts` - Mock createDefaultAgentLogic function
- `modelMapping.ts` - Mock mapRadPalModelToAgent function
- `prompts/askAISystemPrompt.ts` - Mock AI system prompt
- `prompts/editLogicSystemPrompt.ts` - Mock edit logic prompt

Located in `electron/`:
- `mock-main.js` - Mock Electron main process
- `mock-preload.js` - Mock IPC bridge with all API endpoints

## Git Remotes Configuration

```bash
# Original private repository
origin: https://github.com/ssj4vinh/radpalapp.git

# UI-only public repository for freelancer
ui-repo: https://github.com/ssj4vinh/radpal-ui-redesign.git
```

## Essential Workflow Commands

### Daily Development (Full App)
```bash
git checkout wsl-development
git pull origin wsl-development
# ... work on code ...
git add .
git commit -m "message"
git push origin wsl-development
```

### Switch to UI-Only Version
```bash
git checkout ui-freelancer
git pull origin ui-freelancer
npm run ui-test  # Uses mock backend
```

### Get Freelancer Updates
```bash
git fetch ui-repo main:freelancer-updates
git checkout freelancer-updates
npm install
npm run ui-test
# Review changes
git diff ui-freelancer
```

### Merge Freelancer Changes to Development
```bash
git checkout wsl-development
git merge freelancer-updates --no-commit
# Resolve conflicts
git commit -m "Merge UI updates from freelancer"
git push origin wsl-development
```

### Push Updates to UI Repo (if needed)
```bash
git checkout ui-freelancer
# ... make changes ...
git push origin ui-freelancer
git push ui-repo ui-freelancer:main
```

## NPM Scripts for UI Development

- `npm run ui-dev` - Start Vite dev server with hot reload
- `npm run ui-build` - Build the React app
- `npm run electron-ui` - Launch Electron with mock backend
- `npm run ui-test` - Build + Launch (full UI test)

## Important Files Modified for UI-Only

These files had their imports updated to use mocks instead of agent/:
- `src/App.tsx` - Uses mock modelMapping
- `src/components/AskAI.tsx` - Uses mock askAISystemPrompt
- `src/components/LogicEditorChat.tsx` - Uses mock editLogicSystemPrompt
- `src/components/TemplateManager.tsx` - Uses mock defaultAgentLogic
- `src/hooks/useAgentReport.ts` - Uses mock agent functions
- `src/lib/chat/sendChat.ts` - Uses mock askAISystemPrompt

## Freelancer Instructions Sent

Repository: https://github.com/ssj4vinh/radpal-ui-redesign

Quick Start:
1. Clone: `git clone https://github.com/ssj4vinh/radpal-ui-redesign.git`
2. Install: `npm install`
3. Run: `npm run ui-test`

Key files:
- `UI_README.md` - Complete redesign guide
- `src/` - React components to restyle
- `electron/mock-*.js` - Mock backend (DO NOT MODIFY)

## Notes for Future Sessions

1. **Primary branch is `wsl-development`**, not main
2. All sensitive backend code is in `agent/` and `supabase/` directories
3. Mock files in `src/mocks/` must be maintained for UI-only branch
4. The ui-freelancer branch should NEVER have sensitive files
5. Always test the UI-only build with `npm run ui-test` before pushing to ui-repo
6. The freelancer only has access to the public ui-repo, not the private main repo

## Current State (as of last session)
- ✅ UI-only branch created and cleaned
- ✅ Mock files created for all agent imports
- ✅ Separate public repo created for freelancer
- ✅ Instructions sent to freelancer
- ✅ Currently on `wsl-development` branch for full development

Last commit to ui-freelancer: "Fix missing agent imports for UI-only build"
Last push to ui-repo: ui-freelancer branch pushed as both main and ui-freelancer