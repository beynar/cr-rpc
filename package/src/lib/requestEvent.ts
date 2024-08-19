import { Env, Locals, MaybePromise, Meta, Queues, Session, DurableMeta, QueueHandler, StaticHandler, Cookies } from '.';

export const getPath = (event: RequestEvent | DurableRequestEvent) => {
	let isObject = false;
	let isStatic = false;
	event.path = event.url.pathname
		.split('/')
		.filter(Boolean)
		.filter((part) => {
			if (part === 'static') {
				isStatic = true;
			}
			if (part.match(/\(([^:]+):([^)]+)\)/)) {
				isObject = true;
				return false;
			}
			if (part.match(/\[([^\]]+)\]/)) {
				return false;
			}
			return true;
		});
	const method = event.request.method;
	if (method !== 'POST' && !isObject && !isStatic) {
		event.path.push(method.toLocaleLowerCase());
	}
};

export type RequestEvent = {
	request: Request;
	env: Env;
	ctx: ExecutionContext;
	locals?: Locals;
	path: string[];
	meta: Meta;
	queue: QueueHandler['send'];
	static: StaticHandler;
	url: URL;
	cookies: Cookies;
};
export type CronRequestEvent = ScheduledController & {
	env: Env;
	ctx: ExecutionContext;
	locals?: Locals;
	queue: QueueHandler['send'];
};

export type DurableRequestEvent = {
	request: Request;
	ctx: DurableObjectState;
	env: Env;
	locals: Locals;
	path: string[];
	meta: Meta;
	queue: QueueHandler['send'];
	static: StaticHandler;
	url: URL;
	cookies: Cookies;
};

export type WebsocketOutputRequestEvent = {
	to: { session: Session; ws: WebSocket }[];
	env: Env;
	ctx: DurableObjectState;
	locals: Locals;
	queue: QueueHandler['send'];
	static: StaticHandler;
};

export type WebsocketInputRequestEvent = {
	from: {
		session: Session;
		ws: WebSocket;
	};
	locals: Locals;
	env: Env;
	ctx: DurableObjectState;
	queue: QueueHandler['send'];
	static: StaticHandler;
};

export type QueueRequestEvent = {
	batch: MessageBatch;
	path: string[];
	message: Message<unknown>;
	ctx: ExecutionContext;
	env: Env;
	locals: Locals;
};
