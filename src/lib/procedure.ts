import { HandleFunction, Middleware, PreparedHandler, RequestEvent, ReturnOfMiddlewares, Schema, SchemaInput } from './types';

export const procedure = <M extends Middleware[]>(...middlewares: M) => {
	const useMiddlewares = async (event: RequestEvent): Promise<ReturnOfMiddlewares<M>> => {
		const data = {};
		if (middlewares) {
			for (let middleware of middlewares) {
				Object.assign(data, await middleware(event));
			}
		}
		return data as ReturnOfMiddlewares<M>;
	};
	const handler =
		<S extends Schema | undefined>(schema?: S) =>
		<H extends HandleFunction<S, M>>(handler: H): PreparedHandler<S, M, H> => {
			return {
				parse: (data: any) => {
					if (schema === undefined) {
						return undefined;
					} else {
						// @ts-ignore
						const parseResult = schema.safeParse?.(data) || schema._parse?.(data);
						const errors = parseResult?.error?.issues || parseResult.issues;
						if (errors) {
							console.log(data);
							throw new Error(JSON.stringify(errors));
						}
						return parseResult.data || parseResult.output;
					}
				},
				call: async (event: RequestEvent, input: S extends Schema ? SchemaInput<S> : undefined): Promise<ReturnType<H>> => {
					return handler({ event, input, ctx: await useMiddlewares(event) } as any);
				},
			};
		};
	return {
		input: <S extends Schema>(schema: S) => ({
			handle: handler(schema),
		}),
		handle: handler(undefined),
	};
};
