# GitHub Pages Deployment

The `Tests` workflow now includes an automated deployment job that publishes the static viewer.
Whenever a pull request is merged into the `main` branch (triggering a `push` to `main`), the
pipeline will:

1. Rebuild the viewer dataset from the SBLGNT source text so the JSON payload in
   `viewer/data/mark.json` stays in sync with the repository state.
2. Package the entire `viewer/` directory as the GitHub Pages artifact.
3. Deploy the artifact via the official `actions/deploy-pages` action, making the site available
   through the `github-pages` environment.

The deployment job only runs after the tests succeed on `main`; pull requests and other branches do
not trigger a deploy.

## Enabling GitHub Pages in the Repository Settings

To allow the workflow to publish the site, configure GitHub Pages to use GitHub Actions:

1. Navigate to the repository on GitHub and open **Settings**.
2. In the sidebar, select **Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.
4. Save the settings. GitHub will remember that deployments come from the workflow’s `github-pages`
   environment.
5. After the first successful run on `main`, visit the deployment listed under the repository’s
   **Environments** page or the link in the workflow summary to reach the published viewer.

With these settings in place, every merge to `main` automatically rebuilds and publishes the site.
