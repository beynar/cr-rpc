// import { object, optional, string } from 'valibot';
// import { durableProcedure, procedure } from './procedure';
// import { Env, Middleware, Register, Router } from './types';
// import { DurableObject } from 'cloudflare:workers';

// declare global {
// 	type RegisteredObjects = {
// 		DurableTestTwo: DurableTestTwo;
// 	};
// }

// const router = {
// 	test: {
// 		test: {
// 			test: procedure()
// 				.input(object({ name: string() }))
// 				.handle(({ input }) => {
// 					return {
// 						hello: input.name,
// 					};
// 				}),
// 		},
// 	},
// };

// const createDurable = <R extends Router, I extends Router, O extends Router>(router: R, _in?: I, _out?: O) => {
// 	return class extends DurableObject {
// 		router = router;
// 		_in = _in;
// 		_out = _out;
// 		constructor(ctx: DurableObjectState, env: Env) {
// 			super(ctx, env);
// 		}
// 	};
// };

// // export const durableProcedure = <D extends keyof RegisteredObjects>() => {
// // 	return <M extends Middleware[]>(...middlewares: M) => {
// // 		return procedure<M, Partial<RegisteredObjects[D]>>(...middlewares);
// // 	};
// // };

// const p = durableProcedure<DurableTestTwo>();

// const topics = {
// 	message: p()
// 		.input(object({ message: string() }))
// 		.handle(({ input, object }) => {}),
// };

// class DurableTestTwo extends createDurable(router, topics, topics) {}
