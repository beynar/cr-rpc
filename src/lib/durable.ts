import { DurableObject } from 'cloudflare:workers';
import { Handler } from './procedure';
import { Env, InferInputAtPath, InferOutPutAtPath, Locals, MaybePromise, RequestEvent, Router, RouterPaths } from './types';
import { createPartialRequestEvent, createRequestEvent, getHandler } from './server';
import { parse } from './utils';
import { socketify } from './deform';
import { handleRequest } from './request';
import { error, FLARERROR, handleError } from './error';

export const createDurableRouter = () => {
	return class extends DurableRouter {
		public ctx: DurableObjectState;
		public env: Env;
		constructor(ctx: DurableObjectState, env: Env, router: Router, topicsIn: Router, topicsOut: Router) {
			super(ctx, env, router, topicsIn, topicsOut);
			this.ctx = ctx;
			this.env = env;
		}
	};
};
export class DurableRouter<R extends Router = Router, IN extends Router = Router, OUT extends Router = Router> extends DurableObject {
	currentlyConnectedWebSockets;
	state: DurableObjectState;
	storage: DurableObjectStorage;
	sessions: Map<WebSocket, any>;
	env: Env;
	lastTimestamp: number;
	router: R;
	// @ts-ignore
	requestEvent: RequestEvent;
	ws?: WebSocket;
	topics?: {
		in?: IN;
		out?: OUT;
	};
	constructor(ctx: DurableObjectState, env: Env, router: R, _in?: IN, _out?: OUT) {
		super(ctx, env);

		this.router = router;
		if (_in && _out) {
			this.topics = {
				in: _in,
				out: _out,
			};
		}
		this.state = ctx;
		this.storage = ctx.storage;
		this.env = env;
		this.sessions = new Map();
		this.lastTimestamp = 0;
		this.currentlyConnectedWebSockets = 0;
	}
	async fetch(request: Request) {
		if (request.url === '/connect') {
			const webSocketPair = new WebSocketPair();
			const [client, server] = Object.values(webSocketPair);
			server.accept();
			this.currentlyConnectedWebSockets += 1;
			this.ws = server;
			server.addEventListener('message', (e) => {
				if (e.type === 'ping') {
					server.send('pong');
				} else {
					this.onMessage(e);
				}
			});
			server.addEventListener('open', () => {});

			server.addEventListener(
				'close',
				(cls) => {
					this.currentlyConnectedWebSockets = Math.min(this.currentlyConnectedWebSockets - 1, 0);
					if (this.currentlyConnectedWebSockets === 0) {
						server.close(cls.code, 'Durable Object is closing WebSocket');
					}
				},
				{
					signal: new AbortController().signal,
				},
			);
			server.send('Hello from client');
			return new Response(null, {
				status: 101,
				webSocket: client,
			});
		} else {
			return new Response(null, {
				status: 101,
			});
		}
	}
	async handleRpc(request: Request, locals: Locals | ((request: Request, env: Env, ctx: ExecutionContext) => MaybePromise<Locals>)) {
		try {
			const partialEvent = await createPartialRequestEvent(request, locals, this.env, {} as any);
			const event = createRequestEvent(partialEvent, this.env, {} as any);
			const handler = getHandler(this.router, event.path);
			if (!handler) {
				error('NOT_FOUND');
			} else {
				return handleRequest(event, handler);
			}
		} catch (error) {
			return handleError(error);
		}
	}

	getRouter() {
		return this.router;
	}

	onMessage = (event: MessageEvent) => {
		if ('receive' in this && typeof this.receive === 'function') {
			this.receive(event.type, event.data);
		}
	};
}

export const createHandler = <D extends DurableRouter, R extends Router>(router: R, object: D) => {
	return async <P extends RouterPaths<R>>(
		event: RequestEvent,
		path: P,
		input: InferInputAtPath<R, P>,
	): Promise<InferOutPutAtPath<R, P>> => {
		const handler = getHandler(router, String(path).split('/')) as Handler<any, any, any, any>;
		if (!handler) {
			throw error('NOT_FOUND');
		} else {
			return handler.call(event, input, object) as any;
		}
	};
};
export const createSender = <D extends DurableRouter, E extends Router>(events: E, object: D) => {
	return async <P extends RouterPaths<E>>(path: P, input: InferInputAtPath<E, P>) => {
		const handler = getHandler(events, String(path).split('/')) as Handler<any, any, any, any>;
		const parsedData = await parse(handler?.schema, input);
		const ctx = await handler?.call(object.requestEvent, parsedData, object);
		object.ws?.send(socketify({ type: path, data: parsedData, ctx }));
	};
};

export const createReceiver = <D extends DurableRouter, E extends Router>(events: E, object: D) => {
	return async (path: RouterPaths<E>, input: any) => {
		try {
			const handler = getHandler(events, String(path).split('/')) as Handler<any, any, any, any>;
			const parsedData = await parse(handler?.schema, input);
			await handler?.call(object.requestEvent, parsedData, object);
		} catch (error) {
			if (error instanceof FLARERROR) {
				object.ws?.send(
					socketify({
						type: 'error',
						topic: path,
						error: {
							message: error.message,
							code: error.code,
						},
					}),
				);
			} else {
				object.ws?.send(
					socketify({
						type: 'error',
						topic: path,
						error: JSON.stringify(error, Object.getOwnPropertyNames(error)),
					}),
				);
			}
		}
	};
};
