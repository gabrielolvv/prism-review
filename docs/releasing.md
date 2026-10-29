# Releasing

Each release is a version tag, such as `v0.19.1`, on a commit of `master`, plus a GitHub release with the notes from `CHANGELOG.md`. The moving `v0` tag points at the latest 0.x release, which is what `gabrielolvv/prism-review@v0` resolves to.

## Prepare the Release

1. Rename `## Unreleased` in `CHANGELOG.md` to `## X.Y.Z - YYYY-MM-DD`.
2. Run `npm version X.Y.Z --no-git-tag-version`, then `npm run bundle`, so `package.json`, `package-lock.json`, and `dist/` carry the new version.
3. Run `npm run typecheck`, `npm test`, and `npm run test:action`.
4. Commit as `chore: release X.Y.Z` and merge the pull request into `master`.

## Tag It

```bash
git fetch origin master
git tag -a vX.Y.Z <release-commit> -m "vX.Y.Z"
git push origin vX.Y.Z
git tag -fa v0 <release-commit> -m "v0"
git push -f origin v0
```

Pushing the version tag starts the [Release workflow](../.github/workflows/release.yml). It checks that the tag matches the version in `package.json`, takes the tag's section from `CHANGELOG.md` with `node scripts/release-notes.mjs vX.Y.Z`, and creates the GitHub release, marked as the latest. Moving `v0` does not create a release.

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
