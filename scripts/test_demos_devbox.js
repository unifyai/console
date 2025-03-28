const { CodeSandbox } = require("@codesandbox/sdk");
import demos from "../src/constants/logs";

async function testDemo(sandbox, demoName, demo) {
    try {
        console.log(`🧪 Testing demo: ${demoName}`);
        await sandbox.fs.writeFile("main.py", demo.code);
        const result = await sandbox.shells.run("python main.py", {
            verbose: true,
            env: { UNIFY_KEY: process.env.UNIFY_KEY }
        });

        if (result.exitCode !== 0) {
            console.log(`❌ Test failed for ${demoName}`);
            console.dir(result);
            return { success: false, name: demoName, error: result.output };
        }
        console.log(`✅ Test passed for ${demoName}`);
        return { success: true, name: demoName, error: null };
    } catch (error) {
        console.error(`❌ Failed to test demo ${demoName}:`, error);
        return { success: false, name: demoName, error };
    }
}

async function main() {
    if (!process.env.CODESANDBOX_TEMPLATE_ID) {
        console.error("❌ CODESANDBOX_TEMPLATE_ID environment variable is required");
        process.exit(1);
    }

    let sdk;
    try {
        sdk = new CodeSandbox(process.env.CODESANDBOX_API_KEY);

        // Open the specified devbox
        console.log(`🔓 Opening devbox ${process.env.CODESANDBOX_TEMPLATE_ID}`);
        const sandbox = await sdk.sandbox.open(process.env.CODESANDBOX_TEMPLATE_ID);

        // Test each demo serially
        const results = [];
        for (const demoName of Object.keys(demos)) {
            const result = await testDemo(sandbox, demoName, demos[demoName]);
            results.push({ value: result });
        }

        // Process results
        const successful = results.filter(r => r.value?.success).length;
        const failed = results.filter(r => !r.value?.success).length;

        console.log("\n📊 Testing Summary:");
        console.log(`✅ Passed: ${successful}`);
        console.log(`❌ Failed: ${failed}`);

        // Log failed demos
        const failedDemos = results
            .filter(r => !r.value?.success)
            .map(r => r.value);

        if (failedDemos.length > 0) {
            console.log("\n❌ Failed Demos:");
            failedDemos.forEach(demo => {
                console.log(`- ${demo.name}: ${demo.error}`);
            });
            process.exit(1);
        }

    } catch (error) {
        console.error("❌ Script failed:", error);
        process.exit(1);
    } finally {
        if (sdk) {
            try {
                console.log("🔒 Closing devbox");
                process.exit(0);
            } catch (error) {
                console.error("Error during cleanup:", error);
                process.exit(1);
            }
        }
    }
}

main();
