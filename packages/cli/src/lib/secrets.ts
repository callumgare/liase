import fs from "node:fs/promises";

let cachedSecretSets: Record<string, Record<string, unknown>>;

export async function getSecretsSets(
	secretSetsConfigPath = "./.secrets-sets.json",
) {
	if (!cachedSecretSets) {
		cachedSecretSets = JSON.parse(
			await fs.readFile(secretSetsConfigPath, "utf8"),
		);
	}
	return cachedSecretSets;
}
