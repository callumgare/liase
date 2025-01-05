export default {
	branches: ["main", { name: "internal-testing-*", prerelease: true }],
	preset: "conventionalcommits",
	plugins: [
		[
			"@semantic-release/commit-analyzer",
			{
				preset: "conventionalcommits",
				releaseRules: [
					{ breaking: true, release: "major" },
					{ type: "feat", release: "minor" },
					{ revert: true, release: "patch" },
					{ type: "fix", release: "patch" },
					{ type: "perf", release: "patch" },
					{ type: "ci", release: "patch" },
					{ type: "refactor", release: "patch" },
					{ type: "chore", release: "patch" },
					{ type: "docs", scope: "help-text", release: "patch" },
					{ type: "test", release: false },
					{ scope: "no-release", release: false },
				],
			},
		],
		"@semantic-release/release-notes-generator",
		"@semantic-release/npm",
		"@semantic-release/github",
	],
};
