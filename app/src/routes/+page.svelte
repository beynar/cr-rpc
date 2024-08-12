<script lang="ts">
	import { onMount } from 'svelte';
	import { api, type API } from '../api';

	let ws = $state<API['TestDurable']['ws']>();

	// onMount(async () => {
	// 	const wes = await api.TestDurable('test').connect({
	// 		dedupeConnection: true,
	// 		onError(error) {
	// 			console.log(error);
	// 		},
	// 		onPresence: (data) => {
	// 			console.log('presence', data, 'helleaeazlea');
	// 		},
	// 		handlers: {
	// 			message: ({ data, ctx }) => {
	// 				console.log(data);
	// 			},
	// 			paul: {
	// 				louis: ({ data, ctx }) => {}
	// 			}
	// 		}
	// 	});
	// 	ws = wes;
	// });
</script>

<img src="http://localhost:8080/static/test.png" alt="test" />

<div class="grid bg-slate-200 h-screen grid-cols-2 gap-4 p-10">
	<button
		class="shadow-md rounded-lg h-fit bg-white p-4"
		onclick={async () => {
			const result = await api.TestDurable('test').validators.ark({
				name: 'world',
				platform: 'android',
				versions: ['1', '2', '3']
			});
			console.log(result);
		}}
	>
		Error on ark
	</button>
	<button
		class="shadow-md rounded-lg h-fit bg-white p-4"
		onclick={async () => {
			const result = await api.TestDurable('test').validators.zod({
				name: 'world',
				platform: 'android',
				versions: ['1', '2', '3']
			});
			console.log(result);
		}}
	>
		Error on zod
	</button>
	<button
		class="shadow-md rounded-lg h-fit bg-white p-4"
		onclick={async () => {
			const result = await api.TestDurable('test').validators.valibot({
				name: 'world',
				platform: 'android',
				versions: ['1', '2', '3']
			});
			console.log(result);
		}}
	>
		Error on valibot
	</button>
	<button
		class="shadow-md rounded-lg h-fit bg-white p-4"
		onclick={async () => {
			const result = await api.TestDurable('test').ai('coucou', ({ chunk }) => {
				console.log(chunk.choices[0].delta.content);
			});
		}}
	>
		Test ai stream output
	</button>
	<button
		class="shadow-md rounded-lg h-fit bg-white p-4"
		onclick={async () => {
			const result = await api.text('wcacaorld');
			console.log(result);
		}}
	>
		Test a normal procedure on the worker
	</button>
	<button
		class="shadow-md rounded-lg h-fit bg-white p-4"
		onclick={async () => {
			const result = await api.TestDurable('test').test.test.test({
				name: 'world'
			});
			console.log(result);
		}}
	>
		Test a normal procedure on the object
	</button>
	{#if ws}
		<button
			class="shadow-md rounded-lg h-fit bg-white p-4"
			onclick={async () => {
				const date = Date.now();
				ws?.send.message({ message: date.toString() });
			}}
		>
			send message
		</button>
	{/if}
</div>
