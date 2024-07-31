import { deform, form } from './deform';
import { Handler } from './procedure';
import { Env, RequestEvent } from './types';
import { parse } from './utils';

export const handleRequest = async (event: RequestEvent, handler: Handler<any, any, any, any>) => {
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
		result = await handler.call(event, parse(handler.schema, requestData));

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
