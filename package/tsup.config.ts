import { defineConfig } from 'tsup';

export default defineConfig({
	entry: ['src/lib/index.ts', 'src/lib/client.ts', 'src/lib/types.ts'],
	splitting: false,
	skipNodeModulesBundle: false,
	dts: true,
	bundle: true,
	minifyIdentifiers: true,
	minifySyntax: true,
	minifyWhitespace: true,
	platform: 'browser',
	external: ['cloudflare:workers', '__STATIC_CONTENT_MANIFEST'],
	keepNames: false,
	minify: false,
	sourcemap: true,
	format: ['cjs', 'esm'],
	treeshake: true,
	clean: true,
});
