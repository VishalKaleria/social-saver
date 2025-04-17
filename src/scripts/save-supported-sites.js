import { exec } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Adjust paths based on current script location (resources/)
const rootDir = path.resolve(__dirname, "..", "..");
console.log(rootDir)
const ytdlpPath = path.join(rootDir, "resources", "binaries", "yt-dlp.exe");
const outputDir = path.join(rootDir, ".github", "INFO");
const outputFile = path.join(outputDir, "supported-sites.json");

// Ensure output directory exists
fs.mkdirSync(outputDir, { recursive: true });

// Run yt-dlp to get list of extractors
exec(`"${ytdlpPath}" --list-extractors`, (error, stdout, stderr) => {
  if (error) {
    console.error("❌ Failed to run yt-dlp:", error);
    return;
  }

  // Parse each non-empty line
  const extractors = stdout
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.length > 0);

  // Save to JSON
  fs.writeFileSync(outputFile, JSON.stringify(extractors, null, 2));
  console.log(`Saved ${extractors.length} supported sites to ${outputFile}`);
});
