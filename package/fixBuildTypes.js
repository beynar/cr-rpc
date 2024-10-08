const fs = require('node:fs');

const files = fs.readdirSync('./dist').concat(fs.readdirSync('./dist/yjs').map((file) => `yjs/${file}`));

const typesFiles = files.filter((file) => file.includes('.d.ts') || file.includes('.mts'));
typesFiles.forEach((file) => {
	let string = fs.readFileSync(`./dist/${file}`, 'utf-8');
	console.log(file);
	string = string.replace("input, infer } from 'zod';", "input as zInput, infer as zInfer } from 'zod';");
	string = string.replace('infer<S>', 'zInfer<S>');
	string = string.replace('input<S>', 'zInput<S>');
	string = string.replaceAll('import {', 'import type {');
	string = string.replaceAll('Queue<unknown>', 'Queue');

	[
		"import '@cloudflare/workers-types';",
		"import 'valibot';",
		"import 'zod';",
		"import 'arktype';",
		"import 'cookie';",
		"import 'yjs';",
		"import 'cloudflare:workers';",
		"import 'lib0/encoding';",
		"import 'y-protocols/awareness';",
		"import 'lib0/observable';",
	].forEach((line) => {
		string = string.replace(line, '');
	});

	fs.rmSync(`./dist/${file}`);

	fs.writeFileSync(`./dist/${file}`, string);
});
