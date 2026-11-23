---
phase: 261123-cqx-branch-protection-and-auto-deployment-to
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .github/workflows/ci.yml
autonomous: true
requirements:
  - QUICK-DEPL
user_setup:
  - service: cloudflare
    why: "Automated GitHub Actions CI deployment to Cloudflare Pages"
    env_vars:
      - name: CLOUDFLARE_API_TOKEN
        source: "Cloudflare Dashboard -> My Profile -> API Tokens -> Create Custom Token (Account: Cloudflare Pages:Edit)"

estimate:
  tokens: 25000
  raw_tokens: 25000
  tasks: 3
  confidence: high

must_haves:
  truths:
    - "Production Cloudflare Pages site https://dithr.pages.dev/studio/ serves the latest built assets and returns HTTP 200"
    - "Branch protection on main enforces PR reviews with stale review dismissal for non-admins while allowing repository owner/admin direct push"
    - "GitHub Actions CI automatically deploys web/dist to Cloudflare Pages upon push to main when python-suite and web-studio checks pass"
  artifacts:
    - ".github/workflows/ci.yml"
  key_links:
    - from: ".github/workflows/ci.yml"
      to: "web/dist"
      via: "cloudflare/wrangler-action@v3 pages deploy"
---

<objective>
Deploy the current studio build to Cloudflare Pages, configure GitHub branch protection to guarantee only the repository owner (admin) can push directly to main while others require reviewed pull requests, and automate continuous deployment to Cloudflare Pages in GitHub Actions CI upon successful test runs.

Purpose: Protect the main branch against unauthorized direct modifications, ensure zero-downtime deployment of the Web Studio, and eliminate manual deployment overhead while preserving owner development velocity.
Output: Live production deployment on Cloudflare Pages, GitHub branch protection enforcement, repository secrets configuration, and updated `.github/workflows/ci.yml` with an automated deployment job.
</objective>

<execution_context>
@~/.gemini/antigravity/gsd-core/workflows/execute-plan.md
@~/.gemini/antigravity/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@.github/workflows/ci.yml
@wrangler.toml
@web/package.json
</context>

<tasks>

<task type="tracer">
  <name>Task 1: End-to-end current build deployment and production verification</name>
  <files>web/dist/index.html, web/dist/studio/index.html</files>
  <action>
    Build the frontend assets and deploy the current production state directly to Cloudflare Pages using the authenticated local Wrangler CLI.
    1. Run `npm --prefix web run build` to compile TypeScript and generate production distribution files in `web/dist` (including `web/dist/studio/index.html` and SPA redirect rules).
    2. Deploy `web/dist` to the Cloudflare Pages project `dithr` using local wrangler credentials:
       `npx wrangler pages deploy web/dist --project-name=dithr --commit-dirty=true`
    3. Verify that `https://dithr.pages.dev/studio/` returns HTTP 200 and serves the expected HTML bundle.
  </action>
  <verify>
    <automated>curl.exe -s -o NUL -w "%{http_code}" https://dithr.pages.dev/studio/ | findstr "200"</automated>
  </verify>
  <done>Production Cloudflare Pages site https://dithr.pages.dev/studio/ is successfully deployed and returns HTTP 200.</done>
</task>

<task type="auto">
  <name>Task 2: Configure main branch protection for owner direct push and contributor PR reviews</name>
  <files>.github/workflows/ci.yml</files>
  <action>
    Update GitHub repository branch protection on `main` for `Sujoy-004/dithr` using the GitHub CLI (`gh api`).
    Configure:
    1. `required_status_checks`: strict: true, contexts:
       - "Web Studio (Node 20)"
       - "Python (ubuntu-latest - py3.10)"
       - "Python (ubuntu-latest - py3.13)"
       - "Python (windows-latest - py3.10)"
       - "Python (windows-latest - py3.13)"
    2. `enforce_admins`: false (this permits repository administrators/owners to push directly to `main` without requiring a pull request review).
    3. `required_pull_request_reviews`:
       - `dismiss_stale_reviews`: true
       - `require_code_owner_reviews`: false
       - `required_approving_review_count`: 1
    4. `restrictions`: null
    5. `allow_force_pushes`: false, `allow_deletions`: false

    Execute the update via `gh api --method PUT repos/Sujoy-004/dithr/branches/main/protection --input ...` ensuring JSON syntax is valid.
  </action>
  <verify>
    <automated>gh api repos/Sujoy-004/dithr/branches/main/protection --jq "{enforce_admins: .enforce_admins.enabled, pr_reviews: (.required_pull_request_reviews != null)}"</automated>
  </verify>
  <done>Branch protection on main enforces PR reviews with stale review dismissal for non-admins while enforce_admins remains false to allow direct admin pushes.</done>
