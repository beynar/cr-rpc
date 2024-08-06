<script lang="ts">
	import { onMount } from 'svelte';
	import { api } from '../api';
</script>

<div class="grid bg-slate-200 h-screen grid-cols-2 gap-4 p-10">
	<button
		class="shadow-md rounded-lg h-fit bg-white p-4"
		onclick={async () => {
			const result = await api.TestDurable('test').test.test.test({
				name: 'world'
			});
			console.log(result);
		}}
	>
		Test a procedure on the durable object
	</button>
	<button
		class="shadow-md rounded-lg h-fit bg-white p-4"
		onclick={async () => {
			const ws = await api.TestDurable('test').connect({
				messages: {
					message: ({ data, ctx }) => {
						console.log(data);
					}
				}
			});
		}}
	>
		Test connection to websocket
	</button>
</div>
