<template>
  <section class="custom-hero">
    <div class="hero-content">
      <h1 class="hero-heading">
        <span class="heading-line heading-static">Run your</span>
        <span class="heading-line">
          <span class="rotating-text-wrapper">
            <Transition name="rotate-word" mode="out-in">
              <span class="rotating-word" :key="currentWord">{{ words[currentIndex] }}</span>
            </Transition>
          </span>
        </span>
        <span class="heading-line heading-static">With No Hassle</span>
      </h1>

      <p class="hero-tagline">
        Enterprise-grade DDoS protection for any workload. Install in under 60 seconds.
      </p>

      <div class="hero-buttons">
        <a href="#features" class="btn btn-primary">Premium Features</a>
        <a href="https://pingless.org" class="btn btn-outline">View Plans</a>
      </div>
    </div>

    <div class="orbit-container">
      <div class="orbit orbit-1">
        <div class="orbit-dot dot-1"></div>
        <div class="orbit-dot dot-2"></div>
        <div class="orbit-dot dot-3"></div>
      </div>
      <div class="orbit orbit-2">
        <div class="orbit-dot dot-4"></div>
        <div class="orbit-dot dot-5"></div>
        <div class="orbit-dot dot-6"></div>
      </div>
      <div class="orbit orbit-3">
        <div class="orbit-dot dot-7"></div>
        <div class="orbit-dot dot-8"></div>
        <div class="orbit-dot dot-9"></div>
      </div>
      <div class="orbit-center">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/>
          <path d="M2 17l10 5 10-5"/>
          <path d="M2 12l10 5 10-5"/>
        </svg>
      </div>
      <div class="orbit orbit-3 orbit-reverse">
        <div class="orbit-dot dot-10"></div>
        <div class="orbit-dot dot-11"></div>
        <div class="orbit-dot dot-12"></div>
      </div>
      <div class="orbit orbit-4">
        <div class="orbit-dot dot-13"></div>
        <div class="orbit-dot dot-14"></div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const words = [
  'Minecraft Server',
  'Game Server',
  'VPS Hosting',
  'Bare Metal',
  'Website',
  'GRE Tunnel',
  'API Backend',
  'Database',
  'Docker Host',
  'FiveM Server',
  'Reverse Proxy',
  'Kubernetes Pod',
]

const currentIndex = ref(0)
let interval: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  interval = setInterval(() => {
    currentIndex.value = (currentIndex.value + 1) % words.length
  }, 2500)
})

onUnmounted(() => {
  if (interval) clearInterval(interval)
})
</script>

<style scoped>
.custom-hero {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - 64px);
  padding: 4rem 1.5rem 2rem;
  text-align: center;
  background: #0a0a0f;
  overflow: hidden;
}

.hero-content {
  position: relative;
  z-index: 2;
  max-width: 800px;
}

.hero-heading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  font-size: clamp(2rem, 5vw, 4rem);
  font-weight: 800;
  line-height: 1.15;
  letter-spacing: -0.02em;
  margin-bottom: 1.5rem;
}

.heading-line {
  display: block;
}

.heading-static {
  color: #E2E8F0;
}

.rotating-text-wrapper {
  display: inline-block;
  min-width: 280px;
  text-align: center;
}

