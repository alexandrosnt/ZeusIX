<script lang="ts">
	import { goto } from '$app/navigation';
	import { authStore } from '$lib/stores/auth.svelte';
	import { login, register } from '$lib/services/api';

	let mode = $state<'login' | 'register'>('login');
	let direction = $state<'left' | 'right'>('right');

	// Login fields
	let loginEmail = $state('');
	let loginPassword = $state('');

	// Register fields
	let regEmail = $state('');
	let regUsername = $state('');
	let regPassword = $state('');
	let regDobDay = $state('');
	let regDobMonth = $state('');
	let regDobYear = $state('');

	let error = $state('');
	let loading = $state(false);
	let success = $state(false);

	function toggleMode(target: 'login' | 'register') {
		if (target === mode) return;
		direction = target === 'register' ? 'left' : 'right';
		error = '';
		success = false;
		mode = target;
	}

	async function handleLogin(e: SubmitEvent) {
		e.preventDefault();
		if (!loginEmail || !loginPassword) {
			error = 'Please fill in all fields';
			return;
		}
		loading = true;
		error = '';
		try {
			const result = await login(loginEmail, loginPassword);
			success = true;
			setTimeout(() => {
				authStore.login(result.user, result.token);
				goto('/');
			}, 800);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Login failed. Please try again.';
		} finally {
			loading = false;
		}
	}

	async function handleRegister(e: SubmitEvent) {
		e.preventDefault();
		if (!regEmail || !regUsername || !regPassword) {
			error = 'Please fill in all fields';
			return;
		}
		if (regPassword.length < 8) {
			error = 'Password must be at least 8 characters';
			return;
		}
		loading = true;
		error = '';
		try {
			const result = await register(regUsername, regEmail, regPassword);
			success = true;
			setTimeout(() => {
				authStore.login(result.user, result.token);
				goto('/');
			}, 800);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Registration failed. Please try again.';
		} finally {
			loading = false;
		}
	}
</script>

