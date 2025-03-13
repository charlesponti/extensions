import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
	plugins: [
		react(),
		viteStaticCopy({
			targets: [
				{
					src: "public/manifest.json",
					dest: ".",
					transform: (contents) => {
						const manifest = JSON.parse(contents.toString());
						manifest.background.service_worker = "background.js";
						manifest.content_scripts[0].js = ["content.js"];
						manifest.action.default_popup = "index.html";
						return JSON.stringify(manifest, null, 2);
					},
				},
				{
					src: "public/icons",
					dest: ".",
				},
			],
		}),
	],
	build: {
		outDir: "build",
		rollupOptions: {
			input: {
				main: "./index.html", // Corrected popup HTML path
				content: "./src/content.ts", // Corrected content script path
				background: "./src/background.ts", // Correct background script path
				popup: "./src/popup.tsx", // Add popup script as input
			},
			output: {
				entryFileNames: (chunkInfo) => {
					return chunkInfo.name === "popup"
						? "assets/[name]-[hash].js"
						: "[name].js";
				},
				chunkFileNames: "assets/[name]-[hash].js",
			},
		},
	},
});
