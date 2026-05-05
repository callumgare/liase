export default {
  extends: "semantic-release-monorepo",
  branches: ["main", { name: "internal-testing-*", prerelease: true }],
  preset: "conventionalcommits",
};
