import type { Cookies } from './cookies';
import type { Input as VInput, Output as VOutput, BaseSchema as VSchema } from 'valibot';
import type { Schema as ZSchema, infer as ZOutput, input as ZInput } from 'zod';
import { Type as ASchema } from 'arktype';
import { Handler } from './procedure';
import { ConnectOptions, WebSocketClient } from './websocket';
import { createDurableServer } from './durable';

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

export type SessionData = Register extends {
	SessionData: infer _SessionData;
}
	? _SessionData
	: {};

export type RegisteredRouter = Register extends {
	Router: infer _Router;
}
	? _Router extends Router
		? _Router
		: never
	: never;

export type RegisteredObjects = Register extends {
	object: infer _Objects;
}
	? _Objects extends Record<string, DurableServer>
		? _Objects
		: never
	: never;

export type Participant = Register extends {
	Participant: infer _Participant;
}
	? _Participant extends Record<string, any> & {
			id: string;
		}
		? _Participant
		: {
				id: string;
			}
	: {
			id: string;
		};

export type DurableServer = ReturnType<typeof createDurableServer>['prototype'];

export type Schema = ZSchema | VSchema | ASchema;
export type SchemaInput<S extends Schema> = S extends ASchema
	? S['inferIn']
	: S extends ZSchema
		? ZInput<S>
		: S extends VSchema
			? VInput<S>
			: never;
export type SchemaOutput<S extends Schema> = S extends ASchema
	? S['infer']
	: S extends ZSchema
		? ZOutput<S>
		: S extends VSchema
			? VOutput<S>
			: never;

export type MaybePromise<T> = T | Promise<T>;

export type Middleware<
	D extends DurableServer | undefined = undefined,
	T extends DurableProcedureType = undefined,
	R = any,
> = D extends undefined ? (event: DynamicRequestEvent<D, T>) => MaybePromise<R> : (event: DynamicRequestEvent<D, T>) => MaybePromise<R>;

export type DurableRequestEvent = {
	path: string[];
	cookies: Cookies;
	request: Request;
	url: URL;
	object: ObjectInfo | undefined;
};

export type DurableWebsocketInputEvent = { session: Session; ws: WebSocket; object: ObjectInfo };

export type DurableWebsocketOutputEvent = {
	sessions: { session: Session; ws: WebSocket }[];
	object: ObjectInfo;
};

export type RequestEvent = {
	path: string[];
	cookies: Cookies;
	request: Request;
	url: URL;
	waitUntil: ExecutionContext['waitUntil'];
	passThroughOnException: ExecutionContext['passThroughOnException'];
} & Env &
	(Locals extends never ? {} : { locals: Locals });

export type Session = {
	id: string;
	participant: Participant;
	connected: boolean;
	createdAt: number;
	data: SessionData;
	object: ObjectInfo;
};

export type MessagePayload<O extends Router, T extends RouterPaths<O>> = {
	type: T;
	data: InferSchemaOutPutAtPath<O, T>;
	ctx: InferOutPutAtPath<O, T>;
};

export type SingletonPaths<R extends Router, P extends RouterPaths<R>> = P extends `${infer START}.${infer REST}` ? never : P;
type NestedPaths<R extends Router, P extends RouterPaths<R>> = P extends `${infer START}.${infer REST}` ? P : never;

export type MessageCallback<O extends Router, K extends RouterPaths<O>> = (payload: {
	data: InferSchemaOutPutAtPath<O, K>;
	ctx: InferOutPutAtPath<O, K>;
}) => void;

export type MessageHandlers<O extends Router> = Partial<
	{
		[K in SingletonPaths<O, RouterPaths<O>>]: MessageCallback<O, K>;
	} & UnionToIntersection<PathToNestedObject<O, NestedPaths<O, RouterPaths<O>>>>
>;

export type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never;

export type PathToNestedObject<O extends Router, P extends string, BasePath extends string = ''> = P extends `${infer START}.${infer REST}`
	? Partial<{ [K in START]: PathToNestedObject<O, REST, BasePath extends '' ? `${K}` : `${BasePath}.${K}`> }>
	: Partial<{
			[K in P]: `${BasePath}.${K}` extends RouterPaths<O> ? MessageCallback<O, `${BasePath}.${K}`> : unknown;
		}>;

export type DurableProcedureType = 'in' | 'out' | 'router' | undefined;

export type DurableOptions = {
	getSessionDataAndParticipant?: (payload: {
		event: DurableRequestEvent;
		object: DurableServer;
	}) => MaybePromise<{ session: SessionData; participant: Participant }>;
	onError?: (payload: { error: unknown; ws?: WebSocket; session?: Session; message?: string; object: DurableServer }) => MaybePromise<void>;
	onMessage?: (payload: { ws: WebSocket; session: Session; message: string; object: DurableServer }) => MaybePromise<void>;
};
export type HandleFunction<
	S extends Schema | undefined,
	M extends Middleware<D, T>[] | undefined,
	D extends DurableServer | undefined = undefined,
	T extends DurableProcedureType = undefined,
> = (payload: HandlePayload<S, M, D, T>) => MaybePromise<any>;

type OmitNever<T> = Pick<
	T,
	{
		[K in keyof T]: T[K] extends never ? never : K;
	}[keyof T]
>;

export type DynamicRequestEvent<
	D extends DurableServer | undefined = undefined,
	T extends DurableProcedureType = undefined,
> = D extends undefined
	? RequestEvent
	: T extends undefined | 'router'
		? DurableRequestEvent
		: T extends 'in'
			? DurableWebsocketInputEvent
			: DurableWebsocketOutputEvent;

