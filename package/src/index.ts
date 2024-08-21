import { procedure, createServer, createDurableServer, combineRouters, createServers, Server as SS } from './lib';
import { string, object, map, BaseSchema, boolean, instance, number, undefined_, null_, date, set } from 'valibot';
import { createClient } from './lib/client';
import { createDurableDoc, DurableDoc } from './lib/yjs';
import { DocProvider } from './lib/yjs/client';

declare global {
	type Locals = {};

	interface Env {
		Queue: Queue;
	}
	type Queues = {
		Queue: typeof Queue;
	};
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
		map: procedure()
			.use(() => {
				return {
					ok: true,
				};
			})
			.use(() => {
				return {
					ok2: true,
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

export type AppRouter = typeof router;

const Queue = {
	test: procedure('queue')
		.input(string())
		.handle(async ({ input, event }) => {
			// console.log(input);
		}),
};

const durableRouter = {
	test: procedure('durable')
		.input(object({ id: string() }))
		.handle(async ({ input, event }) => {
			const promise = async () => {
				await new Promise((resolve) => {
					setTimeout(resolve, 2000);
				});
				console.log({ input });
				return {
					ok: true,
				};
			};

			return {
				ok: true,
			};
		}),
};

export class TestDurable extends createDurableDoc() {
	out = {
		message: procedure('out')
			.input(object({ message: string() }))
			.handle(async ({ input, event }) => {
				return {
					hello: input.message,
				};
			}),
	};
	in = {
		message: procedure('in')
			.input(object({ message: string() }))
			.handle(async ({ input, event }) => {
				return {
					hello: input.message,
				};
			}),
	};
	testRouter = {
		test2: procedure('durable').handle(async ({ event }) => {
			return {
				ok: false,
			};
		}),
	};
	send = this.createSender(this.out);

	router = combineRouters(durableRouter, this.testRouter);
}

const server = createServer({
	router,
	// locals,
	objects: {
		TestDurable: TestDurable,
	},
	// queues: {
	// 	Queue,
	// },
});

export type Server = typeof server.infer;
// export default server;

const publicRouter = {
	public: procedure().handle(async ({ event }) => {
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
		objects: {
			TestDurable: TestDurable,
		},
	},
	admin: {
		router: adminRouter,
	},
});

export type Servers = typeof servers.infer;

type D = Servers['public']['objects']['TestDurable'];
export type PublicServer = typeof servers.infer.public;
export type AdminServer = typeof servers.infer.admin;

const api = createClient<Servers, 'public'>({
	endpoint: 'http://localhost:8080',
	server: 'public',
	onError: (error) => {
		console.log(error);
	},
});

const {ws, provider} = await api.TestDurable('random').doc(DocProvider);

provider.



const api2 = createClient<Server>({
	endpoint: 'http://localhost:8080',
	onError: (error) => {
		console.log(error);
	},
});

type T = Servers extends Record<string, SS> ? true : false;
