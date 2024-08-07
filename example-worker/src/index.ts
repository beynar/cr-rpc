import {
	procedure,
	createServer,
	durableProcedure,
	createDurableServer,
	cors,
	type InferDurableApi,
	InferApiTypes,
	socketiparse,
} from 'flarepc';
import { string, object, optional } from 'valibot';
import type { DurableObject } from 'cloudflare:workers';

interface Env {
	TestDurable: DurableObject;
}

declare module 'flarepc' {
	interface Register {
		Env: Env;
		Router: AppRouter;
		Locals: {};
	}
}

const router = {
	text: procedure().handle(async ({ event }) => {
		return {
			hello: 'world',
		};
	}),
};

const routerProcedure = durableProcedure<TestDurable, 'router'>();
const inProcedure = durableProcedure<TestDurable, 'in'>();
const outProcedure = durableProcedure<TestDurable, 'out'>();

const topicsIn = {
	message: inProcedure()
		.input(object({ message: string() }))
		.handle(({ input, object }) => {
			console.log(input);
		}),
	noInput: inProcedure().handle(({ event, object }) => {
		console.log('here');
		object.send({ to: event.session?.participant.id }).message({ message: 'hello prout' });
	}),
	test: {
		test: {
			test: inProcedure()
				.input(object({ name: string() }))
				.handle(async ({ input, object, event }) => {
					console.log(event.session?.id);
				}),
		},
	},
};
const topicsOut = {
	message: outProcedure()
		.input(object({ message: optional(string(), 'hello') }))
		.handle(({ input, object }) => {
			return {
				hello: input.message,
			};
		}),
	test: {
		test: outProcedure()
			.input(object({ name: string() }))
			.handle(({ input, object }) => {
				return {
					hello: input.name,
				};
			}),
		test2: outProcedure()
			.input(object({ name: string() }))
			.handle(({ input, object }) => {
				return {
					hello: input.name,
				};
			}),
	},
};

const durableRouter = {
	test: {
		test: {
			test: routerProcedure()
				.input(object({ name: string() }))
				.handle(({ input, object, event }) => {
					return {
						object: object?.id,
						hello: input.name,
					};
				}),
		},
	},
};
export class TestDurable extends createDurableServer({}, topicsIn, topicsOut) {
	router = durableRouter;
}

export type AppRouter = typeof router;

const server = createServer({
	cors: cors({
		origin: true,
		credentials: true,
	}),
	objects: {
		TestDurable: TestDurable,
	},
	router,
	locals: () => ({
		prod: true,
	}),
});

export type Server = typeof server.infer;
export type API = InferApiTypes<Server>;
export type OUT = typeof topicsOut;
export default server;
