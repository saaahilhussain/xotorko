# Prompts

## Entry #1: Repository setup

```text
You are setting up the repository for a hackathon project called "Xotorko". Work step by step on Windows (PowerShell). Do ONLY the setup below, then stop and report. Do not build any app features yet.

Context:
- GitHub repo (public, single branch "main"): https://github.com/<YOUR_GITHUB_USERNAME>/xotorko.git
- A verified data pack zip is at: C:\Users\hp\Downloads\xotorko-data.zip
- Google Cloud project: xotorko, region asia-south1 (Cloud Run already tested and working).
- Gemini model: gemini-4-hydrogen. The API key will come from the GEMINI_API_KEY environment variable only.

Steps:
1. Clone the repo into C:\Users\hp\xotorko (if it is not already cloned) and work inside it.
2. Create .gitignore containing:
   node_modules/
   .env
   .env.*
   !.env.example
   dist/
   build/
   coverage/
   *.log
   .DS_Store
3. Extract C:\Users\hp\Downloads\xotorko-data.zip into the repo root. Confirm these exist: data/genuine.json, data/actions.json, tests/fixtures/eval.json, docs/DATA_SOURCES.md. These files are hand-verified: NEVER modify, regenerate or overwrite them in this or any later task.
4. Create .env.example with: GEMINI_API_KEY=your-key-here  and  GEMINI_MODEL=gemini-4-hydrogen
5. Create a minimal Node 20 + Express skeleton:
   - package.json with scripts: "start": "node server.js", "test": "jest"
   - server.js: serves /public statically, GET /api/health returns {"status":"ok"}, listens on process.env.PORT || 8080
   - public/index.html: a simple accessible placeholder page (lang="en", title "Xotorko", one h1)
   - Install express (dependency) and jest + supertest (devDependencies)
   - tests/health.test.js: one supertest test that /api/health returns 200 and {"status":"ok"}
6. Create docs/DECISIONS.md with entry #1:
   "Chose PS01 (scam message detection). Direction: post-interaction triage: detect, show evidence, ask 'What have you already done?', give exact next action. Rejected: generic paste-and-verdict risk meter (what most entrants will build). Rationale: largest verifiable harm, testable deterministic core, strongest demo moment."
   Also create empty-but-titled docs/PROMPTS.md, docs/ARCHITECTURE.md, docs/EVAL.md, docs/DEMO.md and SECURITY.md. Log this setup prompt as entry #1 in docs/PROMPTS.md.
7. Run `npm test` and confirm it passes. Run the server locally and confirm http://localhost:8080/api/health works.
8. Verify no secrets anywhere in the repo, then:
   git add .
   git commit -m "chore: project skeleton, gitignore, verified data pack, docs scaffold"
   git push
9. Run `git branch -a` and confirm only main exists (local and remote). Run `git count-objects -vH` and confirm the size is far under 10 MB.
10. Print (do not run) the deploy command I will run myself:
   gcloud run deploy xotorko --source . --region asia-south1 --allow-unauthenticated --max-instances 2 --min-instances 0 --set-env-vars GEMINI_MODEL=gemini-4-hydrogen,GEMINI_API_KEY=<key>

Report: what you created, test output, branch list, repo size. Then stop and wait for my next instruction.
```
