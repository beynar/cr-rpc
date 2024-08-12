import { procedure, createServer, queueProcedure } from './lib';
import { string, object, map, BaseSchema, boolean, instance, number, undefined_, null_, date, set } from 'valibot';

const locals = {
	prod: true,
};

declare global {
	type Locals = typeof locals;

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
	test: queueProcedure()
		.input(string())
		.handle(async ({ input, event }) => {
			console.log(input);
		}),
};

const server = createServer({
	router,
	locals,
	// queues: {
	// 	Queue,
	// },
});

export type Server = typeof server.infer;
export default server;
