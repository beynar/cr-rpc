import {
	error,
	DurableProcedureType,
	DurableServer,
	HandleFunction,
	Middleware,
	RequestEvent,
	ReturnOfMiddlewares,
	Schema,
	SchemaInput,
} from '.';

export const parse = <S extends Schema | undefined>(schema: S, data: any) => {
	if (schema === undefined) {
		return undefined;
	} else {
		// @ts-ignore
		const parseResult = schema.safeParse?.(data) || schema._parse?.(data) || schema(data);
		const errors = parseResult?.error?.issues || parseResult.issues || parseResult.summary;
		if (errors) {
			throw error('BAD_REQUEST', errors);
		}
		return parseResult.data || parseResult.output || parseResult;
	}
};

export const useMiddlewares = async <
	M extends Middleware<D, T>[],
	D extends DurableServer | undefined = undefined,
	T extends DurableProcedureType = undefined,
>(
	middlewares: M,
	event: RequestEvent,
): Promise<ReturnOfMiddlewares<M, D, T>> => {
	const data = {};
	if (middlewares) {
		for (const middleware of middlewares) {
			Object.assign(data, await middleware(event as any));
		}
	}
	return data as ReturnOfMiddlewares<M, D, T>;
};

const createHandler = <
	S extends Schema | undefined,
	M extends Middleware<D, T>[],
	D extends DurableServer | undefined = undefined,
	T extends DurableProcedureType = undefined,
>(
	middlewares: M,
	schema?: S,
) => {
	return <H extends HandleFunction<S, M, D, T>>(handleFunction: H) => {
		return new Handler(middlewares, schema, handleFunction) as Handler<M, S, H, D, T>;
	};
};

export const procedure = <
	M extends Middleware<D, T>[],
	D extends DurableServer | undefined = undefined,
	T extends DurableProcedureType = undefined,
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

export const durableProcedure = <D extends DurableServer, T extends DurableProcedureType = 'router'>(_t?: T) => {
	return <M extends Middleware<D, T>[]>(...middlewares: M) => {
		return procedure<M, D, T>(...middlewares);
	};
};
export class Handler<
	M extends Middleware<D, T>[],
	S extends Schema | undefined,
	const H extends HandleFunction<S, M, D, T>,
	D extends DurableServer | undefined = undefined,
	T extends DurableProcedureType = undefined,
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
		return this.handleFunction({ event, input, ctx: await useMiddlewares(this.middlewares as any, event), object } as any);
	};
}
