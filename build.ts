import { build } from 'estrella';
build({
	entry: 'src/lib/',
	outfile: 'out/index.js',
	bundle: false,

	// pass any options to esbuild here...
});
