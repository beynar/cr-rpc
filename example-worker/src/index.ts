import { procedure, createServer, durableProcedure, createDurableServer, cors, InferApiTypes, stream, queueProcedure } from 'flarepc';
import { string, object, optional, array } from 'valibot';
import { DurableObject } from 'cloudflare:workers';
import { PGliteWorker } from '@electric-sql/pglite/dist/worker';

import { z } from 'zod';

import Groq from 'groq-sdk';

declare module 'flarepc' {
	interface Register {
		Env: {
			Queue: Queue;
			MY_RATE_LIMITER: RateLimit;
		};
		Tags: 'ADMIN' | 'MENTOR' | 'USER';
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

const zodSchema = z.object({
	name: z.string(),
	platform: z.enum(['android', 'ios']),
	versions: z.array(z.string()),
});

interface Env {
	TestDurable: DurableObject;
	GROQ_API_KEY: string;
}

const router = {
	text: procedure()
		.input(string())
		.handle(async ({ event, input }) => {
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
			.handle(({ input, event }) => {
				return {
					hello: input.message,
				};
			}),
	},
};

const durableRouter = {
	validators: {
		// ark: routerProcedure((event) => {
		// 	//
		// })
		// 	.input(arkSchema)
		// 	.handle(({ input, object, event }) => {
		// 		console.log(object.ctx.storage);
		// 		return {
		// 			hello: input.name,
		// 		};
		// 	}),
		zod: routerProcedure()
			.input(zodSchema)
			.handle(({ input, object, event }) => {
				return {
					hello: input.name,
				};
			}),
		valibot: routerProcedure()
			.input(string())
			.handle(({ input, object, event }) => {
				return {
					hello: input,
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
					// return await db.query("select 'Hello world' as message;");
					return {
						hello: input.name,
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
	rateLimiters: {
		MY_RATE_LIMITER: (event) => {
			return event.request.headers.get('cf-connecting-ip') || '';
		},
	},
});

export type Server = typeof server.infer;
export type API = InferApiTypes<Server>;
export default server;
