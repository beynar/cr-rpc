import type { Middleware, RequestEvent, ReturnOfMiddlewares, Schema } from './types';

export const tryParse = <C>(data: unknown) => {
	try {
		return (typeof data !== 'string' ? data : JSON.parse(data)) as C;
	} catch (e) {
		return data as C;
	}
};

export const inputToSearchParams = (input: unknown) => {
	return `input=${encodeURIComponent(JSON.stringify(input))}`;
};

export const searchParamsToInput = (searchParams: URLSearchParams) => {
	return JSON.parse(decodeURIComponent(searchParams.get('input') || '{}'));
};

export const parse = <S extends Schema | undefined>(schema: S, data: any) => {
	if (schema === undefined) {
		return undefined;
	} else {
		// @ts-ignore
		const parseResult = schema.safeParse?.(data) || schema._parse?.(data) || schema(data);
		const errors = parseResult?.error?.issues || parseResult.issues || parseResult.summary;
		if (errors) {
			throw new Error(JSON.stringify(errors));
		}
		return parseResult.data || parseResult.output || parseResult;
	}
};

export const useMiddlewares = async <M extends Middleware[]>(middlewares: M, event: RequestEvent): Promise<ReturnOfMiddlewares<M>> => {
	const data = {};
	if (middlewares) {
		for (const middleware of middlewares) {
			Object.assign(data, await middleware(event));
		}
	}
	return data as ReturnOfMiddlewares<M>;
};
