import { Handler } from './procedure';
import { Router, Schema, SchemaInput } from './types';

export const createRecursiveProxy = (
	callback: (opts: { type: string; data: unknown[]; opts?: unknown }) => unknown,
	path: string[] = [],
) => {
	const proxy: unknown = new Proxy(() => {}, {
		get(_obj, key) {
			if (typeof key !== 'string') return undefined;
			return createRecursiveProxy(callback, [...path, key]);
		},
		apply(_1, _2, args) {
			return callback({
				type: path.join('.'),
				data: args[0],
				opts: args[1],
			});
		},
	});
	return proxy;
};

export type WSAPI<R extends Router> = {
	[K in keyof R]: R[K] extends Handler<infer M, infer S, infer H, infer D, infer T>
		? S extends Schema
			? (payload: SchemaInput<S>) => void
			: () => void
		: R[K] extends Router
			? WSAPI<R[K]>
			: R[K];
};
