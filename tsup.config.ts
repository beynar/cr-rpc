import { defineConfig } from 'tsup';

export default defineConfig({
	entry: ['src/lib/index.ts', 'src/lib/client.ts'],
	splitting: false,
	skipNodeModulesBundle: true,
	dts: true,
	bundle: true,
	minifyIdentifiers: true,
	minifySyntax: true,
	minifyWhitespace: true,
	platform: 'neutral',
	target: 'es2022',
	minify: true,
	sourcemap: true,
	format: 'cjs',
	treeshake: false,

	clean: true,
});
