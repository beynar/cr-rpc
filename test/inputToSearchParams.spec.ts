import { describe, it, expect } from 'vitest';
import { inputToSearchParams, searchParamsToInput } from '../src/lib/utils';

it('Should transform an object back and forth between input and search params', async () => {
	const input = {
		string: 'world',
		date: new Date(),
		undefined: undefined,
		null: null,
		number: 1,
		boolean: true,
		object: {
			string: 'world',
			date: new Date(),
			undefined: undefined,
			null: null,
			number: 1,
			boolean: true,
		},
		array: ['string', undefined, null, 1],
	};
	const toSearchParams = inputToSearchParams(input);
	const fromSearchParams = searchParamsToInput(new URLSearchParams(toSearchParams));
	expect(input).toEqual(fromSearchParams);
});

it('Should transform an simple string back and forth between input and search params', async () => {
	const input = 'hello';
	const toSearchParams = inputToSearchParams(input);
	const fromSearchParams = searchParamsToInput(new URLSearchParams(toSearchParams));
	expect(input).toEqual(fromSearchParams);
});
it('Should transform an simple number back and forth between input and search params', async () => {
	const input = 1;
	const toSearchParams = inputToSearchParams(input);
	const fromSearchParams = searchParamsToInput(new URLSearchParams(toSearchParams));
	expect(input).toEqual(fromSearchParams);
});
it('Should transform an simple boolean back and forth between input and search params', async () => {
	const input = true;
	const toSearchParams = inputToSearchParams(input);
	const fromSearchParams = searchParamsToInput(new URLSearchParams(toSearchParams));
	expect(input).toEqual(fromSearchParams);
});
it('Should transform an simple undefined back and forth between input and search params', async () => {
	const input = undefined;
	const toSearchParams = inputToSearchParams(input);
	const fromSearchParams = searchParamsToInput(new URLSearchParams(toSearchParams));
	expect(input).toEqual(fromSearchParams);
});
it('Should transform an simple null back and forth between input and search params', async () => {
	const input = null;
	const toSearchParams = inputToSearchParams(input);
	const fromSearchParams = searchParamsToInput(new URLSearchParams(toSearchParams));
	expect(input).toEqual(fromSearchParams);
});
it('Should transform an simple date back and forth between input and search params', async () => {
	const input = new Date();
	const toSearchParams = inputToSearchParams(input);
	const fromSearchParams = searchParamsToInput(new URLSearchParams(toSearchParams));
	expect(input).toEqual(fromSearchParams);
});
