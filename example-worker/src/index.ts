import { procedure, createServer, createDurableServer, InferApiTypes, createServers } from 'flarepc';
import { createDurableDoc } from 'flarepc/yjs';
import { string, optional, object } from 'valibot';
import { DurableObject } from 'cloudflare:workers';

import { z } from 'zod';

import Groq from 'groq-sdk';
declare global {
	type Env = {
		TestDurable: DurableObject;
		GROQ_API_KEY: string;
		Queue: Queue;
		MY_RATE_LIMITER: RateLimit;
	};
}
// declare module 'flarepc' {
// 	interface Register {
// 		Env: Env;
// 		Tags: 'ADMIN' | 'MENTOR' | 'USER';
// 		Locals: {
// 			groq: Groq;
// 		};
// 		Participant: {
// 			id: string;
// 			name: string;
// 		};
// 		Queues: {
// 			Queue: typeof Queue;
// 		};
// 	}
// }

const zodSchema = z.object({
	name: z.string(),
	platform: z.enum(['android', 'ios']),
	versions: z.array(z.string()),
});

const router = {
	text: procedure()
		.input(string())
		.handle(async ({ event, input }) => {
			return {
				hello: input,
			};
		}),
};

// const TestDurable = createDurableDoc({});

// export { TestDurable };
export class TestDurable extends createDurableDoc() {
	out = {
		message: procedure('out')
			.input(object({ message: optional(string(), 'hello') }))
			.handle(({ input }) => {
				return {
					hello: input.message,
				};
			}),
		arn: {
			aud: procedure('out')
				.input(object({ message: optional(string(), 'hello') }))
				.handle(({ input, event }) => {
					return {
						hello: input.message,
					};
				}),
		},
	};
	in = {
		message: procedure('in')
			.input(object({ message: string() }))
			.handle(({ input, event }) => {
				console.log(input);
			}),
		paul: {
			louis: procedure('in')
				.input(object({ message: optional(string(), 'hello') }))
				.handle(({ input, event }) => {
					return {
						hello: input.message,
					};
				}),
		},
	};
	router = {
		update: procedure('durable').handle(async ({ event }) => {
			const doc = this.doc;

			doc.getText('text').insert(0, 'hello world');
			return {
				ok: true,
			};
		}),
	};
}

const Queue = {
	test: procedure('queue')
		.input(string())
		.handle(async ({ input, event }) => {
			console.log(event.batch);
		}),
};

const server = createServer({
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
	after: [(event) => {}],
	getObjectJurisdictionOrLocationHint: (event) => {
		if (event.request.cf?.isEUCountry) {
			return {
				jurisdiction: 'eu',
			};
		}
	},
	rateLimiters: {
		MY_RATE_LIMITER: (event) => {
			return event.request.headers.get('cf-connecting-ip') || '';
		},
	},
	queues: {
		Queue,
	},
});

const publicRouter = {
	public: procedure()
		.input(string())
		.handle(async ({ event }) => {
			return {
				hello: 'world',
			};
		}),
	'(public)': procedure().handle(async ({ event }) => {
		return {
			hello: 'world',
		};
	}),
};

const adminRouter = {
	admin: procedure()
		.input(string())
		.handle(async ({ event }) => {
			return {
				hello: 'world',
			};
		}),
};

const servers = createServers({
	public: {
		router: publicRouter,
		getObjectJurisdictionOrLocationHint: (event) => {
			if (event.request.cf?.isEUCountry) {
				return {
					jurisdiction: 'eu',
				};
			} else {
				return {};
			}
		},
		objects: {
			TestDurable: TestDurable,
		},
		queues: {
			Queue,
		},
		crons: {
			'0*****': (event) => {
				console.log(event);
			},
		},
		locals: () => {
			return {
				prod: true,
				groq: {} as Groq,
			};
		},
	},
	admin: {
		router: adminRouter,
	},
});

export type Servers = typeof servers.infer;
export type Server = typeof server.infer;
export type API = InferApiTypes<Server>;
export type PublicServer = typeof servers.infer.public;
export type AdminServer = typeof servers.infer.admin;
export type PublicAPI = InferApiTypes<PublicServer>;
export type AdminAPI = InferApiTypes<AdminServer>;
// export default server;
export default servers;
