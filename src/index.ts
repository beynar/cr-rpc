// import { procedure, createRouter, type Router } from 'cf-rpc';
import { procedure, createRouter, type Router } from './lib';
import { string, object, map, BaseSchema, boolean, instance, Input, number, nullable, undefined_, null_, date } from 'valibot';

const schema = string();
type S = typeof schema;
type I = typeof schema extends BaseSchema ? Input<typeof schema> : 'error';

interface Env {
	// Example binding to KV. Learn more at https://developers.cloudflare.com/workers/runtime-apis/kv/
	MY_KV_NAMESPACE: KVNamespace;
	//
	// Example binding to Durable Object. Learn more at https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
	MY_DURABLE_OBJECT: DurableObjectNamespace;
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
declare module 'cf-rpc' {
	interface Register {
		Env: Env;
		Router: AppRouter;
		Locals: Locals;
	}
}
const router = {
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
		update: procedure().handle(async ({ event }) => {
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
			.handle(async ({ input, event, ctx }) => {
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
} satisfies Router;

export type AppRouter = typeof router;

export default createRouter({
	router,
	locals,
});
