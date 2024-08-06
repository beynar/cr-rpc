import { DurableObject } from 'cloudflare:workers';
import { Handler } from './procedure';
import {
	DurableServer,
	Env,
	InferInputAtPath,
	InferSchemaOutPutAtPath,
	Locals,
	MaybePromise,
	RegisteredParticipant,
	RequestEvent,
	Router,
	RouterPaths,
} from './types';
import { createPartialRequestEvent, createRequestEvent, getHandler } from './server';
import { parse } from './utils';
import { socketify } from './deform';
import { handleRequest } from './request';
import { error, FLARERROR, handleError } from './error';

type Session = {
	id: string;
	participant: RegisteredParticipant;
	connected: boolean;
	createdAt: number;
	event: RequestEvent;
};

type DurableOptions = {
	getParticipant?: ({
		session,
		event,
		ctx,
		env,
	}: {
		session: Session & { participant: Partial<RegisteredParticipant> };
		event: RequestEvent;
		ctx: DurableObjectState;
		env: Env;
	}) => MaybePromise<Session>;
	beforeAccept?: (session: Session) => MaybePromise<void>;
	onError?: (error: unknown) => void;
};

export const createDurableServer = <_IN extends Router, _OUT extends Router>(opts?: DurableOptions, topicsIn?: _IN, topicsOut?: _OUT) => {
	return class DurableServer<R extends Router = Router, IN extends _IN = _IN, OUT extends _OUT = _OUT> extends DurableObject<any> {
		public ctx: DurableObjectState;
		public env: Env;
		// @ts-ignore
		id: string;
		state: DurableObjectState;
		storage: DurableObjectStorage;
		sessions: Map<WebSocket, Session>;
		lastTimestamp: number;
		// @ts-ignore
		requestEvent: RequestEvent;
		ws?: WebSocket;
		router?: R;
		topicsIn?: IN;
		topicsOut?: OUT;

		constructor(ctx: DurableObjectState, env: Env) {
			super(ctx, env);

			this.state = ctx;
			this.storage = ctx.storage;
			this.env = env;
			this.sessions = new Map();
			this.lastTimestamp = 0;
			this.ctx = ctx;
			this.env = env;
		}

		send = async <P extends RouterPaths<_OUT>>(
			path: P,
			input: InferInputAtPath<_OUT, P>,
			to: 'ALL' | (string & {}) | (string[] & {}) = 'ALL',
		) => {
			if (!topicsOut) {
				throw error('SERVICE_UNAVAILABLE');
			}
			const handler = getHandler(topicsOut, String(path).split('/')) as Handler<any, any, any, any>;
			const parsedData = await parse(handler?.schema, input);
			const ctx = await handler?.call(this.requestEvent, parsedData, this);

			const sessions = Array.from(this.sessions.entries()).filter(([key, value]) => {
				if (value.connected !== true) {
					return false;
				}
				if (to === 'ALL') {
					return true;
				} else {
					return [to].flat().includes(value.participant.id);
				}
			});
			sessions.forEach(([key, value]) => {
				key.send(socketify({ type: path, data: parsedData, ctx }));
			});
		};

		receive = async <P extends RouterPaths<_IN>>(path: P, input: InferInputAtPath<_IN, P>) => {
			if (!topicsIn) {
				throw error('SERVICE_UNAVAILABLE');
			}
			try {
				const handler = getHandler(topicsIn, String(path).split('/')) as Handler<any, any, any, any>;
				const parsedData = await parse(handler?.schema, input);
				await handler?.call(this.requestEvent, parsedData, this);
			} catch (error) {
				// send error somehow
				if (error instanceof FLARERROR) {
				} else {
				}
			}
		};

		async handleRpc(request: Request, locals: Locals | ((request: Request, env: Env, ctx: ExecutionContext) => MaybePromise<Locals>)) {
			if (!this.router) {
				throw error('SERVICE_UNAVAILABLE');
			}
			try {
				this.id = request.headers.get('x-flarepc-object-id') as string;
				const partialEvent = await createPartialRequestEvent(request, locals, this.env, {} as any);
				const event = createRequestEvent(partialEvent, this.env, {} as any);
				const handler = getHandler(this.router, event.path);
				if (!handler) {
					error('NOT_FOUND');
				} else {
					return handleRequest(event, handler, this);
				}
			} catch (error) {
				return handleError(error);
			}
		}
		async handleWebSocket(request: Request, locals: Locals, id: string) {
			this.id = id;
			const partialEvent = await createPartialRequestEvent(request, locals, this.env, {} as any);
			const event = createRequestEvent(partialEvent, this.env, {} as any);
			this.requestEvent = event;
		}
		async fetch(request: Request) {
			try {
				const [client, server] = Object.values(new WebSocketPair());

				const url = new URL(request.url);
				const participant = url.searchParams.get('participant');
				const session = {
					id: crypto.randomUUID(),
					participant: participant ? JSON.parse(participant) : { id: crypto.randomUUID() },
					connected: true,
					event: this.requestEvent,
					createdAt: Date.now(),
				} satisfies Session & { participant: Partial<RegisteredParticipant> };
				session.participant =
					(await opts?.getParticipant?.({ session, event: this.requestEvent, ctx: this.ctx, env: this.env })) || session.participant;
				this.sessions.set(server, session);

				await opts?.beforeAccept?.(session);
				await server.accept();
				this.sendPresence();
				server.addEventListener('close', () => {
					console.log('closing');
					this.sessions.delete(server);
					this.sendPresence();
				});

				server.addEventListener('message', (e) => {
					if (e.data === 'ping') {
						server.send('pong');
					} else {
						this.onMessage(e);
					}
				});

				return new Response(null, {
					status: 101,
					webSocket: client,
				});
			} catch (error) {
				opts?.onError?.(error);
				return handleError(error);
			}
		}

		onMessage = (event: MessageEvent) => {
			if ('receive' in this && typeof this.receive === 'function') {
				this.receive(event.type as any, event.data as any);
			}
		};

		sendPresence = () => {
			const webSockets: WebSocket[] = [];
			const sessions = Array.from(this.sessions.entries())
				.filter(([key, value]) => {
					if (value.connected !== true) {
						return false;
					}
					webSockets.push(key);
					return true;
				})
				.map(([key, value]) => value.participant);

			webSockets.forEach((value) => {
				value.send(socketify({ type: 'presence', data: sessions }));
			});
		};
	};
};
