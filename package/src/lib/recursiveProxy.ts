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
