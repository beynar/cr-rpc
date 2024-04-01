import { build } from 'tsup';

build({
	entry: ['./api.ts'],
	outDir: './/api/',
	dts: true,
});
