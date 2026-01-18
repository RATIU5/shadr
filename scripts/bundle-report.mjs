import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const packagesDir = path.join(rootDir, "packages");

const formatBytes = (bytes) => {
	if (bytes < 1024) {
		return `${bytes} B`;
	}

	const kb = bytes / 1024;
	if (kb < 1024) {
		return `${kb.toFixed(1)} KB`;
	}

	const mb = kb / 1024;
	return `${mb.toFixed(2)} MB`;
};

const listFiles = (dir) => {
	const entries = fs.readdirSync(dir, { withFileTypes: true });
	const files = [];

	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...listFiles(fullPath));
			continue;
		}
		files.push(fullPath);
	}

	return files;
};

const safeStat = (filePath) => {
	try {
		return fs.statSync(filePath);
	} catch {
		return null;
	}
};

const report = [];

if (!fs.existsSync(packagesDir)) {
	console.error("No packages directory found.");
	process.exit(1);
}

const packageNames = fs
	.readdirSync(packagesDir, { withFileTypes: true })
	.filter((entry) => entry.isDirectory())
	.map((entry) => entry.name)
	.sort();

for (const packageName of packageNames) {
	const packageRoot = path.join(packagesDir, packageName);
	const distDir = path.join(packageRoot, "dist");
	let files = [];

	if (fs.existsSync(distDir)) {
		files = listFiles(distDir);
	}

	if (packageName === "app-web" && files.length === 0) {
		const fallbackFiles = [
			path.join(packageRoot, "index.html"),
			path.join(packageRoot, "app.js"),
		];

		for (const filePath of fallbackFiles) {
			if (fs.existsSync(filePath)) {
				files.push(filePath);
			}
		}
	}

	if (files.length === 0) {
		continue;
	}

	const fileStats = files
		.map((filePath) => {
			const stat = safeStat(filePath);
			if (!stat) {
				return null;
			}

			return {
				path: filePath,
				size: stat.size,
			};
		})
		.filter(Boolean);

	const total = fileStats.reduce((sum, file) => sum + file.size, 0);
	const topFiles = [...fileStats].sort((a, b) => b.size - a.size).slice(0, 5);

	report.push({
		packageName,
		total,
		count: fileStats.length,
		topFiles,
	});
}

if (report.length === 0) {
	console.log("No build outputs found. Run `pnpm build` first.");
	process.exit(0);
}

report.sort((a, b) => b.total - a.total);
const grandTotal = report.reduce((sum, item) => sum + item.total, 0);

console.log("Bundle size report");
console.log(`Total: ${formatBytes(grandTotal)} across ${report.length} packages`);

for (const item of report) {
	console.log(
		`\n${item.packageName}: ${formatBytes(item.total)} (${item.count} files)`
	);

	for (const file of item.topFiles) {
		const relativePath = path.relative(rootDir, file.path);
		console.log(`  ${formatBytes(file.size)}  ${relativePath}`);
	}
}
