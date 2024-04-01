import { describe, it, expect } from 'vitest';
import { formDataToJson, jsonToFormData, inputToSearchParams, searchParamsToInput } from '../src/lib/utils';

it('Should transform an object back and forth between input and formData', async () => {
	const input = {
		string: 'world',
		date: new Date(),
		number: 1,
		undefined: undefined,
		null: null,
		boolean: true,
		file: new File(['hello'], 'hello.txt'),
		object: {
			string: 'world',
			date: new Date(),
			number: 1,

			undefined: undefined,
			null: null,
			file: new File(['hello'], 'hello.txt'),
			boolean: true,
		},
		array: ['string', undefined, null, 1],
	};

	const toFormData = jsonToFormData(input);
	const fromFormData = formDataToJson(toFormData);
	console.log({ fromFormData });
	expect(input).toEqual(fromFormData);
});
it('Should transform a simple string back and forth between input and formData', async () => {
	const input = 'hello';
	const toFormData = jsonToFormData(input);
	const fromFormData = formDataToJson(toFormData);
	expect(input).toEqual(fromFormData);
});
it('Should transform a simple number back and forth between input and formData', async () => {
	const input = 1;
	const toFormData = jsonToFormData(input);
	const fromFormData = formDataToJson(toFormData);
	expect(input).toEqual(fromFormData);
});
it('Should transform a simple boolean back and forth between input and formData', async () => {
	const input = true;
	const toFormData = jsonToFormData(input);
	const fromFormData = formDataToJson(toFormData);
	expect(input).toEqual(fromFormData);
});
it('Should transform a simple undefined back and forth between input and formData', async () => {
	const input = undefined;
	const toFormData = jsonToFormData(input);
	const fromFormData = formDataToJson(toFormData);
	expect(input).toEqual(fromFormData);
});
it('Should transform a simple null back and forth between input and formData', async () => {
	const input = null;
	const toFormData = jsonToFormData(input);
	const fromFormData = formDataToJson(toFormData);
	expect(input).toEqual(fromFormData);
});
it('Should transform a simple date back and forth between input and formData', async () => {
	const input = new Date();
	const toFormData = jsonToFormData(input);
	const fromFormData = formDataToJson(toFormData);
	expect(input).toEqual(fromFormData);
});
it('Should transform a simple file back and forth between input and formData', async () => {
	const input = new File(['hello'], 'hello.txt');
	const toFormData = jsonToFormData(input);
	const fromFormData = formDataToJson(toFormData);
	expect(input).toEqual(fromFormData);
});
