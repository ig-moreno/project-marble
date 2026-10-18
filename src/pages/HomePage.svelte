<script lang="ts">
  import { Link } from 'svelte-routing'
</script>

<div class="flex min-h-screen flex-col items-center justify-center px-4">
  <div class="text-center">
    <h1 class="mb-8 text-4xl font-bold text-gray-900">Project Marble</h1>
    <p class="mb-8 text-lg text-gray-600">
      Bienvenido al juego. Haz clic en el botón para comenzar.
    </p>
    <Link to="/game" class="rounded-lg bg-purple-600 px-8 py-3 text-white font-medium hover:bg-purple-700 transition-colors">
      Comenzar Juego
    </Link>
  </div>
</div>