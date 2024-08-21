import { procedure, createServer, createDurableServer, combineRouters, createServers, Server as SS } from '../src/lib';
import { string, object, map, BaseSchema, boolean, instance, number, undefined_, null_, date, set, array, optional } from 'valibot';
import { createClient } from '../src/lib/client';
import { type } from 'arktype';
import { z } from 'zod';
const router = {
	test: {
		test: {
			test: {
				valibot: procedure()
					.input(
						object({
							string: string(),
							number: number(),
							boolean: boolean(),
							array: array(string()),
							object: object({
								name: string(),
								age: number(),
							}),
							set: set(string()),
							map: map(string(), string()),
							date: date(),
							optional: optional(string()),
						}),
					)
					.handle(async ({ input, event }) => {
						return input;
					}),
				zod: procedure()
					.input(
						z.object({
							string: z.string(),
							number: z.number(),
							boolean: z.boolean(),
							array: z.array(z.string()),
							object: z.object({
								name: z.string(),
								age: z.number(),
							}),
							set: z.set(z.string()),
							map: z.map(z.string(), z.string()),
							date: z.date(),
							optional: z.optional(z.string()),
						}),
					)
					.handle(async ({ input, event }) => {
						return input;
					}),
				arktype: procedure()
					.input(
						type({
							string: 'string',
							number: 'number',
							boolean: 'boolean',
							array: 'string[]',
							object: {
								name: 'string',
								age: 'number',
							},
							set: 'Set',
							map: 'Map',
							date: 'Date',
							'optional?': 'string',
						}),
					)
					.handle(async ({ input }) => {
						return input;
					}),
			},
		},
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

export class Test extends createDurableServer() {
	out = {
		message: procedure('out')
			.input(object({ message: string() }))
			.handle(async ({ input }) => {
				return {
					hello: input.message,
				};
			}),
	};
	in = {
		message: procedure('in')
			.input(object({ message: string() }))
			.handle(async ({ input }) => {
				return {
					hello: input.message,
				};
			}),
	};
	firstRouter = {
		firstProcedure: procedure('durable').handle(async ({}) => {
			return {
				ok: false,
			};
		}),
	};
	secondRouter = {
		secondProcedure: procedure('durable').handle(async ({}) => {
			return {
				ok: false,
			};
		}),
	};
	send = this.createSender(this.out);

	router = combineRouters(this.firstRouter, this.secondRouter);
}

const server = createServer({
	router,
	objects: {
		Test: Test,
	},
});

export type Server = typeof server.infer;
// export default server;
