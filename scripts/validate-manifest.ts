import Ajv from "ajv";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import YAML from "yaml";

const MANIFEST_PATH = resolve(process.cwd(), "MANIFEST");
const SCHEMA_PATH = resolve(process.cwd(), "schemas/waldiez-manifest.schema.json");

async function run() {
    const [manifestText, schemaText] = await Promise.all([
        readFile(MANIFEST_PATH, "utf-8"),
        readFile(SCHEMA_PATH, "utf-8"),
    ]);

    const manifest = YAML.parse(manifestText) as unknown;
    const schema = JSON.parse(schemaText) as Record<string, unknown>;
    // Ajv (draft-07 default) can still validate this schema since we use common keywords.
    // Drop the draft ref to avoid requiring bundled 2020-12 meta-schema support.
    delete schema.$schema;

    const ajv = new Ajv({ allErrors: true });
    const validate = ajv.compile(schema);
    const valid = validate(manifest);

    if (!valid) {
        console.error("manifest validation failed:");
        for (const err of validate.errors ?? []) {
            const anyErr = err as { instancePath?: string; dataPath?: string; message?: string };
            const path = anyErr.instancePath || anyErr.dataPath || "/";
            const message = anyErr.message ?? "invalid";
            console.error(`- ${path}: ${message}`);
        }
        process.exit(1);
    }

    console.log("manifest validation passed");
}

run().catch(error => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`manifest validation failed: ${message}`);
    process.exit(1);
});
