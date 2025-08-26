const { execSync } = require("child_process");

const env = process.env.NODE_ENV || "development";

if (env === "production") {
  console.log("Production environment detected — installing connect-mongo in backend...");
  try {
    execSync("npm install connect-mongo@5 --prefix backend", { stdio: "inherit" });
    console.log("connect-mongo installed.");
  } catch (err) {
    console.error("Failed to install connect-mongo:", err);
    process.exit(1);
  }
} else {
  console.log(`NODE_ENV=${env} — skipping connect-mongo install (only needed in production).`);
}
