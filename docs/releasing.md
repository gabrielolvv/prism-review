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

`action.yml` has the `branding` the Marketplace needs: the `shield` icon on `purple`. To list the action:

1. Make sure the repository is public, and that the name in `action.yml`, `Prism Review`, is not already taken on the Marketplace. If it is, choose another name.
2. Open the release on GitHub, choose **Edit**, and select **Publish this Action to the GitHub Marketplace**. The first time, GitHub asks you to accept the Marketplace Developer Agreement, and your account needs two-factor authentication.
3. Pick the categories, such as **Code quality** and **Security**, and update the release. The form checks the remaining requirements and names any that are not met.

GitHub's guide on [publishing actions in GitHub Marketplace](https://docs.github.com/en/actions/how-tos/create-and-publish-actions/publish-in-github-marketplace) lists the current requirements. Once listed, each new release can be published the same way.