export type HandlePayload<
	S extends Schema | undefined,
	M extends Middleware<D, T>[] | undefined,
	D extends DurableServer | undefined = undefined,
	T extends DurableProcedureType = undefined,
> = OmitNever<{
	event: DynamicRequestEvent<D, T>;
	input: S extends Schema ? SchemaInput<S> : never;
}> & {
	ctx: ReturnOfMiddlewares<M, D, T>;
} & (D extends undefined ? {} : { object: D });

export type ReturnOfMiddlewares<
	Use extends Middleware<D, T>[] | undefined,
	D extends DurableServer | undefined = undefined,
	T extends DurableProcedureType = undefined,
	PreviousData = unknown,
> = Use extends Middleware<D, T>[]
	? Use extends [infer Head, ...infer Tail]
		? Head extends Middleware<D, T, infer HeadData>
			? Tail extends Middleware<infer DD, infer TT, infer TD>[]
				? PreviousData & HeadData & ReturnOfMiddlewares<Tail, DD, TT, PreviousData & HeadData>
				: HeadData & PreviousData
			: PreviousData
		: unknown
	: unknown;

export type Router = {
	[K: string]: Handler<any, any, any, any, any> | Router;
};

export type Server = {
	router: Router;
	objects?: Record<string, DurableServerDefinition>;
};
export type DurableServerDefinition<R extends Router = Router, I extends Router = Router, O extends Router = Router> = {
	router?: R;
	in?: I;
	out?: O;
};

type IO<R> = R extends Router
	? {
			[K in RouterPaths<R>]: {
				input: InferInputAtPath<R, K>;
				output: InferOutPutAtPath<R, K>;
			};
		}
	: never;
type InferWS<O> =
	O extends DurableServerDefinition<infer R, infer I, infer O>
		? {
				ws: WebSocketClient<I, O>;
				in: {
					[K in RouterPaths<I>]: InferOutPutAtPath<I, K>;
				};
				out: {
					[K in RouterPaths<O>]: InferInputAtPath<O, K>;
				};
			}
		: never;

export type InferApiTypes<S extends Server> = IO<S['router']> & {
	[K in keyof S['objects']]: IO<Get<S['objects'][K], 'router'>> & InferWS<S['objects'][K]>;
};

export type InferDurableApi<D extends DurableServer> = DurableServerDefinition<D['router'], D['topicsIn'], D['topicsOut']>;

export type Client<S extends Server> = API<S['router']> & {
	[K in keyof S['objects']]: (
		id?: string,
	) => S['objects'][K] extends DurableServerDefinition<infer R, infer I, infer O>
		? API<R> & { connect: (options: ConnectOptions<O>) => Promise<WebSocketClient<I, O>> }
		: never;
};

export type StreamCallbacks<C = string> = {
	onStart?: () => MaybePromise<void>;
	onChunk?: (onChunk: { chunk: C; first: boolean }) => MaybePromise<void>;
	onEnd?: (chunks: C[]) => MaybePromise<void>;
};

export type StreamCallback<S = any> = ({ chunk, first }: { chunk: S; first: boolean }) => void;

export type API<R extends Router = Router> = {
	[K in keyof R]: R[K] extends Handler<infer M, infer S, infer H, infer D, infer T>
		? S extends Schema
			? ReturnType<H> extends Promise<ReadableStream<infer C>>
				? (payload: SchemaInput<S>, callback: StreamCallback<C>) => void
				: (payload: SchemaInput<S>) => ReturnType<H>
			: ReturnType<H> extends Promise<ReadableStream<infer C>>
				? (callback: StreamCallback<C>) => void
				: () => ReturnType<H>
		: R[K] extends Router
			? API<R[K]>
			: R[K];
};

export type RouterPaths<R extends Router, P extends string = '', S extends '.' | '/' = '.'> = {
	[K in keyof R]: R[K] extends Router
		? P extends ''
			? RouterPaths<R[K], `${string & K}`>
			: RouterPaths<R[K], `${P}${S}${string & K}`>
		: P extends ''
			? `${string & K}`
			: `${P}${S}${string & K}`;
}[keyof R];

export type Get<T, K extends string> = K extends `${infer P}.${infer Rest}`
	? P extends keyof T
		? Get<T[P], Rest>
		: never
	: K extends keyof T
		? T[K]
		: 'never';

export type InferInputAtPath<R extends Router, P extends RouterPaths<R>> =
	Get<R, P> extends Handler<any, infer S, any, any, any> ? (S extends Schema ? SchemaInput<S> : never) : never;
export type InferSchemaOutPutAtPath<R extends Router, P extends RouterPaths<R>> =
	Get<R, P> extends Handler<any, infer S, any, any, any> ? (S extends Schema ? SchemaOutput<S> : never) : never;

export type InferOutPutAtPath<R extends Router, P extends RouterPaths<R>> =
	Get<R, P> extends Handler<infer M, infer S, infer H, infer D, any>
		? H extends HandleFunction<S, infer M, D>
			? Awaited<ReturnType<H>>
			: never
		: never;

export type GetObjectJurisdictionOrLocationHint = (payload: {
	request: Request;
	env: Env;
	object: {
		name: string;
		id?: string;
	};
}) => MaybePromise<{
	jurisdiction?: DurableObjectJurisdiction;
	locationHint?: DurableObjectLocationHint;
}>;

export type ObjectInfo = {
	name: string;
	id: string;
	jurisdiction?: DurableObjectJurisdiction;
	locationHint?: DurableObjectLocationHint;
};
