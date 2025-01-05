import fs from "node:fs/promises";
import path from "node:path";

let cachedSecretSets: Record<string, Record<string, unknown>>;

export async function getSecretsSets() {
	const defaultSecretSetsConfigPath = "./.secrets-sets.json";
	const customSecretSetsConfigPath = process.env.SECRETS_SETS_CONFIG_PATH
		? path.resolve(process.env.SECRETS_SETS_CONFIG_PATH)
		: "";

	const secretSetsConfigPath =
		customSecretSetsConfigPath ?? defaultSecretSetsConfigPath;

	if (!cachedSecretSets) {
		let configString: string;
		try {
			configString = await fs.readFile(secretSetsConfigPath, "utf8");
		} catch (error) {
			if (customSecretSetsConfigPath) {
				console.warn(
					`Secrets sets config path set to ${secretSetsConfigPath} but file not found or accessible.`,
				);
			}
			configString = "{}";
		}
		try {
			cachedSecretSets = JSON.parse(configString);
		} catch (error) {
			console.warn(
				`Secrets sets config path set to ${secretSetsConfigPath} but file is not valid JSON.`,
			);
			cachedSecretSets = {};
		}
	}
	return cachedSecretSets;
}
