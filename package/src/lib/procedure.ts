import {
	error,
	HandleFunction,
	Middleware,
	ReturnOfMiddlewares,
	Schema,
	SchemaInput,
	ProcedureType,
	DynamicRequestEvent,
	Router,
	HandlePayload,
} from '.';

export const parse = <S extends Schema | undefined>(schema: S, data: any) => {
	if (schema === undefined) {
		return undefined;
	} else {
		// @ts-ignore
		const parseResult = schema.safeParse?.(data) || schema._run?.({ value: data }, { abortEarly: true, abortPipeEarly: true });
		const errors = parseResult?.error?.issues || parseResult.issues || parseResult.summary;
		if (errors) {
			throw error('BAD_REQUEST', errors);
		}
		if ('_run' in schema) {
			return parseResult.value;
		} else if ('safeParse' in schema) {
			return parseResult.data;
		}
		return parseResult.data || parseResult.output || parseResult;
	}
};

export const useMiddlewares = async <M extends Middleware<T>[], T extends ProcedureType = undefined>(
	middlewares: M,
	event: DynamicRequestEvent<T>,
): Promise<ReturnOfMiddlewares<M, T>> => {
	const data = {};
	if (middlewares) {
		for (const middleware of middlewares) {
			Object.assign(data, await middleware(event));
		}
	}
	return data as ReturnOfMiddlewares<M, T>;
};

export class Procedure<M extends Middleware<T>[], T extends ProcedureType = undefined> {
	private middlewares: M;
	private target: T;

	constructor(middlewares: M, target: T) {
		this.middlewares = middlewares;
		this.target = target;
	}

	use = <NewM extends Middleware<T>[]>(...middlewares: NewM) => {
		return new Procedure(this.middlewares.concat(middlewares), this.target) as Procedure<[...M, ...NewM], T>;
	};

	handle = <H extends HandleFunction<undefined, M, T>>(handleFunction: H) => {
		return new Handler(this.middlewares, undefined, handleFunction) as Handler<M, undefined, H, T>;
	};
	input = <S extends Schema>(schema: S) => {
		return {
			handle: <H extends HandleFunction<S, M, T>>(handleFunction: H) => {
				return new Handler(this.middlewares, schema, handleFunction) as Handler<M, S, H, T>;
			},
		};
	};
}

export class Handler<
	M extends Middleware<T>[],
	S extends Schema | undefined,
	const H extends HandleFunction<S, M, T>,
	T extends ProcedureType = undefined,
> {
	middlewares: M;
	schema: S;
	handleFunction: H;

	constructor(middlewares: M, schema: S, handleFunction: H) {
		this.middlewares = middlewares;
		this.schema = schema;
		this.handleFunction = handleFunction;
	}

	call = async (event: DynamicRequestEvent<T>, input: S extends Schema ? SchemaInput<S> : undefined) => {
		return this.handleFunction({ event, input, ctx: await useMiddlewares(this.middlewares, event) } as HandlePayload<S, M, T>);
	};
}

export const procedure = <T extends ProcedureType = undefined>(type?: T) => new Procedure([], type) as Procedure<[], T>;
