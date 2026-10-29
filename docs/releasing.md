# Releasing

Each release is a version tag, such as `v0.19.1`, on a commit of `master`, plus a GitHub release with the notes from `CHANGELOG.md`. The moving `v0` tag points at the latest 0.x release, which is what `gabrielolvv/prism-review@v0` resolves to.

## Prepare the Release

1. Rename `## Unreleased` in `CHANGELOG.md` to `## X.Y.Z - YYYY-MM-DD`.
2. Run `npm version X.Y.Z --no-git-tag-version`, then `npm run bundle`, so `package.json`, `package-lock.json`, and `dist/` carry the new version. `prism-review --version` prints the version built into the bundle.
3. Update the pinned version in the README's pre-commit example (`rev: vX.Y.Z`) and its GitLab CI job, and in `examples/gitlab/.gitlab-ci.yml` (`@gabrielolvv/prism-review@X.Y.Z`); a test fails until they match `package.json`.
4. Run `npm run typecheck`, `npm test`, and `npm run test:action`.
5. Commit as `chore: release X.Y.Z` and merge the pull request into `master`.

## Tag It

```bash
git fetch origin master
git tag -a vX.Y.Z <release-commit> -m "vX.Y.Z"
git push origin vX.Y.Z
git tag -fa v0 <release-commit> -m "v0"
git push -f origin v0
```

Pushing the version tag starts the [Release workflow](../.github/workflows/release.yml). It checks that the tag matches the version in `package.json`, takes the tag's section from `CHANGELOG.md` with `node scripts/release-notes.mjs vX.Y.Z`, and creates the GitHub release, marked as the latest. Moving `v0` does not create a release.

## npm

The CLI is published to npm as [`@gabrielolvv/prism-review`](https://www.npmjs.com/package/@gabrielolvv/prism-review), so `npx @gabrielolvv/prism-review init` and `analyze` work without a clone. The package holds only the bundled CLI, `dist/cli/main.cjs`, which has no dependencies to install.

### The First Publish

npm can only trust a workflow for a package that exists, so the first version is published by hand, from an up-to-date `master` checkout:

```bash
npm login
npm ci --ignore-scripts
npm run bundle
git diff --exit-code -- dist
npm publish --access public
```

The `@gabrielolvv` scope must be your npm username or an npm organization you belong to. If it is not, change `name` in `package.json`, and the `npx` commands in the README, to a scope you own.

### Later Versions

1. On npmjs.com, open the package's **Settings**, and under **Trusted Publisher** choose GitHub Actions, with the owner `gabrielolvv`, the repository `prism-review`, and the workflow `release.yml`.
2. In the repository's **Settings > Secrets and variables > Actions > Variables**, add the variable `NPM_PUBLISH` with the value `true`.

From then on, pushing a version tag also publishes that version to npm, after the GitHub release, with [provenance](https://docs.npmjs.com/generating-provenance-statements) that links it to the workflow run. No npm token is stored in the repository. Without the variable, the npm job is skipped.

## Releases for Older Tags

GitHub starts no workflow run for a tag whose commit does not contain the Release workflow, or when more than three tags are pushed at once. To create the release for such a tag, open **Actions > Release > Run workflow** and enter the tag, or, with the GitHub CLI, from an up-to-date `master` checkout:

```bash
gh release create v0.18.0 --verify-tag --title v0.18.0 --latest=false \
  --notes "$(node scripts/release-notes.mjs v0.18.0)"
```

Create older releases with `--latest=false`, so the newest release stays marked as the latest.

## GitHub Marketplace

The listing shows the README, the `name`, `description`, and `branding` from `action.yml` (the `shield` icon on `purple`), the license, and the security policy in `SECURITY.md`.

### Before the First Listing

1. The repository is public, and `action.yml` is the only action metadata file, at the root.
2. The name in `action.yml`, `Prism Review`, is not already used by a Marketplace action, a GitHub user or organization, or a Marketplace category. Search the Marketplace for it; if it is taken, choose another name in `action.yml` and the README.
3. Your account has two-factor authentication turned on.
4. In **Settings > General**, the repository has a description, such as "Reviews pull requests for risk signals before human review", and topics such as `github-actions`, `code-review`, `security`, `supply-chain`, and `pull-requests`.
5. In **Settings > Code security**, **Private vulnerability reporting** is turned on, so the link in `SECURITY.md` works.

### Listing a Release

1. Push the version tag as above. The Release workflow creates the release.
2. Open the release, choose **Edit**, and select **Publish this Action to the GitHub Marketplace**. The first time, GitHub asks you to accept the Marketplace Developer Agreement.
3. Choose a primary category, such as **Security**, and a second one, such as **Code quality**, and select **Update release**. The form checks the requirements and names any that are not met.
4. Move `v0` to the release commit, so `@v0` users get the listed version.

A release the workflow creates is not listed on its own. Publish each release you want on the Marketplace from its edit page; the listing shows the latest one published there. GitHub's guide on [publishing actions in GitHub Marketplace](https://docs.github.com/en/actions/how-tos/create-and-publish-actions/publish-in-github-marketplace) has the current requirements.
