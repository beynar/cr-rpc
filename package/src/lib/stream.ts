import { type StreamCallbacks, tryParse } from '.';

export const stream = <C>(result: ReadableStream<C>, callbacks?: StreamCallbacks<C>) => {
	const streamReader = result.getReader();
	const chunks: C[] = [];
	let first = true;
	const decoder = new TextDecoder();
	const stream = new ReadableStream({
		start(controller) {
			callbacks?.onStart?.();
			const push = async () => {
				const { done, value } = await streamReader.read();

				if (done) {
					controller.close();
					callbacks?.onEnd?.(chunks);
					return;
				} else if (value) {
					const chunk = tryParse<C>(decoder.decode(value as any));
					chunks.push(chunk);
					callbacks?.onChunk?.({ chunk, first });
					first = false;
				}
				controller.enqueue(value);
				push();
			};
			push();
		},
	});

	return stream as ReadableStream<C>;
};
