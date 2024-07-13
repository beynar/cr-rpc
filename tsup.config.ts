import { defineConfig } from 'tsup';

export default defineConfig({
	entry: ['src/lib/index.ts', 'src/lib/client.ts', 'src/lib/cors.ts'],
	splitting: false,
	skipNodeModulesBundle: false,
	dts: true,
	bundle: true,
	minifyIdentifiers: true,
	minifySyntax: true,
	minifyWhitespace: true,
	platform: 'browser',
	keepNames: false,
	minify: true,
	sourcemap: true,
	format: ['cjs', 'esm'],
	treeshake: true,
	clean: true,
});
