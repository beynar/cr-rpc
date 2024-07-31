import { DurableRouter } from './durable';
import { HandleFunction, Middleware, RequestEvent, Schema, SchemaInput } from './types';
import { useMiddlewares } from './utils';

const createHandler = <S extends Schema | undefined, M extends Middleware[], D extends DurableRouter | undefined = undefined>(
	middlewares: M,
	schema?: S,
) => {
	return <H extends HandleFunction<S, M, D>>(handleFunction: H) => {
		return new Handler(middlewares, schema, handleFunction) as Handler<M, S, H, D>;
	};
};

export const procedure = <M extends Middleware[], D extends DurableRouter | undefined = undefined>(...middlewares: M) => {
	return {
		handle: <H extends HandleFunction<undefined, M, D>>(handleFunction: H) => {
			return createHandler<undefined, M, D>(middlewares, undefined)(handleFunction);
		},
		input: <S extends Schema>(schema: S) => {
			return {
				handle: <H extends HandleFunction<S, M, D>>(handleFunction: H) => createHandler<S, M, D>(middlewares, schema)(handleFunction),
			};
		},
	};
};
export const durableProcedure = <D extends DurableRouter>() => {
	return <M extends Middleware[]>(...middlewares: M) => {
		return procedure<M, D>(...middlewares);
	};
};
export class Handler<
	M extends Middleware[],
	S extends Schema | undefined,
	const H extends HandleFunction<S, M, D>,
	D extends DurableRouter | undefined = undefined,
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
