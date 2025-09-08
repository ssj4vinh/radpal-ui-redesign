# 🧠 RadPal Git Commands Reference

## 🔂 Primary Workflow (Top 5 Commands)

| **Command** | **Purpose** | **Example** |
|-------------|-------------|-------------|
| `git add .` | Stage all changes (new + modified files) | `git add .` |
| `git commit -m "message"` | Commit staged changes | `git commit -m "Refactor popup layout and add refinement text box"` |
| `git push` | Push your commits to GitHub | `git push` |
| `git pull` | Pull the latest changes from GitHub | `git pull` |
| `cd ~/projects/radpal && git pull origin main` | Pull if you're not already in the project folder | `cd ~/projects/radpal && git pull origin main` |



# bump version to 1.0.1 and push tag
npm version patch
git push
git push --tags

# build 1.0.1
npm run dist

# publish the new release + assets
gh release create v1.0.1 --notes "Small update" `
  "dist\RadPal Setup 1.0.1.exe" `
  "dist\latest.yml"


robocopy "\\wsl$\Ubuntu\home\ssj4vinh\projects\radpal" C:\dev\radpal /E /XD node_modules dist Montreal-Forced-Aligner test_radpal_env radpal.egg-info __pycache__ .git .venv /XF *.exe .npmrc .env
npm run build
npm run electron



robocopy \\wsl$\Ubuntu\home\ssj4vinh\projects\radpal C:\Users\ssj4v\Desktop\radpal /E /XD node_modules dist Montreal-Forced-Aligner test_radpal_env radpal.egg-info __pycache__ .git .venv /XF *.exe
npm run build
npm run electron


npm install
npm run dist
---
Check the radpal-voice-dictation-report-generation-agent.md file for context about this
   app's architecture"



## 🔧 Additional Useful Git Commands

| **Command** | **Purpose** | **Example** |
|-------------|-------------|-------------|
| `git status` | Check for uncommitted or unstaged changes | `git status` |
| `git add <file>` | Stage a specific file only | `git add src/Popup.tsx` |
| `git log --oneline` | View recent commit history | `git log --oneline` |
| `git clone <repo>` | Clone your repo onto a new machine | `git clone https://github.com/ssj4vinh/radpal.git` |
| `git remote -v` | Show current GitHub link | `git remote -v` |
| `git branch` | Show your current branch | `git branch` |
| `git checkout -b <branch>` | Create and switch to a new branch | `git checkout -b feature/new-ui` |
| `git switch <branch>` | Switch between existing branches | `git switch main` |
| `git rm -r --cached <path>` | Untrack files (like `node_modules`) | `git rm -r --cached node_modules/` |
| `git push --force` | Force push (after rewriting history) | `git push --force` |
| `git remote set-url origin <url>` | Change GitHub link for the project | `git remote set-url origin https://github.com/...` |



You need to activate the
  virtual environment we created. Here's how to use the MFA we built:

  # Navigate to the MFA directory
  cd /home/ssj4vinh/projects/radpal/Montreal-Forced-Aligner

  # Activate the virtual environment
  source mfa_env/bin/activate

  # Now use mfa
  mfa --version

  When you activate the virtual environment, your prompt should change to show (mfa_env) at the beginning.

  Alternatively, if you want to use MFA from anywhere without activating the environment each time, you can create
   an alias:

  # Add this to your ~/.bashrc
  alias mfa-dev='/home/ssj4vinh/projects/radpal/Montreal-Forced-Aligner/mfa_env/bin/mfa'

  # Then reload bashrc
  source ~/.bashrc

  # Use it
  mfa-dev --version

  Or if you prefer to replace the pipx version with our development version:

  # Remove pipx version
  pipx uninstall montreal-forced-aligner

  # Create a symlink to our development version
  ln -s /home/ssj4vinh/projects/radpal/Montreal-Forced-Aligner/mfa_env/bin/mfa ~/.local/bin/mfa

  The key point is that you need to use the MFA from our virtual environment at
  /home/ssj4vinh/projects/radpal/Montreal-Forced-Aligner/mfa_env/bin/mfa, not the pipx one at
  /home/ssj4vinh/.local/bin/mfa.


In the Future: How to Push Changes & Get New .exe
✅ 1. Make your changes locally
Edit any part of your RadPal app: UI, backend logic, templates, etc.

✅ 2. Commit your changes
bash
Copy
Edit
git add .
git commit -m "✨ Your commit message here"
Example:

bash
Copy
Edit
git commit -m "✨ Add new AI cleanup module to popup logic"
✅ 3. Push to GitHub
bash
Copy
Edit
git push
This will trigger the GitHub Actions workflow again (since it watches the main branch).

💾 Download the New .exe
Once the GitHub workflow completes:

Go to: https://github.com/ssj4vinh/radpal-installer/actions

Click the latest run (should say "Build Windows Installer")

Scroll to Artifacts → click radpal-installer to download your new .exe

🧠 Bonus: Want Versioned Installers?
If you want each .exe to correspond to a version (like RadPal-v1.1.0.exe), I can help you:

Read from package.json version

Name the artifact accordingly

Trigger builds only when pushing tags like v1.1.0



  Complete tear of the ACL. Small radial tear along the posterior horn segment of the medial meniscus. Large joint effusion. Reciprocal bone contusions along the posterior aspect of the medial tibial plateau and medial femoral condyle. Small Baker's cyst. Full thickness cartilage fissure along the central femoral trochlea. 


  add words to dictionary
  nano /home/ssj4vinh/Documents/MFA/pretrained_models/dictionary/english_us_arpa.dict
  tenosynovitis  T IY N OW S IH N OW V AY T IH S
Ctrl + O → Enter → Ctrl + X to save and exit