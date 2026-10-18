<script lang="ts">
  import { Router, Route } from 'svelte-routing'
  import HomePage from './pages/HomePage.svelte'
  import GamePage from './pages/GamePage.svelte'
</script>

<div class="min-w-[1280px] min-h-[720px] bg-gray-50">
  <Router>
    <Route path="/">
      <HomePage />
    </Route>
    <Route path="/game">
      <GamePage />
    </Route>
  </Router>
</div>

<style>
  :root {
    --min-width: 1280px;
    --min-height: 720px;
  }
</style>