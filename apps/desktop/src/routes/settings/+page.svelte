<script lang="ts">
  import { goto } from '$app/navigation';
</script>

<div class="settings-container">
  <div class="settings-card">
    <h1>Settings</h1>
    <p class="subtitle">Settings page coming soon.</p>
    <button class="btn-back" onclick={() => goto('/')}>Back to app</button>
  </div>
</div>

<style>
  .settings-container {
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .settings-card {
    width: 600px;
    background: var(--bg-glass-heavy, rgba(28, 28, 30, 0.65));
    backdrop-filter: blur(40px);
    -webkit-backdrop-filter: blur(40px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 18px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.4);
    padding: 32px;
  }

  h1 {
    font-size: 24px;
    font-weight: 700;
    margin-bottom: 8px;
  }

  .subtitle {
    color: rgba(235, 235, 245, 0.6);
    margin-bottom: 24px;
  }

  .btn-back {
    padding: 10px 20px;
    background: var(--bg-glass-light, rgba(44, 44, 46, 0.4));
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    font-size: 15px;
    font-family: inherit;
    cursor: pointer;
    transition: background 0.2s;
  }

  .btn-back:hover {
    background: var(--bg-glass-lighter, rgba(58, 58, 60, 0.3));
  }
</style>
