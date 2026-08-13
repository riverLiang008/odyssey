<script setup lang="ts">
import { NButton, NIcon } from 'naive-ui'
import { useRouter } from 'vue-router'
import odysseyLogoUrl from '../../../../doc/assets/brand/odyssey-logo.png'

const router = useRouter()

const foundations = [
  { mark: '01', title: 'Journey canvas', detail: 'Compose capabilities without coupling domain logic to a renderer.' },
  { mark: '02', title: 'Knowledge spaces', detail: 'Keep durable metadata in PostgreSQL and files in object storage.' },
  { mark: '03', title: 'Versioned workflows', detail: 'Edit a working draft, then save intentional immutable versions.' },
]
</script>

<template>
  <main class="shell">
    <nav class="nav">
      <a class="brand" href="/" aria-label="Odyssey home">
        <span class="brand-mark" aria-hidden="true">
          <img :src="odysseyLogoUrl" alt="" />
        </span>
        <span>odyssey</span>
      </a>
      <span class="status"><i /> Foundation preview</span>
    </nav>

    <section class="hero">
      <div class="eyebrow">BUILD SYSTEMS THAT CAN THINK</div>
      <h1>Your ideas,<br /><em>in motion.</em></h1>
      <p class="lede">
        Odyssey is a visual environment for shaping agent journeys, knowledge, and tools into reusable capabilities.
      </p>
      <NButton type="primary" size="large" round @click="router.push('/journeys')">
        Open workspace
        <template #icon><NIcon><span>→</span></NIcon></template>
      </NButton>
      <p class="note">Enter the Odyssey workspace.</p>
    </section>

    <section class="foundation" aria-labelledby="foundation-title">
      <div class="section-heading">
        <span>PRODUCT FOUNDATION</span>
        <h2 id="foundation-title">One clear model.<br />Many possible journeys.</h2>
      </div>
      <div class="cards">
        <article v-for="item in foundations" :key="item.mark" class="card">
          <span>{{ item.mark }}</span>
          <h3>{{ item.title }}</h3>
          <p>{{ item.detail }}</p>
        </article>
      </div>
    </section>
  </main>
</template>