</task>

<task type="auto">
  <name>Task 3: Automate Cloudflare Pages deployment in CI and set repository secrets</name>
  <files>.github/workflows/ci.yml</files>
  <action>
    Configure repository secrets and add the automated Cloudflare Pages deployment job to GitHub Actions CI.
    1. Set the repository secret `CLOUDFLARE_ACCOUNT_ID` to `9ddcbcb23d2620cdf58e864f25166922` using:
       `gh secret set CLOUDFLARE_ACCOUNT_ID --body "9ddcbcb23d2620cdf58e864f25166922"`
    2. If `CLOUDFLARE_API_TOKEN` is available in environment or provided by the user, set it via:
       `gh secret set CLOUDFLARE_API_TOKEN --body "$CLOUDFLARE_API_TOKEN"`
       (If not yet created, document instructions in summary: Cloudflare Dashboard -> My Profile -> API Tokens -> Create Custom Token with Account: Cloudflare Pages:Edit permissions).
    3. Edit `.github/workflows/ci.yml` to append the `deploy` job:
       - `name: Deploy to Cloudflare Pages`
       - `runs-on: ubuntu-latest`
       - `needs: [python-suite, web-studio]` (ensures deployment only runs when all Python and Web tests succeed)
       - `if: github.ref == 'refs/heads/main' && github.event_name == 'push'` (triggers on direct author pushes and merged pull requests to main)
       - Steps:
         - Checkout code (`actions/checkout@v4`)
         - Set up Node 20 (`actions/setup-node@v4` with npm cache for `web/package-lock.json`)
         - Install dependencies (`npm ci` in `web/`)
         - Build Web Studio (`npm run build` in `web/`)
         - Deploy to Cloudflare Pages (`cloudflare/wrangler-action@v3` with `apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}`, `accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}`, `command: pages deploy dist --project-name=dithr --commit-dirty=true`, `workingDirectory: web`)
  </action>
  <verify>
    <automated>gh secret list | findstr "CLOUDFLARE_ACCOUNT_ID"</automated>
  </verify>
  <done>GitHub Actions CI contains the gated deploy job dependent on python-suite and web-studio, and CLOUDFLARE_ACCOUNT_ID secret is set in repository.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| External Contributor → GitHub Repository | Non-admin pull request vs. admin direct push boundary |
| GitHub Actions Runner → Cloudflare Pages API | Deployment secret credentials (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`) |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261123-cqx-01 | Elevation of Privilege | GitHub Branch Protection (`main`) | high | mitigate | Configure `required_pull_request_reviews` with `dismiss_stale_reviews: true` while keeping `enforce_admins: false`, ensuring non-admins cannot bypass review while the author/admin can push directly. |
| T-261123-cqx-02 | Information Disclosure | GitHub Actions CI (`.github/workflows/ci.yml`) | high | mitigate | Store Cloudflare authentication credentials in encrypted GitHub repository secrets (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`) instead of plaintext config. |
| T-261123-cqx-03 | Tampering | GitHub Actions CI Deployment Job | medium | mitigate | Gate `deploy` job with `needs: [python-suite, web-studio]` and conditional `github.ref == 'refs/heads/main' && github.event_name == 'push'`, preventing deployment of broken code or unauthorized branches. |
| T-261123-cqx-SC | Tampering | GitHub Actions / npm installs | high | mitigate | Pin GitHub Actions to major version tags (`cloudflare/wrangler-action@v3`, `actions/checkout@v4`, `actions/setup-node@v4`) and rely on package-lock.json with `npm ci`. |
</threat_model>

<verification>
1. Run `curl.exe -s -o NUL -w "%{http_code}" https://dithr.pages.dev/studio/` to verify HTTP 200 from live Cloudflare Pages.
2. Run `gh api repos/Sujoy-004/dithr/branches/main/protection` to confirm `required_pull_request_reviews` is enabled and `enforce_admins` is false.
3. Check `gh secret list` to verify `CLOUDFLARE_ACCOUNT_ID` is stored.
4. Verify `.github/workflows/ci.yml` is valid YAML and includes `needs: [python-suite, web-studio]` on the deploy job.
</verification>

<success_criteria>
Current build is live on Cloudflare Pages (returning HTTP 200), branch protection on main requires pull requests and reviews for all non-admins while allowing the owner to push directly, and CI is configured to deploy automatically whenever code reaches main and passes all tests.
</success_criteria>

<output>
Create `.planning/quick/261123-cqx-branch-protection-and-auto-deployment-to/261123-cqx-PLAN.md` when done
</output>
