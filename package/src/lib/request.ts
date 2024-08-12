import {
	parse,
	Env,
	Locals,
	MaybePromise,
	RequestEvent,
	createCookies,
	deform,
	Handler,
	DurableRequestEvent,
	form,
	ObjectInfo,
	Cookies,
	Queues,
	StaticHandler,
	QueueRequestEvent,
	QueueHandler,
} from '.';

const getPathAndUrl = (request: Request, isObject: boolean) => {
	const url = new URL(request.url);
	let path = url.pathname.split('/').filter(Boolean);
	const method = request.method;
	if (method !== 'POST' && !isObject) {
		path.push(method.toLocaleLowerCase());
	}
	if (isObject) {
		path = path.slice(1);
	}
	return [path, url] as const;
};

export async function createRequestEvent(
	request: Request,
	env: Env,
	ctx: ExecutionContext,
	object: ObjectInfo | undefined,
	queues?: Queues,
	locals?: Locals | ((request: Request, env: Env, ctx: ExecutionContext) => MaybePromise<Locals>),
): Promise<RequestEvent> {
	const [path, url] = getPathAndUrl(request, false);
	return Object.assign(ctx, env, {
		path,
		locals: typeof locals === 'function' ? await locals(request, env, ctx) : locals,
		queue: new QueueHandler(env, ctx, queues).send,
		request,
		static: new StaticHandler(env, ctx),
		object,
		url,
		cookies: createCookies(request),
	});
}

export const createDurableRequestEvent = (request: Request, env: Env, ctx: DurableObjectState, object: ObjectInfo): DurableRequestEvent => {
	const [path, url] = getPathAndUrl(request, true);
	return {
		path,
		object,
		static: new StaticHandler(env, ctx),
		request,
		url,
		cookies: new Cookies(request),
	};
};

export const createQueueRequestEvent = (
	batch: MessageBatch,
	path: string[],
	message: Message<unknown>,
	ctx: ExecutionContext,
	env: Env,
	object: ObjectInfo,
	locals?: Locals,
): QueueRequestEvent => {
	return Object.assign(
		{
			waitUntil: ctx.waitUntil.bind(ctx),
			passThroughOnException: ctx.passThroughOnException.bind(ctx),
		},
		env,
		{
			path,
			static: new StaticHandler(env, ctx),
			batch,
			message,
			object,
			locals,
		},
	);
};

export const handleRequest = async (event: DurableRequestEvent | RequestEvent, handler: Handler<any, any, any, any>, object?: any) => {
	const request = event.request;
	const url = event.url;
	const method = event.request.method;
	const isClientRequest = event.request.headers.get('x-flarepc-client') === 'true';
	let result: string | File | FormData | ReadableStream = JSON.stringify({
		error: {
			message: 'Not Found',
		},
	});
	let headers: Record<string, string> = { 'Content-Type': 'application/json' };

	const requestData =
		method === 'GET'
			? JSON.parse(decodeURIComponent(new URLSearchParams(url.search).get('input') || '{}'))
			: isClientRequest
				? deform(await request.formData())
				: await request.json();

	if (handler && 'call' in handler) {
		result = await handler.call(event as any, parse(handler.schema, requestData), object);

		if (result?.constructor.name === 'ReadableStream') {
			headers['Content-Type'] = 'text/event-stream';
		} else if (result && result instanceof File) {
			headers = {
				'Content-Type': result.type,
				'Content-Disposition': 'attachment; filename=' + result.name,
			};
		} else {
			if (!isClientRequest) {
				headers = {
					'Content-Type': 'application/json',
				};
			} else {
				delete headers['Content-Type'];
			}
			result = isClientRequest ? form(result) : JSON.stringify(result);
		}
	}
	return new Response(result, { headers, status: 200 });
};