<div class="auth-card" class:wide={mode === 'login'}>
	<!-- Left side: Form -->
	<div class="form-side">
		<!-- Logo -->
		<div class="brand-logo">
			<svg width="32" height="32" viewBox="0 0 64 64" fill="none">
				<path d="M36.5 4L14 36h14l-4 24L46 28H32l4.5-24z" fill="white" />
			</svg>
		</div>

		<h1 class="title">
			{mode === 'login' ? 'Welcome Back!' : 'Create an Account'}
		</h1>
		<p class="subtitle">
			{mode === 'login' ? "We're so excited to see you again!" : 'Join the next generation server.'}
		</p>

		{#if error}
			<div class="error-banner">{error}</div>
		{/if}

		<div class="forms-wrapper">
			<!-- Login form -->
			<form
				class="auth-form"
				class:active={mode === 'login'}
				class:exit-left={mode === 'register' && direction === 'left'}
				onsubmit={handleLogin}
			>
				<div class="input-group">
					<label class="input-label" for="login-email">Email or Phone</label>
					<input
						id="login-email"
						type="text"
						class="input-field"
						placeholder="steve@apple.com"
						bind:value={loginEmail}
						autocomplete="email"
					/>
				</div>

				<div class="input-group">
					<label class="input-label" for="login-password">Password</label>
					<input
						id="login-password"
						type="password"
						class="input-field"
						placeholder="••••••••••••"
						bind:value={loginPassword}
						autocomplete="current-password"
					/>
					<div class="forgot-row">
						<a href="/forgot-password" class="link">Forgot password?</a>
					</div>
				</div>

				<button
					type="submit"
					class="btn-primary"
					class:btn-success={success}
					disabled={loading || success}
				>
					{#if success}Success{:else if loading}Authenticating...{:else}Log In{/if}
				</button>

				<p class="toggle-text">
					Need an account?
					<button type="button" class="link" onclick={() => toggleMode('register')}>Register</button>
				</p>
			</form>

			<!-- Register form -->
			<form
				class="auth-form"
				class:active={mode === 'register'}
				class:exit-right={mode === 'login' && direction === 'right'}
				onsubmit={handleRegister}
			>
				<div class="input-group">
					<label class="input-label" for="reg-email">Email</label>
					<input
						id="reg-email"
						type="email"
						class="input-field"
						placeholder="name@example.com"
						bind:value={regEmail}
						autocomplete="email"
					/>
				</div>

				<div class="input-group">
					<label class="input-label" for="reg-username">Username</label>
					<input
						id="reg-username"
						type="text"
						class="input-field"
						placeholder="DesignGod"
						bind:value={regUsername}
						autocomplete="username"
					/>
				</div>

				<div class="input-group">
					<label class="input-label" for="reg-password">Password</label>
					<input
						id="reg-password"
						type="password"
						class="input-field"
						placeholder="Create a strong password"
						bind:value={regPassword}
						autocomplete="new-password"
					/>
				</div>

				<div class="input-group">
					<label class="input-label" for="reg-dob-day">Date of Birth</label>
					<div class="dob-row">
						<input id="reg-dob-day" type="number" class="input-field dob" placeholder="DD" bind:value={regDobDay} />
						<input type="number" class="input-field dob" placeholder="MM" bind:value={regDobMonth} />
						<input type="number" class="input-field dob-year" placeholder="YYYY" bind:value={regDobYear} />
					</div>
				</div>

				<button
					type="submit"
					class="btn-primary"
					class:btn-success={success}
					disabled={loading || success}
				>
					{#if success}Success{:else if loading}Creating account...{:else}Continue{/if}
				</button>

				<p class="toggle-text">
					Already have an account?
					<button type="button" class="link" onclick={() => toggleMode('login')}>Log In</button>
				</p>
			</form>
		</div>
	</div>

	<!-- Right side: QR Code (login only) -->
	{#if mode === 'login'}
		<div class="qr-side">
			<div class="qr-divider"></div>
			<div class="qr-content">
				<div class="qr-preview">
					<img
						src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=ZeusIXLogin"
						width="100%"
						height="100%"
						alt="QR Code"
					/>
				</div>
				<h3 class="qr-title">Log in with QR Code</h3>
				<p class="qr-desc">Scan this with the <strong>ZeusIX mobile app</strong> to log in instantly.</p>
			</div>
		</div>
	{/if}
</div>

<style>
	.auth-card {
		display: flex;
		background: rgba(var(--glass-heavy-rgb, 28, 28, 30), 0.65);
		backdrop-filter: blur(50px) saturate(180%);
		-webkit-backdrop-filter: blur(50px) saturate(180%);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 24px;
		box-shadow: 0 40px 80px rgba(0, 0, 0, 0.5);
		overflow: hidden;
		transition: width 0.4s cubic-bezier(0.25, 1, 0.5, 1);
		animation: cardIn 0.5s ease-out;
	}

	.auth-card.wide {
		width: 780px;
	}

	.auth-card:not(.wide) {
		width: 440px;
	}

	/* --- LEFT: Form Side --- */
	.form-side {
		flex: 1;
		padding: 40px;
		display: flex;
		flex-direction: column;
		align-items: center;
		min-width: 0;
	}

	.brand-logo {
		width: 64px;
		height: 64px;
		background: linear-gradient(135deg, var(--accent-blue, #0a84ff), #BF5AF2);
		border-radius: 18px;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 10px 20px rgba(var(--accent-rgb, 10, 132, 255), 0.3);
		margin-bottom: 24px;
		flex-shrink: 0;
	}

	.title {
		font-size: 28px;
		font-weight: 700;
		color: white;
		margin-bottom: 8px;
		letter-spacing: -0.5px;
		text-align: center;
	}

	.subtitle {
		font-size: 15px;
		color: rgba(235, 235, 245, 0.6);
		margin-bottom: 32px;
		text-align: center;
		line-height: 1.4;
	}

	.error-banner {
		width: 100%;
		background: rgba(255, 69, 58, 0.1);
		border: 1px solid rgba(255, 69, 58, 0.2);
		border-radius: 14px;
		color: #FF453A;
		padding: 10px 14px;
		font-size: 13px;
		margin-bottom: 16px;
	}

	/* --- Forms --- */
	.forms-wrapper {
		width: 100%;
		position: relative;
	}

	.auth-form {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 20px;
		transition: all 0.4s cubic-bezier(0.25, 1, 0.5, 1);
		position: absolute;
		top: 0;
		left: 0;
		opacity: 0;
		transform: translateX(40px) scale(0.95);
		pointer-events: none;
	}

	.auth-form.active {
		position: relative;
		opacity: 1;
		transform: translateX(0) scale(1);
		pointer-events: all;
	}

	.auth-form.exit-left {
		transform: translateX(-40px) scale(0.95);
	}

	.auth-form.exit-right {
		transform: translateX(40px) scale(0.95);
	}

	/* --- Inputs --- */
	.input-group { position: relative; }

	.input-label {
		display: block;
		font-size: 12px;
		font-weight: 600;
		color: rgba(235, 235, 245, 0.6);
		margin-bottom: 8px;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		margin-left: 4px;
	}

	.input-field {
		width: 100%;
		height: 50px;
		background: rgba(0, 0, 0, 0.4);
		border: 1px solid transparent;
		border-radius: 14px;
		padding: 0 16px;
		color: white;
		font-size: 17px;
		font-family: var(--font-stack);
		transition: all 0.2s;
		box-sizing: border-box;
	}

	.input-field:focus {
		outline: none;
		background: rgba(0, 0, 0, 0.6);
		border-color: var(--accent-blue, #0a84ff);
		box-shadow: 0 0 0 4px rgba(var(--accent-rgb, 10, 132, 255), 0.4);
	}

	.input-field::placeholder {
		color: rgba(255, 255, 255, 0.2);
	}

	.forgot-row {
		text-align: right;
		margin-top: 6px;
	}

	.forgot-row .link { font-size: 12px; }

	.dob-row {
		display: flex;
		gap: 10px;
	}

	.dob { width: 80px; text-align: center; }
	.dob-year { flex: 1; text-align: center; }

	/* --- Button --- */
	.btn-primary {
		width: 100%;
		height: 50px;
		background: var(--accent-blue, #0a84ff);
		border: none;
		border-radius: 14px;
		color: white;
		font-size: 16px;
		font-weight: 600;
		font-family: var(--font-stack);
		cursor: pointer;
		margin-top: 10px;
		transition: transform 0.1s, background 0.2s, opacity 0.2s;
		box-shadow: 0 4px 12px rgba(var(--accent-rgb, 10, 132, 255), 0.3);
	}

	.btn-primary:hover:not(:disabled) { background: #0077ED; }
	.btn-primary:active:not(:disabled) { transform: scale(0.98); }
	.btn-primary:disabled { opacity: 0.7; cursor: not-allowed; }
	.btn-success { background: #30D158 !important; box-shadow: 0 4px 12px rgba(48, 209, 88, 0.3); }

	.toggle-text {
		margin-top: 4px;
		font-size: 14px;
		color: rgba(235, 235, 245, 0.6);
		text-align: center;
	}

	.link {
		color: var(--accent-blue, #0a84ff);
		font-weight: 500;
		cursor: pointer;
		text-decoration: none;
		transition: opacity 0.2s;
		background: none;
		border: none;
		font-size: inherit;
		font-family: inherit;
		padding: 0;
	}

	.link:hover { opacity: 0.8; }

	/* --- RIGHT: QR Side --- */
	.qr-side {
		width: 300px;
		display: flex;
		align-items: center;
		position: relative;
		flex-shrink: 0;
		animation: qrSlideIn 0.4s cubic-bezier(0.25, 1, 0.5, 1);
	}

	.qr-divider {
		position: absolute;
		left: 0;
		top: 40px;
		bottom: 40px;
		width: 1px;
		background: rgba(255, 255, 255, 0.1);
	}

	.qr-content {
		padding: 40px 36px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
		text-align: center;
	}

	.qr-preview {
		width: 160px;
		height: 160px;
		background: white;
		border-radius: 16px;
		padding: 10px;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
	}

	.qr-preview img {
		border-radius: 6px;
	}

	.qr-title {
		font-size: 16px;
		font-weight: 600;
		color: white;
		margin: 0;
	}

	.qr-desc {
		font-size: 13px;
		color: rgba(235, 235, 245, 0.5);
		line-height: 1.5;
		margin: 0;
	}

	.qr-desc strong {
		color: rgba(235, 235, 245, 0.7);
	}

	/* --- Animations --- */
	@keyframes cardIn {
		from {
			opacity: 0;
			transform: scale(0.95) translateY(10px);
		}
		to {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
	}

	@keyframes qrSlideIn {
		from {
			opacity: 0;
			transform: translateX(20px);
		}
		to {
			opacity: 1;
			transform: translateX(0);
		}
	}
</style>
