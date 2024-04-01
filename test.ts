await Promise.all(
	Array.from({ length: 100 }).map(() => {
		return fetch('https://wrpc.uruk.workers.dev/test', {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
			},
			body: JSON.stringify({
				name: 'test',
			}),
		})
			.then((res) => res.text())
			.then(console.log)
			.catch(console.error);
	}),
);
