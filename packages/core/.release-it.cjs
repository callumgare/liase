module.exports = {
  git: {
    requireBranch: ["main"],
    tagName: "v${version}"
  },
  npm: {
    publish: false,
  },
};
