import { parse, RequestEvent, formiparse, formify, Handler, DurableRequestEvent, Router, getHandler, handleError, error } from '.';

export const handleRequest = async (event: DurableRequestEvent | RequestEvent, router?: Router) => {
	try {
		if (!router) {
			throw error('SERVICE_UNAVAILABLE');
		}
		const handler = getHandler(router, event.path);
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
					? formiparse(await request.formData())
					: await request.json();

		if (handler && 'call' in handler) {
			result = await handler.call(event as any, parse(handler.schema, requestData));
			if (result instanceof Response) {
				return result;
			}

			if (result?.constructor.name === 'ReadableStream') {
				headers['Content-Type'] = 'text/event-stream';
			} else if (result && result instanceof File) {
				headers = {
					'Content-Type': result.type,
					'Content-Disposition': 'attachment; filename=' + result.name,
				};
			} else {
				if (isClientRequest) {
					delete headers['Content-Type'];
				}

				result = isClientRequest ? formify(result) : JSON.stringify(result);
			}
		}
		return new Response(result, { headers, status: 200 });
	} catch (error) {
		return handleError(error);
	}
};
