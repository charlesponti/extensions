import { defineConfig } from "vite";
import { resolve } from "path";
import fs from 'fs';
import react from '@vitejs/plugin-react';

export default defineConfig({
	resolve: {
		alias: {
			'@': resolve(__dirname, './src'),
		},
	},
	build: {
		rollupOptions: {
			input: {
				main: resolve(__dirname, "index.html"),
				content: resolve(__dirname, "src/content.ts"),
				background: resolve(__dirname, "src/background.ts"),
				popup: resolve(__dirname, "src/popup.tsx"),
			},
			output: {
				entryFileNames: (chunkInfo) => {
					// Use hashed filenames for all entry files
					if (chunkInfo.name === "content" || 
					    chunkInfo.name === "background" || 
					    chunkInfo.name === "popup") {
						return `${chunkInfo.name}-[hash].js`;
					}
					return "assets/[name]-[hash].js";
				},
				chunkFileNames: "assets/[name]-[hash].js",
				assetFileNames: "assets/[name]-[hash].[ext]",
			},
		},
		outDir: "dist",
		emptyOutDir: true,
		manifest: true,
	},
	plugins: [
		react(),
		{
			name: 'update-html-and-manifest',
			closeBundle: () => {
				// Fix the paths in the generated HTML file
				const htmlPath = resolve(__dirname, 'dist/index.html');
				let html = fs.readFileSync(htmlPath, 'utf-8');
				
				// Replace absolute paths with relative paths
				html = html.replace(/src="\//g, 'src="./');
				html = html.replace(/href="\//g, 'href="./');
				
				fs.writeFileSync(htmlPath, html);
				
				// Read the manifest file from source
				const manifestSrc = resolve(__dirname, 'manifest.json');
				let manifestJson = JSON.parse(fs.readFileSync(manifestSrc, 'utf-8'));
				
				// Find the hashed filenames from the build output
				const distDir = resolve(__dirname, 'dist');
				const files = fs.readdirSync(distDir);
				
				// Find content script file
				const contentFile = files.find(file => file.startsWith('content-') && file.endsWith('.js'));
				const backgroundFile = files.find(file => file.startsWith('background-') && file.endsWith('.js'));
				
				if (!contentFile || !backgroundFile) {
					console.error('Could not find hashed content or background files in build output');
					return;
				}
				
				// Update manifest.json with the hashed filenames
				manifestJson.content_scripts[0].js = [contentFile];
				manifestJson.background.service_worker = backgroundFile;
				
				// Write the updated manifest.json to dist
				const manifestDest = resolve(__dirname, 'dist/manifest.json');
				fs.writeFileSync(manifestDest, JSON.stringify(manifestJson, null, 2));
				
				// Create icons directory if it doesn't exist
				const iconsDir = resolve(__dirname, 'dist/icons');
				if (!fs.existsSync(iconsDir)) {
					fs.mkdirSync(iconsDir, { recursive: true });
				}
				
				// Create placeholder icons if they don't exist
				const sizes = [16, 48, 128];
				sizes.forEach(size => {
					const iconPath = resolve(__dirname, `dist/icons/icon${size}.png`);
					if (!fs.existsSync(iconPath)) {
						const placeholderIcon = resolve(__dirname, 'public/vite.svg');
						if (fs.existsSync(placeholderIcon)) {
							fs.copyFileSync(placeholderIcon, iconPath);
						}
					}
				});
				
				console.log(`Updated manifest.json with hashed filenames:
  - Content script: ${contentFile}
  - Background script: ${backgroundFile}`);
			}
		}
	]
});