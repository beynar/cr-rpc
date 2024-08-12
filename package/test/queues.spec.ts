import { it, expect } from 'vitest';
import { QueueApi, createRecursiveProxy, queueProcedure } from '../src/lib';
import { array, object, string } from 'valibot';

const queueRouter = {
	test: {
		test: queueProcedure()
			.input(
				object({
					name: string(),
					data: array(string()),
				}),
			)
			.handle(async ({ input }) => {
				return {
					hello: input,
				};
			}),
	},
};

type Queues = {
	test: typeof queueRouter;
};

const createBatches = (data: string[]) => {
	const maxItemsPerBatch = 100;
	const maxTotalSizePerBatch = 256 * 1024;

	let batches: string[][] = [];
	let currentBatch: string[] = [];
	let currentBatchSize = 0;

	for (const item of data) {
		if (currentBatchSize + item.length >= maxTotalSizePerBatch || currentBatch.length >= maxItemsPerBatch) {
			batches.push(currentBatch);
			currentBatch = [];
			currentBatchSize = 0;
		} else {
			currentBatch.push(item);
			currentBatchSize += item.length;
		}
	}
	if (currentBatch.length > 0) {
		batches.push(currentBatch);
	}

	return batches;
};

it('Should create batches of 100 items', async () => {
	const array = new Array(10000).fill(0).map((_, i) => `${i}`);
	const batches = createBatches(array);

	expect(batches.length).toBe(10000 / 100);
});

const send = <Q extends keyof Queues>(queueName: Q) => {
	return createRecursiveProxy(({ type, data, opts }) => {
		return {
			type,
			data,
			opts,
		};
	}) as QueueApi<Queues[Q]>;
};

it('Should build the path correctly', async () => {
	const result = await send('test').test.test.send(
		{
			name: 'world',
			data: ['hello', 'world'],
		},
		2,
	);
	console.log(result);
	expect(result).toEqual({
		type: 'test.test.send',
		data: {
			name: 'world',
			data: ['hello', 'world'],
		},
		opts: 2,
	});
});
