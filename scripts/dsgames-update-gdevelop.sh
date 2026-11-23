#!/usr/bin/env bash
# DSGAMES fork: proposes the latest GDevelop release as a pull request.
#
# Run every week on the DSGAMES server by a systemd user timer (see
# scripts/systemd/). It works in a clone of its own ($DSGAMES_UPDATE_DIR) and
# never changes dsgames-fork itself:
#   1. finds GDevelop's latest release, and stops if this fork already has
#      it, if it was already proposed, or if its libGD.js isn't built yet;
#   2. merges it into a new branch, update/gdevelop-<version>, dropping
#      GDevelop's own GitHub workflows (only ours run in this repository);
#   3. if GDevelop changed the same lines as us, pushes nothing and opens an
#      issue listing the files to resolve by hand;
#   4. otherwise pins libGD.js to that release, pushes the branch and opens a
#      pull request, where .github/workflows/test-engine.yml tests it.
#
# Needs git, curl and gh, logged in to an account that can push to the
# repository with the "workflow" scope (GDevelop's history changes
# .github/workflows).
set -euo pipefail

REPOSITORY=2minutos-hardware/dsgames-gdevelop
BASE_BRANCH=dsgames-fork
UPSTREAM_REPOSITORY=4ian/GDevelop
OUR_WORKFLOWS=(test-engine.yml)
WORK_DIR=${DSGAMES_UPDATE_DIR:-$HOME/dsgames-gdevelop-update}
LIBGD_URL=https://s3.amazonaws.com/gdevelop-gdevelop.js/master/commit
PIN_FILE=newIDE/app/scripts/import-libGD.js
GIT=(git -c user.name=2minutos-hardware
  -c user.email=2minutos-hardware@users.noreply.github.com)

log() { echo "[dsgames-update-gdevelop] $*"; }

# A full clone (~1.3 GB): in a partial one, merging downloads the missing
# files one by one and takes hours.
if [ ! -d "$WORK_DIR/.git" ]; then
  log "Cloning $REPOSITORY into $WORK_DIR"
  git clone --quiet --branch "$BASE_BRANCH" \
    "https://github.com/$REPOSITORY.git" "$WORK_DIR"
fi
cd "$WORK_DIR"
if [ -n "$(git status --porcelain)" ] || [ -e .git/MERGE_HEAD ]; then
  log "❌ $WORK_DIR has local changes, leaving it alone."
  exit 1
fi

git fetch --quiet origin "$BASE_BRANCH"
git checkout --quiet --force -B "$BASE_BRANCH" "origin/$BASE_BRANCH"

version=$(gh api "repos/$UPSTREAM_REPOSITORY/releases/latest" --jq .tag_name)
branch="update/gdevelop-$version"
issue_title="GDevelop $version: the update has conflicts to resolve"
git fetch --quiet --no-tags "https://github.com/$UPSTREAM_REPOSITORY.git" \
  "+refs/tags/$version:refs/tags/$version"
release_commit=$(git rev-parse "$version^{commit}")

if git merge-base --is-ancestor "$release_commit" "$BASE_BRANCH"; then
  log "Already on GDevelop $version or later."
  exit 0
fi
if git ls-remote --exit-code --heads origin "$branch" >/dev/null; then
  log "$branch was already pushed, see its pull request."
  exit 0
fi
if [ -n "$(gh issue list --repo "$REPOSITORY" --state open \
  --search "\"$issue_title\" in:title" --json number --jq '.[].number')" ]; then
  log "An issue is already open for GDevelop $version."
  exit 0
fi
for file in libGD.js libGD.wasm; do
  if ! curl --silent --fail --head --output /dev/null \
    "$LIBGD_URL/$release_commit/$file"; then
    log "GDevelop hasn't built $file for $version yet, trying again next time."
    exit 0
  fi
done

# From here on, leave the clone as it was if anything goes wrong.
cleanup() {
  git merge --abort 2>/dev/null || true
  git checkout --quiet --force "$BASE_BRANCH"
  git branch --quiet -D "$branch" 2>/dev/null || true
}
trap 'cleanup; log "❌ Failed, nothing was pushed."' ERR
trap 'cleanup; log "❌ Stopped, nothing was pushed."; exit 1' INT TERM

log "Merging GDevelop $version ($release_commit) into $branch"
git checkout --quiet -b "$branch"
"${GIT[@]}" merge --quiet --no-ff --no-commit "$release_commit" || true

# Drop GDevelop's workflows, whether the merge adds them or they conflict
# with our deletion of them.
for workflow in $(git ls-files -- .github/workflows | sort -u); do
  if [[ " ${OUR_WORKFLOWS[*]} " != *" $(basename "$workflow") "* ]]; then
    git rm --quiet --force -- "$workflow"
  fi
done

conflicts=$(git diff --name-only --diff-filter=U)
if [ -n "$conflicts" ]; then
  cleanup
  trap - ERR INT TERM
  log "Conflicts, opening an issue:"$'\n'"$conflicts"
  gh issue create --repo "$REPOSITORY" --title "$issue_title" --body "\
[GDevelop $version](https://github.com/$UPSTREAM_REPOSITORY/releases/tag/$version) \
can't be merged automatically: GDevelop changed the same lines as this fork in:

$(sed 's/.*/- `&`/' <<<"$conflicts")

To resolve it:

\`\`\`sh
git fetch https://github.com/$UPSTREAM_REPOSITORY.git refs/tags/$version:refs/tags/$version
git switch -c $branch origin/$BASE_BRANCH
git merge $version
\`\`\`

- Keep our changes (they are explained in \"DSGAMES\" comments), and adapt them to GDevelop's new code.
- Delete GDevelop's workflows from \`.github/workflows\` (only \`${OUR_WORKFLOWS[*]}\` runs here).
- Pin libGD.js to \`$release_commit\` in \`$PIN_FILE\` (\`DSGAMES_PINNED_UPSTREAM_COMMIT\`).
- Push the branch and open a pull request: the tests run there. Then close this issue.

*Opened by \`scripts/dsgames-update-gdevelop.sh\`.*"
  exit 0
fi

perl -0pi -e \
  "s/(DSGAMES_PINNED_UPSTREAM_COMMIT =\\s*')[0-9a-f]{40}'/\${1}$release_commit'/" \
  "$PIN_FILE"
grep -q "'$release_commit'" "$PIN_FILE"
git add -- "$PIN_FILE"
"${GIT[@]}" commit --quiet \
  -m "Merge GDevelop $version into $BASE_BRANCH" \
  -m "libGD.js/wasm pinned to $version ($release_commit)."
git push --quiet --set-upstream origin "$branch"
trap - ERR INT TERM

gh pr create --repo "$REPOSITORY" --base "$BASE_BRANCH" --head "$branch" \
  --title "Update GDevelop to $version" --body "\
Merges [GDevelop $version](https://github.com/$UPSTREAM_REPOSITORY/releases/tag/$version) \
into \`$BASE_BRANCH\`, with libGD.js pinned to \`$release_commit\`. \
GDevelop's own workflows were dropped.

Before merging:

- [ ] The tests of this pull request pass (GDevelop's, ours in \`newIDE/app/src/DSGAMES\` and \`Extensions/DSGAMES/tests\`, and the analytics check of the built editor).
- [ ] The editor from the \`dsgames-editor\` artifact works: open a project, preview it, publish it to DSGAMES.

Deploying stays manual, after the merge.

*Opened by \`scripts/dsgames-update-gdevelop.sh\`.*"
git checkout --quiet "$BASE_BRANCH"
log "✅ Pull request opened for GDevelop $version."
