import { defineConfig } from 'tsup';

export default defineConfig({
	entry: ['src/lib/index.ts', 'src/lib/client.ts'],
	splitting: false,
	skipNodeModulesBundle: false,
	dts: true,
	bundle: true,
	minifyIdentifiers: true,
	minifySyntax: true,
	minifyWhitespace: true,
	platform: 'browser',
	external: ['cloudflare:workers', '__STATIC_CONTENT_MANIFEST'],
	keepNames: true,
	minify: true,
	sourcemap: true,
	format: ['cjs', 'esm'],
	treeshake: true,
	clean: true,
});
