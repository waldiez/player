import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import YAML from "yaml";

const MANIFEST_PATH = resolve(process.cwd(), "MANIFEST");
const EXPECTED_SCHEMA = "https://xperiens.waldiez.io/schema/v1/manifest";
const REQUIRED_SECTIONS = ["identity", "description", "interface"] as const;
const CAPABILITY_PATTERN = /^[a-z][a-z0-9-]*(\.[a-z0-9-]+)+\.v[0-9]+$/;
const PROJECT_NAMESPACE = "waldiez.player.";

function fail(message: string): never {
    console.error(`manifest compatibility failed: ${message}`);
    process.exit(1);
}

async function run() {
    const text = await readFile(MANIFEST_PATH, "utf-8");
    const parsed = YAML.parse(text) as Record<string, unknown> | null;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        fail("MANIFEST must be a YAML object");
    }

    if (parsed.$schema !== EXPECTED_SCHEMA) {
        fail(`$schema must be '${EXPECTED_SCHEMA}'`);
    }

    for (const section of REQUIRED_SECTIONS) {
        if (!(section in parsed) || typeof parsed[section] !== "object" || parsed[section] === null) {
            fail(`missing required section '${section}'`);
        }
    }

    const iface = parsed.interface as Record<string, unknown>;
    const capabilities = iface.capabilities;
    const capabilityIds = iface.capability_ids;

    if (!Array.isArray(capabilities) || capabilities.length === 0) {
        fail("interface.capabilities must be a non-empty array");
    }

    const seen = new Set<string>();
    for (const item of capabilities) {
        if (typeof item !== "string") {
            fail("all interface.capabilities entries must be strings");
        }
        if (!item.startsWith(PROJECT_NAMESPACE)) {
            fail(
                `capability '${item}' must start with '${PROJECT_NAMESPACE}' for project-scoped compatibility`,
            );
        }
        if (!CAPABILITY_PATTERN.test(item)) {
            fail(
                `capability '${item}' must use namespaced versioned format like 'waldiez.player.feature.name.v1'`,
            );
        }
        if (seen.has(item)) {
            fail(`duplicate capability '${item}'`);
        }
        seen.add(item);
    }

    if (capabilityIds !== undefined) {
        if (typeof capabilityIds !== "object" || capabilityIds === null || Array.isArray(capabilityIds)) {
            fail("interface.capability_ids must be an object when provided");
        }

        const entries = Object.entries(capabilityIds as Record<string, unknown>);
        for (const [capability, wid] of entries) {
            if (!seen.has(capability)) {
                fail(`capability_ids key '${capability}' must also exist in interface.capabilities`);
            }
            if (typeof wid !== "string" || !wid.startsWith("wdz://")) {
                fail(`capability_ids value for '${capability}' must be a wdz:// URI`);
            }
        }
    }

    console.log("manifest compatibility passed");
}

run().catch(error => {
    const message = error instanceof Error ? error.message : String(error);
    fail(message);
});
