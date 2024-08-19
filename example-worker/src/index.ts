import { procedure, createServer, createDurableServer, cors, InferApiTypes, stream, createServers } from 'flarepc';
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
declare module 'flarepc' {
	interface Register {
		Env: Env;
		Tags: 'ADMIN' | 'MENTOR' | 'USER';
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

const router = {
	text: procedure()
		.input(string())
		.handle(async ({ event, input }) => {
			return {
				hello: input,
			};
		}),
};

export class TestDurable extends createDurableServer({}) {
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
		test: procedure('durable')
			.input(object({ id: string() }))
			.handle(async ({ input, event }) => {
				// object.setPresence({
				// 	participant: {
				// 		id: input.id,
				// 		name: 'nono',
				// 	},
				// });

				return {
					ok: true,
				};
			}),
	};

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
	}
}

const Queue = {
	test: procedure('queue')
		.input(string())
		.handle(async ({ input, event }) => {
			console.log(event.batch);
		}),
};

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
	// rateLimiters: {
	// 	MY_RATE_LIMITER: (event) => {
	// 		return event.request.headers.get('cf-connecting-ip') || '';
	// 	},
	// },
});

const publicRouter = {
	public: procedure().handle(async ({ event }) => {
		event.queue('Queue').test.send('string');
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
	admin: procedure().handle(async ({ event }) => {
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
// export default servers;
export default servers;
