import { procedure, createServer, durableProcedure, Router, createHandler, RouterPaths, createDurableRouter } from './lib';
import { string, object, map, BaseSchema, boolean, instance, number, undefined_, null_, date, set, optional } from 'valibot';
import { InferDurableServer, createReceiver, createSender, DurableRouter } from './lib';
interface Env {
	// Example binding to KV. Learn more at https://developers.cloudflare.com/workers/runtime-apis/kv/
	MY_KV_NAMESPACE: KVNamespace;
	//
	// Example binding to Durable Object. Learn more at https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
	TestDurable: DurableObjectNamespace;
	//
	// Example binding to R2. Learn more at https://developers.cloudflare.com/workers/runtime-apis/r2/
	MY_BUCKET: R2Bucket;
	//
	// Example binding to a Service. Learn more at https://developers.cloudflare.com/workers/runtime-apis/service-bindings/
	MY_SERVICE: Fetcher;
	//
	// Example binding to a Queue. Learn more at https://developers.cloudflare.com/queues/javascript-apis/
	MY_QUEUE: Queue;

	VECTORIZE: VectorizeIndex;
}

const locals = {
	prod: true,
};
type Locals = typeof locals;
declare module 'flarepc' {
	interface Register {
		Env: Env;
		Router: AppRouter;
		Locals: Locals;
	}
}

const router = {
	text: procedure().handle(async ({ event }) => {
		return {
			hello: 'world',
		};
	}),
	parametrized2: {
		update: procedure()
			.input(object({ name: string() }))
			.handle(async ({ input, event, ctx }) => {
				return {
					name: input.name,
				};
			}),
	},
	user: {
		get: procedure()
			.input(object({ name: string(), map: map(string(), string()) }))
			.handle(async ({ event, input }) => {
				return {
					userId: 1,
				};
			}),
	},
	httpVerbs: {
		get: procedure().handle(async ({ event }) => {
			return {
				hello: 'world',
			};
		}),
		put: procedure().handle(async ({ event }) => {
			return {
				hello: 'world',
			};
		}),
		delete: procedure().handle(async ({ event }) => {
			return {
				hello: 'world',
			};
		}),
		patch: procedure().handle(async ({ event }) => {
			return {
				hello: 'world',
			};
		}),
	},
	test: {
		object: procedure()
			.input(object({ name: string() }))
			.handle(async ({ input, event, ctx }) => {
				return {
					hello: input.name,
				};
			}),
		map: procedure(() => {
			return {
				ok: true,
			};
		})
			.input(map(string(), string()))
			.handle(async ({ input, event, ctx }) => {
				return {
					hello: input,
				};
			}),
		set: procedure()
			.input(set(string()))
			.handle(async ({ input, event, ctx }) => {
				return {
					hello: input,
				};
			}),
		string: procedure()
			.input(string())
			.handle(async ({ input, event, ctx }) => {
				return {
					hello: input,
				};
			}),
		date: procedure()
			.input(date())
			.handle(async ({ input, event, ctx }) => {
				return {
					hello: input,
				};
			}),
		number: procedure()
			.input(number())
			.handle(async ({ input, event, ctx }) => {
				return {
					hello: input,
				};
			}),
		boolean: procedure()
			.input(
				object({
					boolean: boolean(),
				}),
			)
			.handle(async ({ input, event, ctx }) => {
				return {
					hello: input,
				};
			}),
		null: procedure()
			.input(null_())
			.handle(async ({ input }) => {
				console.log({ input });
				return {
					hello: input,
				};
			}),
		undefined: procedure()
			.input(undefined_())
			.handle(async ({ input, event, ctx }) => {
				return {
					hello: input,
				};
			}),
		complex: procedure()
			.input(
				object({
					string: string(),
					number: number(),
					boolean: boolean(),
					date: date(),
					undefined: undefined_(),
					null: null_(),
					object: object({
						string: string(),
						number: number(),
						boolean: boolean(),
						map: map(string(), string()),
						date: date(),
						undefined: undefined_(),
						null: null_(),
						file: instance(File),
					}),
				}),
			)
			.handle(async ({ input, event, ctx }) => {
				return {
					hello: input,
				};
			}),
	},
};

const testProcedure = durableProcedure<TestDurable>();

const topicsIn = {
	message: testProcedure()
		.input(object({ message: string() }))
		.handle(({ input, object }) => {
			object.send('message', { message: input.message });
			return {
				hello: input.message,
			};
		}),
};
const topicsOut = {
	message: testProcedure()
		.input(object({ message: optional(string(), 'hello') }))
		.handle(({ input, object }) => {
			object.send('message', { message: input.message });
			return {
				hello: input.message,
			};
		}),
	test: {
		test: testProcedure()
			.input(object({ name: string() }))
			.handle(({ input, object }) => {
				object.send('message', {
					message: 'input.name',
				});
				return {
					hello: input.name,
				};
			}),
	},
};

const durableRouter = {
	test: {
		test: {
			test: testProcedure()
				.input(object({ name: string() }))
				.handle(({ input, object }) => {
					return {
						hello: input.name,
					};
				}),
		},
	},
};
export class TestDurable extends createDurableRouter() {
	send = createSender(topicsOut, this);
	receive = createReceiver(topicsIn, this);
	handle = createHandler(router, this);
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env, durableRouter, topicsIn, topicsOut);
	}
}

type TestDurableServer = InferDurableServer<TestDurable>;

export type AppRouter = typeof router;

const server = createServer({
	objects: {
		TestDurable: TestDurable,
	},
	router,
	locals,
});

export type Server = {
	router: AppRouter;
	objects: {
		TestDurable: TestDurableServer;
	};
};
export default server;