.rotating-word {
  display: inline-block;
  color: #8B5CF6;
  background: linear-gradient(135deg, #8B5CF6 0%, #A855F7 50%, #C084FC 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

/* Rotating text transition */
.rotate-word-enter-active,
.rotate-word-leave-active {
  transition: all 0.35s ease;
}

.rotate-word-enter-from {
  opacity: 0;
  transform: translateY(12px);
  filter: blur(4px);
}

.rotate-word-leave-to {
  opacity: 0;
  transform: translateY(-12px);
  filter: blur(4px);
}

.hero-tagline {
  color: #94A3B8;
  font-size: clamp(0.95rem, 1.5vw, 1.15rem);
  line-height: 1.7;
  max-width: 560px;
  margin: 0 auto 2rem;
}

.hero-buttons {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.75rem 1.75rem;
  font-size: 0.95rem;
  font-weight: 600;
  border-radius: 9999px;
  text-decoration: none;
  transition: all 0.25s ease;
  cursor: pointer;
}

.btn-primary {
  background: linear-gradient(135deg, #8B5CF6 0%, #A855F7 100%);
  color: #fff;
  box-shadow: 0 0 24px rgba(139, 92, 246, 0.35);
}

.btn-primary:hover {
  box-shadow: 0 0 36px rgba(139, 92, 246, 0.55);
  transform: translateY(-1px);
}

.btn-outline {
  border: 1.5px solid rgba(139, 92, 246, 0.5);
  color: #E2E8F0;
  background: transparent;
}

.btn-outline:hover {
  border-color: #8B5CF6;
  background: rgba(139, 92, 246, 0.1);
  transform: translateY(-1px);
}

/* ─── ORBIT ANIMATION ─── */

.orbit-container {
  position: relative;
  width: 320px;
  height: 320px;
  margin-top: 3rem;
  z-index: 1;
  flex-shrink: 0;
}

.orbit {
  position: absolute;
  top: 50%;
  left: 50%;
  border: 1px solid rgba(139, 92, 246, 0.15);
  border-radius: 50%;
  transform: translate(-50%, -50%);
}

.orbit-1 {
  width: 100%;
  height: 100%;
  animation: spin 18s linear infinite;
}

.orbit-2 {
  width: 72%;
  height: 72%;
  animation: spin 14s linear infinite reverse;
}

.orbit-3 {
  width: 48%;
  height: 48%;
  animation: spin 11s linear infinite;
}

.orbit-reverse {
  width: 48%;
  height: 48%;
  animation: spin 11s linear infinite reverse;
}

.orbit-4 {
  width: 26%;
  height: 26%;
  animation: spin 9s linear infinite;
}

@keyframes spin {
  from { transform: translate(-50%, -50%) rotate(0deg); }
  to   { transform: translate(-50%, -50%) rotate(360deg); }
}

.orbit-dot {
  position: absolute;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #8B5CF6;
  box-shadow: 0 0 8px rgba(139, 92, 246, 0.6), 0 0 16px rgba(139, 92, 246, 0.3);
}

/* Orbit 1 dots (outermost) */
.orbit-1 .dot-1 { top: 0; left: 50%; transform: translate(-50%, -50%); }
.orbit-1 .dot-2 { bottom: 0; left: 50%; transform: translate(-50%, 50%); }
.orbit-1 .dot-3 { top: 50%; right: 0; transform: translate(50%, -50%); }

/* Orbit 2 dots */
.orbit-2 .dot-4 { top: 0; left: 50%; transform: translate(-50%, -50%); background: #A855F7; }
.orbit-2 .dot-5 { bottom: 0; left: 50%; transform: translate(-50%, 50%); background: #A855F7; }
.orbit-2 .dot-6 { top: 50%; left: 0; transform: translate(-50%, -50%); background: #A855F7; }

/* Orbit 3 dots */
.orbit-3 .dot-7 { top: 0; left: 50%; transform: translate(-50%, -50%); background: #C084FC; }
.orbit-3 .dot-8 { bottom: 15%; right: 10%; transform: translate(50%, 50%); background: #C084FC; }
.orbit-3 .dot-9 { top: 15%; left: 10%; transform: translate(-50%, -50%); background: #C084FC; }

/* Orbit reverse dots */
.orbit-reverse .dot-10 { top: 0; left: 50%; transform: translate(-50%, -50%); background: #7C3AED; }
.orbit-reverse .dot-11 { bottom: 0; left: 50%; transform: translate(-50%, 50%); background: #7C3AED; }
.orbit-reverse .dot-12 { top: 50%; right: 0; transform: translate(50%, -50%); background: #7C3AED; }

/* Orbit 4 dots (innermost) */
.orbit-4 .dot-13 { top: 0; left: 50%; transform: translate(-50%, -50%); background: #C084FC; }
.orbit-4 .dot-14 { bottom: 0; left: 50%; transform: translate(-50%, 50%); background: #C084FC; }

.orbit-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 2;
  animation: pulse-glow 3s ease-in-out infinite;
}

@keyframes pulse-glow {
  0%, 100% { opacity: 0.6; transform: translate(-50%, -50%) scale(1); }
  50%      { opacity: 1;   transform: translate(-50%, -50%) scale(1.15); }
}

/* Responsive adjustments */
@media (max-width: 640px) {
  .custom-hero {
    min-height: calc(100vh - 56px);
    padding: 3rem 1rem 1.5rem;
  }

  .orbit-container {
    width: 240px;
    height: 240px;
    margin-top: 2rem;
  }

  .rotating-text-wrapper {
    min-width: 220px;
  }

  .hero-heading {
    font-size: clamp(1.6rem, 7vw, 2.5rem);
  }
}
</style>
