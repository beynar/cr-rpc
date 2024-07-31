import type { Cookies } from './cookies.new';
import type { BaseSchema as VSchema, Input as VInfer } from 'valibot';
import type { Schema as ZSchema, infer as ZInfer } from 'zod';

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
	cookies: Cookies;
	request: Request;
	url: URL;
	waitUntil: ExecutionContext['waitUntil'];
	passThroughOnException: ExecutionContext['passThroughOnException'];
	route: RouterPaths<RegisteredRouter, '', '/'>;
} & Env &
	(Locals extends never ? {} : { locals: Locals });

export type HandleFunction<S extends Schema | undefined, M extends Middleware[] | undefined, P extends string = string> = (
	payload: HandlePayload<S, M, P>,
) => MaybePromise<any>;

export type HandlePayload<S extends Schema | undefined, M extends Middleware[] | undefined, P extends string = string> = (S extends Schema
	? { event: RequestEvent; input: SchemaInput<S> }
	: { event: RequestEvent }) & {
	ctx: ReturnOfMiddlewares<M>;
	params: ParamsToRecord<P>;
};

export type ParamsToRecord<P extends string = string> = Record<P, string>;

export type ReturnOfMiddlewares<Use extends Middleware[] | undefined, PreviousData = unknown> = Use extends Middleware[]
	? Use extends [infer Head, ...infer Tail]
		? Head extends Middleware<infer HeadData>
			? Tail extends Middleware[]
				? PreviousData & HeadData & ReturnOfMiddlewares<Tail, PreviousData & HeadData>
				: HeadData & PreviousData
			: PreviousData
		: unknown
	: unknown;

type AnyHandler = {
	call: (event: any, input: any, params: any) => MaybePromise<any>;
	parse: (data: any) => MaybePromise<any>;
};

export type Router = {
	[K: string]: AnyHandler | Router;
};

// type Path = <P>(path:string, router: Router<>) => Router<T>;
export type ParametrizedRouter<R extends Router> = R;

type IsParametrizedPath<P> = P extends `[${infer Path}]` ? true : false;
type NonParameterizedPath<P> = P extends `[${infer Path}]` ? Path : P;
type WithParametrized<K> = K extends string ? `[${K}]` : K;

export type API<R extends Router = Router> = APIWithoutParametrized<{
	[K in keyof R]: R[K] extends Router
		? IsParametrizedPath<K> extends true
			? (param: string) => API<R[K]>
			: API<R[K]>
		: R[K] extends AnyHandler
			? PreparedHandlerType<R[K]>
			: never;
}>;

export type APIWithoutParametrized<O> = {
	[K in NonParameterizedPath<keyof O>]: WithParametrized<K> extends keyof O ? O[WithParametrized<K>] : K extends keyof O ? O[K] : never;
};

export type PreparedHandler<S extends Schema | undefined, M extends Middleware[], H extends HandleFunction<S, M>> = {
	parse: (data: any) => Promise<S extends Schema ? SchemaInput<S> : undefined>;
	call: (event: RequestEvent, input: S extends Schema ? SchemaInput<S> : undefined) => Promise<ReturnType<H>>;
};

export type PreparedHandlerType<H extends AnyHandler = AnyHandler> = H['call'] extends (
	event: infer E,
	input: infer I,
	params: infer P,
) => MaybePromise<any>
	? APICaller<H['call'], I>
	: never;

type APICaller<C extends AnyHandler['call'], I> =
	Awaited<ReturnType<C>> extends ReadableStream<infer S>
		? I extends undefined
			? (callback: StreamCallback<S>) => never
			: (input: I, callback: StreamCallback<S>) => ReturnTypeOfCaller<C>
		: I extends undefined
			? () => ReturnTypeOfCaller<C>
			: (input: I) => ReturnTypeOfCaller<C>;

type ReturnTypeOfCaller<C extends AnyHandler['call']> =
	Awaited<ReturnType<C>> extends ReadableStream<any> ? never : Promise<Awaited<ReturnType<C>>>;

export type RouterPaths<R extends Router, P extends string = '', S extends '.' | '/' = '.'> = {
	[K in keyof R]: R[K] extends Router
		? P extends ''
			? RouterPaths<R[K], `${string & K}`, S>
			: RouterPaths<R[K], `${P}${S}${string & K}`, S>
		: P extends ''
			? `${string & K}`
			: `${P}${S}${string & K}`;
}[keyof R];

type Get<T, K extends string> = K extends `${infer P}.${infer Rest}`
	? P extends keyof T
		? Get<T[P], Rest>
		: never
	: K extends keyof T
		? T[K]
		: never;

type InferStreamReturnOrJsonReturn<T> = T extends ReadableStream<infer U> ? U : T;
type Procedures<R extends Router, P extends RouterPaths<R>> = Get<R, P>;

export type ReturnTypeOfProcedure<R extends Router, P extends RouterPaths<R>> =
	Procedures<R, P> extends AnyHandler ? InferStreamReturnOrJsonReturn<Awaited<ReturnType<Procedures<R, P>['call']>>> : Procedures<R, P>;

export type InputOfProcedure<R extends Router, P extends RouterPaths<R>> =
	Procedures<R, P> extends AnyHandler ? Parameters<Procedures<R, P>['call']>[1] : never;
