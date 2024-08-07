import { DurableProcedureType, DurableServer, HandleFunction, Middleware, RequestEvent, Schema, SchemaInput } from './types';
import { useMiddlewares } from './utils';
const createHandler = <
	S extends Schema | undefined,
	M extends Middleware[],
	D extends DurableServer | undefined = undefined,
	T extends DurableProcedureType = 'router',
>(
	middlewares: M,
	schema?: S,
) => {
	return <H extends HandleFunction<S, M, D, T>>(handleFunction: H) => {
		return new Handler(middlewares, schema, handleFunction) as Handler<M, S, H, D, T>;
	};
};

export const procedure = <
	M extends Middleware[],
	D extends DurableServer | undefined = undefined,
	T extends DurableProcedureType = 'router',
>(
	...middlewares: M
) => {
	return {
		handle: <H extends HandleFunction<undefined, M, D, T>>(handleFunction: H) => {
			return createHandler<undefined, M, D, T>(middlewares, undefined)(handleFunction);
		},
		input: <S extends Schema>(schema: S) => {
			return {
				handle: <H extends HandleFunction<S, M, D, T>>(handleFunction: H) => createHandler<S, M, D, T>(middlewares, schema)(handleFunction),
			};
		},
	};
};

export const durableProcedure = <D extends DurableServer, T extends DurableProcedureType>(_t?: T) => {
	return <M extends Middleware[]>(...middlewares: M) => {
		return procedure<M, D, T>(...middlewares);
	};
};
export class Handler<
	M extends Middleware[],
	S extends Schema | undefined,
	const H extends HandleFunction<S, M, D, T>,
	D extends DurableServer | undefined = undefined,
	T extends DurableProcedureType = 'router',
> {
	middlewares: M;
	schema: S;
	handleFunction: H;

	constructor(middlewares: M, schema: S, handleFunction: H) {
		this.middlewares = middlewares;
		this.schema = schema;
		this.handleFunction = handleFunction;
	}

	call = async (event: RequestEvent, input: S extends Schema ? SchemaInput<S> : undefined, object?: D) => {
		return this.handleFunction({ event, input, ctx: await useMiddlewares(this.middlewares, event), object } as any);
	};
}
