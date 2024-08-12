const fs = require('node:fs');

const files = fs.readdirSync('./dist');

const typesFiles = files.filter((file) => file.includes('.d.ts') || file.includes('.mts'));
typesFiles.forEach((file) => {
	let string = fs.readFileSync(`./dist/${file}`, 'utf-8');
	console.log(file);
	string = string.replace("infer } from 'zod';", "infer as zInfer } from 'zod';");
	string = string.replace('infer<S>', 'zInfer<S>');
	string = string.replaceAll('import {', 'import type {');
	string = string.replaceAll('Queue<unknown>', 'Queue');

	fs.rmSync(`./dist/${file}`);

	fs.writeFileSync(`./dist/${file}`, string);
});
