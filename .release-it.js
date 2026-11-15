/**
 * Releases commit the version bump and CHANGELOG.md to main, push the
 * X.Y.Z tag, publish to npm (OIDC), and open a GitHub Release. The git
 * push uses the singleton-release GitHub App (ruleset bypass). Do not
 * use GITHUB_TOKEN or a PAT for that push.
 *
 * Validate, test, build, and sync run in the prepare job before any App
 * token exists. The publish job mints the token last and pushes with
 * git extraheader (never a token in the origin URL). Local tags use
 * annotation `v${version}`. npm publish uses --ignore-scripts so
 * lifecycle hooks do not run with that token set.
 *
 * @typedef {import('release-it').Config} ReleaseItConfig
 * @type {ReleaseItConfig}
 */
export default {
  git: {
    commitMessage: "chore(release): v${version} [skip ci]",
    tagName: "${version}",
    tagAnnotation: "v${version}",
    requireBranch: "main",
    requireCleanWorkingDir: true,
    commit: true,
    push: true,
    tag: true,
    commitArgs: ["--no-verify"],
    pushArgs: ["--follow-tags", "--atomic", "--no-verify"],
  },
  npm: {
    publish: true,
    skipChecks: true, // required for OIDC — npm whoami fails without a static token
    publishArgs: ["--ignore-scripts"],
  },
  github: {
    release: true,
    releaseName: "v${version}",
    /**
     * @param {{ changelog?: string, version: string, name: string }} ctx
     */
    releaseNotes({ changelog, version, name }) {
      const notes = (changelog ?? "").trim();
      const npmUrl = `https://www.npmjs.com/package/${name}/v/${version}`;
      return `${notes}\n\n📦 [\`${name}@${version}\`](${npmUrl})\n`;
    },
  },
  plugins: {
    "@release-it/conventional-changelog": {
      infile: "CHANGELOG.md",
      preset: {
        name: "conventionalcommits",
        compareUrlFormat:
          "{{host}}/{{owner}}/{{repository}}/compare/{{previousTag}}...{{currentTag}}",
      },
    },
  },
};
