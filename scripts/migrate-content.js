const path = require("path");
const { createContentStore } = require("../lib/content-store");

async function main() {
  const rootDirectory = path.resolve(__dirname, "..");
  const store = createContentStore({
    contentFile: path.join(rootDirectory, "data", "site-content.json"),
    defaultsFile: path.join(rootDirectory, "data", "content-defaults.json"),
  });
  const content = await store.init();
  process.stdout.write(
    `Content schema ${content.schemaVersion}, revision ${content.meta.revision}: migration complete\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`Migration failed: ${error.message}\n`);
  process.exitCode = 1;
});
