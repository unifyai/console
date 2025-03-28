const { CodeSandbox } = require("@codesandbox/sdk");

async function updateUnifyInDevbox(sandbox) {
    try {
        console.log(`📦 Updating Unify in sandbox: ${sandbox.title} (${sandbox.id})`);
        const result = await sandbox.shells.run(
            "pip install --force-reinstall git+https://github.com/unifyai/unify.git@devbox_testing",
            { verbose: true }
        );
        if (result.exitCode !== 0)
            throw new Error(`Failed to update Unify in ${sandbox.title}`);
        console.log(`✅ Successfully updated Unify in ${sandbox.title}`);
        return { success: true, sandbox: sandbox.title };
    } catch (error) {
        console.error(`❌ Failed to update Unify in ${sandbox.title}:`, error);
        return { success: false, sandbox: sandbox.title, error };
    }
}

async function main() {
    try {
        // Initialize SDK with your token
        const sdk = new CodeSandbox(process.env.CODESANDBOX_API_KEY);
        
        console.log("🔍 Fetching sandboxes...");
        const { sandboxes } = await sdk.sandbox.list();
        
        if (!sandboxes || sandboxes.length === 0) {
            console.log("⚠️ No sandboxes found");
            return;
        }

        console.log(`📋 Found ${sandboxes.length} sandboxes to update`);
        
        // Process all sandboxes concurrently
        const updatePromises = sandboxes.map(async (sandboxInfo) => {
            const sandbox = await sdk.sandbox.open(sandboxInfo.id);
            return updateUnifyInDevbox(sandbox);
        });

        // Wait for all updates to complete
        const results = await Promise.allSettled(updatePromises);

        // Summary
        const successful = results.filter(r => r.value?.success).length;
        const failed = results.filter(r => !r.value?.success).length;

        console.log("\n📊 Update Summary:");
        console.log(`✅ Successfully updated: ${successful}`);
        console.log(`❌ Failed updates: ${failed}`);
        
        // If any failures, exit with error code
        if (failed > 0) {
            process.exit(1);
        }

    } catch (error) {
        console.error("❌ Script failed:", error);
        process.exit(1);
    }
}

main();
