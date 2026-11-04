# Connecting Plot Twist to Your Preexisting GitHub Repository

This plan details how to push the complete Plot Twist codebase into your existing empty GitHub repository without leaking secrets, and how to maintain future updates cleanly.

## Method A: In AI Studio UI (Fastest & Simplest)

1. **Open AI Studio Settings / Export Menu**:
   - In the top right corner of the AI Studio Build workspace, locate the **Export** or **GitHub** icon (or click the three dots `...` / Settings menu).
   - Select **Export to GitHub** or **Push to GitHub Repository**.
2. **Authorize AI Studio with GitHub**:
   - If prompted, authorize the Google AI Studio OAuth application to access your GitHub repositories.
3. **Select Your Preexisting Repository**:
   - In the repository dropdown or search field, select your existing GitHub repository name (e.g., `username/plot-twist`).
   - Leave branch set to `main`.
4. **Click "Push" or "Export"**:
   - AI Studio will commit and push all project files, documentation (`docs/PLOT_TWIST_SPEC.md`, `docs/PROJECT_STATUS.md`), and configuration into your repository.

---

## Method B: Command-Line Git Push (Local Terminal)

If you have downloaded or cloned the project locally, follow these 4 simple commands in your terminal:

```bash
# 1. Initialize git if not already initialized
git init

# 2. Add all project files
git add .

# 3. Create your initial commit
git commit -m "Initial commit: Plot Twist AI entertainment platform (Phase 1)"

# 4. Set the main branch
git branch -M main

# 5. Link your preexisting remote GitHub repository (replace with your repo URL)
git remote add origin https://github.com/<YOUR-USERNAME>/<YOUR-REPO-NAME>.git

# 6. Push code to GitHub
git push -u origin main
```

---

## Safety & Security Verifications

Before pushing, the following automated safeguards are already in place:
1. **No Hardcoded Secrets**: Gemini API keys are read server-side via `process.env.GEMINI_API_KEY`.
2. **Ignored Sensitive Files**: `.gitignore` ensures local `.env` files and build outputs are not committed.
3. **Documentation Included**: `docs/PLOT_TWIST_SPEC.md` and `docs/PROJECT_STATUS.md` are included so your full project history and architecture remain preserved on GitHub.

## Next Steps
Once you review this plan, click **Proceed** and I will prepare a complete `README.md` and update `.gitignore` with production-ready instructions tailored for your repository.
