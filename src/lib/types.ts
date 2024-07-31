import type { Cookies } from './cookies';
import type { BaseSchema as VSchema, Input as VInfer } from 'valibot';
import type { Schema as ZSchema, infer as ZInfer } from 'zod';
import { Handler } from './procedure';
import { DurableRouter } from './durable';

export interface Register {}

export type Env = Register extends {
	Env: infer _Env;
}
	? _Env
	: {};

export type Locals = Register extends {
	Locals: infer _Locals;
}
	? _Locals
	: {};

export type RegisteredRouter = Register extends {
	Router: infer _Router;
}
	? _Router extends Router
		? _Router
		: never
	: never;

export type Schema = ZSchema | VSchema;
export type SchemaInput<S extends Schema> = S extends ZSchema ? ZInfer<S> : S extends VSchema ? VInfer<S> : 'never';

export type MaybePromise<T> = T | Promise<T>;

export type StreamCallback<C = string> = {
	onStart?: () => MaybePromise<void>;
	onChunk?: (onChunk: { chunk: C; first: boolean }) => MaybePromise<void>;
	onEnd?: (chunks: C[]) => MaybePromise<void>;
};

export type Middleware<T = any> = (event: RequestEvent) => MaybePromise<T>;

export type RequestEvent = {
	objectId: string | null;
	objectName: string | null;
	path: string[];
	cookies: Cookies;
	request: Request;
	url: URL;
	waitUntil: ExecutionContext['waitUntil'];
	passThroughOnException: ExecutionContext['passThroughOnException'];
} & Env &
	(Locals extends never ? {} : { locals: Locals });

export type HandleFunction<
	S extends Schema | undefined,
	M extends Middleware[] | undefined,
	D extends DurableRouter | undefined = undefined,
> = (payload: HandlePayload<S, M, D>) => MaybePromise<any>;

export type HandlePayload<
	S extends Schema | undefined,
	M extends Middleware[] | undefined,
	D extends DurableRouter | undefined = undefined,
> = (S extends Schema ? { event: RequestEvent; input: SchemaInput<S> } : { event: RequestEvent }) & {
	ctx: ReturnOfMiddlewares<M>;
} & (D extends DurableRouter ? { object: D } : {});

export type ReturnOfMiddlewares<Use extends Middleware[] | undefined, PreviousData = unknown> = Use extends Middleware[]
	? Use extends [infer Head, ...infer Tail]
		? Head extends Middleware<infer HeadData>
			? Tail extends Middleware[]
				? PreviousData & HeadData & ReturnOfMiddlewares<Tail, PreviousData & HeadData>
				: HeadData & PreviousData
			: PreviousData
		: unknown
	: unknown;

export type Router = {
	[K: string]: Handler<any, any, any, any> | Router;
};

export type API<R extends Router = Router> = {
	[K in keyof R]: R[K] extends Handler<infer M, infer S, infer H>
		? S extends Schema
			? (payload: SchemaInput<S>) => ReturnType<H>
			: () => ReturnType<H>
		: R[K] extends Router
			? API<R[K]>
			: R[K];
};

export type RouterPaths<R extends Router, P extends string = ''> = {
	[K in keyof R]: R[K] extends Router
		? P extends ''
			? RouterPaths<R[K], `${string & K}`>
			: RouterPaths<R[K], `${P}.${string & K}`>
		: P extends ''
			? `${string & K}`
			: `${P}.${string & K}`;
}[keyof R];

type Get<T, K extends string> = K extends `${infer P}.${infer Rest}`
	? P extends keyof T
		? Get<T[P], Rest>
		: never
	: K extends keyof T
		? T[K]
		: never;

export type InferInputAtPath<R extends Router, P extends RouterPaths<R>> =
	Get<R, P> extends Handler<any, infer S, any, any> ? (S extends Schema ? SchemaInput<S> : never) : never;
