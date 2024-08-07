import type { Cookies } from './cookies';
import type { Input as VInput, Output as VOutput, BaseSchema as VSchema } from 'valibot';
import type { Schema as ZSchema, infer as ZOutput, input as ZInput } from 'zod';
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

export type RegisteredParticipant = Register extends {
	Participant: infer _Participant;
}
	? _Participant extends Participant
		? _Participant
		: never
	: Participant;

type Participant = {
	id: string;
} & Record<string, any>;

export type DurableServer = ReturnType<typeof createDurableServer>['prototype'];
export type Schema = ZSchema | VSchema;
export type SchemaInput<S extends Schema> = S extends ZSchema ? ZInput<S> : S extends VSchema ? VInput<S> : 'never';
export type SchemaOutput<S extends Schema> = S extends ZSchema ? ZOutput<S> : S extends VSchema ? VOutput<S> : 'never';

export type MaybePromise<T> = T | Promise<T>;

export type StreamCallback<C = string> = {
	onStart?: () => MaybePromise<void>;
	onChunk?: (onChunk: { chunk: C; first: boolean }) => MaybePromise<void>;
	onEnd?: (chunks: C[]) => MaybePromise<void>;
};

export type Middleware<T = any> = (event: RequestEvent) => MaybePromise<T>;

export type DurableRequestEvent = { path: string[]; cookies: Cookies; request: Request; url: URL };
export type DurableWebsocketInputEvent = { session: Session; ws: WebSocket };
export type DurableWebsocketOutputEvent = never;

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
	participant: RegisteredParticipant;
	connected: boolean;
	createdAt: number;
	meta?: CfProperties;
	cookies: Map<string, string>;
};

export type DurableProcedureType = 'in' | 'out' | 'router';

export type DurableOptions = {
	getParticipant?: (payload: { event: DurableRequestEvent; object: DurableServer }) => MaybePromise<Session>;
	acceptConnection?: (payload: { event: DurableRequestEvent; object: DurableServer }) => MaybePromise<boolean>;
	onError?: (error: unknown) => void;
};
export type HandleFunction<
	S extends Schema | undefined,
	M extends Middleware[] | undefined,
	D extends DurableServer | undefined = undefined,
	T extends DurableProcedureType = 'router',
> = (payload: HandlePayload<S, M, D, T>) => MaybePromise<any>;

export type HandlePayload<
	S extends Schema | undefined,
	M extends Middleware[] | undefined,
	D extends DurableServer | undefined = undefined,
	T extends DurableProcedureType = 'router',
> = (S extends Schema
	? {
			event: D extends DurableServer
				? T extends 'router'
					? DurableRequestEvent
					: T extends 'in'
						? DurableWebsocketInputEvent
						: DurableWebsocketOutputEvent
				: RequestEvent;
			input: SchemaInput<S>;
		}
	: {
			event: D extends DurableServer
				? T extends 'router'
					? DurableRequestEvent
					: T extends 'in'
						? DurableWebsocketInputEvent
						: DurableWebsocketOutputEvent
				: RequestEvent;
		}) & {
	ctx: ReturnOfMiddlewares<M>;
} & (D extends DurableServer
		? {
				object: D;
			}
		: {});

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
		id: string,
	) => S['objects'][K] extends DurableServerDefinition<infer R, infer I, infer O>
		? API<R> & { connect: (options: ConnectOptions<O>) => Promise<WebSocketClient<I, O>> }
		: never;
};

export type API<R extends Router = Router> = {
	[K in keyof R]: R[K] extends Handler<infer M, infer S, infer H, infer D, infer T>
		? S extends Schema
			? (payload: SchemaInput<S>) => ReturnType<H>
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
		? H extends HandleFunction<S, M, D>
			? Awaited<ReturnType<H>>
			: never
		: never;
