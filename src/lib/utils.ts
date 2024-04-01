import { stringify, parse } from 'devalue';
export const tryParse = <C>(data: unknown) => {
	try {
		return (typeof data !== 'string' ? data : JSON.parse(data)) as C;
	} catch (e) {
		return data as C;
	}
};

export const jsonToFormData = (data: unknown, key = 'input') => {
	let i = 0;
	const formData = new FormData();
	const stringifiedValue = stringify(
		{ [key]: data },
		{
			File: (value) => {
				if (value instanceof File) {
					const fileKey = `#FILE_${i}_FILE#`;
					formData.set(fileKey, value);
					i++;
					return fileKey;
				}
			},
		},
	);
	formData.set(key, stringifiedValue);
	return formData;
};
export const formDataToJson = (formData: FormData, key = 'input') => {
	return parse(formData.get(key) as string, {
		File: (value) => {
			return formData.get(value) as File;
		},
	})[key];
};

export const inputToSearchParams = (input: unknown) => {
	return `input=${encodeURIComponent(
		stringify(input, {
			File: (value) => {
				if (value instanceof File) {
					return 'file';
				}
			},
		}),
	)}`;
};

export const searchParamsToInput = (searchParams: URLSearchParams) => {
	return parse(decodeURIComponent(searchParams.get('input') || '{}'), {
		File: (value) => {
			return 'file';
		},
	});
};
