import { procedure, createServer, durableProcedure, createDurableServer, cors, InferApiTypes, stream, queueProcedure } from 'flarepc';
import { string, object, optional, array } from 'valibot';
import { DurableObject } from 'cloudflare:workers';
import { type } from 'arktype';
import { z } from 'zod';

import Groq from 'groq-sdk';

declare module 'flarepc' {
	interface Register {
		Env: {
			Queue: Queue;
		};
		Router: AppRouter;
		Locals: {
			groq: Groq;
		};
		Participant: {
			id: string;
			name: string;
		};
		Queues: {
			Queue: typeof Queue;
		};
	}
}

const arkSchema = type({
	name: 'string',
	platform: "'android' | 'ios'",
	'versions?': '(number | string)[]',
});

const zodSchema = z.object({
	name: z.string(),
	platform: z.enum(['android', 'ios']),
	versions: z.array(z.string()),
});

const valibotSchema = object({
	name: string(),
	platform: optional(string(), 'android'),
	versions: optional(array(string()), ['1', '2', '3']),
});
versions: z.optional(z.array(z.string()));
interface Env {
	TestDurable: DurableObject;
	GROQ_API_KEY: string;
}

const router = {
	text: procedure((event) => {
		//
	})
		.input(z.string())
		.handle(async ({ event, input }) => {
			const t = event.queue('Queue').test.send(input);
			event.queue('Queue').test.sendBatch([input]);
			return {
				hello: input,
			};
		}),
};

const routerProcedure = durableProcedure<TestDurable>();
const inProcedure = durableProcedure<TestDurable, 'in'>();
const outProcedure = durableProcedure<TestDurable, 'out'>();

const topicsIn = {
	message: inProcedure((event) => {
		//
	})
		.input(object({ message: string() }))
		.handle(({ input, object, event }) => {
			console.log(input);
		}),
	paul: {
		louis: inProcedure()
			.input(object({ message: optional(string(), 'hello') }))
			.handle(({ input, object, event }) => {
				event.session.participant;
				return {
					hello: input.message,
				};
			}),
	},
};
const topicsOut = {
	message: outProcedure((event) => {
		//
	})
		.input(object({ message: optional(string(), 'hello') }))
		.handle(({ input, object }) => {
			return {
				hello: input.message,
			};
		}),
	arn: {
		aud: outProcedure(() => {
			//
		})
			.input(object({ message: optional(string(), 'hello') }))
			.handle(({ input, object, event }) => {
				return {
					hello: input.message,
				};
			}),
	},
};

const durableRouter = {
	validators: {
		ark: routerProcedure((event) => {
			//
		})
			.input(arkSchema)
			.handle(({ input, object, event }) => {
				console.log(object.ctx.storage);
				return {
					hello: input.name,
				};
			}),
		zod: routerProcedure()
			.input(zodSchema)
			.handle(({ input, object, event }) => {
				return {
					hello: input.name,
				};
			}),
		valibot: routerProcedure()
			.input(valibotSchema)
			.handle(({ input, object, event }) => {
				return {
					hello: input.name,
				};
			}),
	},
	ai: routerProcedure()
		.input(z.string())
		.handle(async ({ input, event }) => {
			const groq = new Groq({
				apiKey: '',
			});
			const completion = await groq.chat.completions.create({
				model: 'llama3-70b-8192',
				max_tokens: 4,
				messages: [
					{ role: 'system', content: 'You are a helpful assistant.' },
					{ role: 'user', content: input },
				],
				stream: true,
			});
			return await stream<Groq.Chat.ChatCompletionChunk>(completion.toReadableStream(), {
				onChunk: ({ chunk, first }) => {
					console.log('AI chunk received', chunk.choices[0].delta.content, first);
				},
				onEnd: (chunks) => {
					console.log('AI stream ended', chunks);
				},
				onStart: () => {
					console.log('AI stream started');
				},
			});
		}),
	test: {
		test: {
			test: routerProcedure()
				.input(object({ name: string() }))
				.handle(async ({ input, object, event }) => {
					const file = await event.static.get('test.png', 'arrayBuffer');
					const fileText = await event.static.get('package.json', 'json');

					return {
						hello: input.name,
						file,
						fileText,
					};
				}),
		},
	},
};
export class TestDurable extends createDurableServer({}) {
	topicsOut = topicsOut;
	topicsIn = topicsIn;
	router = durableRouter;
}

const Queue = {
	test: queueProcedure()
		.input(string())
		.handle(async ({ input, event }) => {
			console.log(event.batch);
		}),
};

export type AppRouter = typeof router;

const server = createServer({
	cors: cors(),
	objects: {
		TestDurable: TestDurable,
	},
	router,
	locals: (request, env) => {
		return {
			prod: true,
			groq: {} as Groq,
		};
	},
	queues: {
		Queue,
	},
});

export type Server = typeof server.infer;
export type API = InferApiTypes<Server>;
export default server;
