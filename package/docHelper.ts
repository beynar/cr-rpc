import Bun from 'bun';
import Groq from 'groq-sdk';

const groqClient = new Groq({
	apiKey: Bun.env.GROQ_API_KEY,
	// baseURL: 'https://api.groq.com/openai/v1',
});

import { readdir } from 'node:fs/promises';

// read all the files in the current directory
const files = await Promise.all(
	(await readdir('./src/lib')).map(async (file) => {
		const content = await Bun.file(`./src/lib/${file}`).text();
		return `'${file}\n\n${content}`;
	}),
);

const result = await groqClient.chat.completions.create({
	model: 'llama-3.1-70b-versatile',
	messages: [
		{
			role: 'system',
			content: `
        You are an excellent typescript developper, and the best at explaining code and writing documentation. Based on the source code I provide you, I want you to write an introduction to the documentation. This is the code of an open source library called "flarepc". It allows easy creation of serverless workers, durable objects and websockets server on the cloudflare network. It's very similar to TRPC expect that it's lightweight and design specifically for cloudflare workers and it includes an innovative way to create typesafe webscoket clients.

        Try to understand the code and write a brief introduction to the documentation.
        <soucecode>
        ${files.join('------------')}
        <soucecode>
        `,
		},
	],
});

Bun.write('./doc.md', result.choices[0].message.content || '');
