<script setup lang="ts">
import JourneyCard from '@/features/journey-list/JourneyCard.vue'
import { createJourneySummaries } from '@/features/journey-list/journeySummaries'

const journeys = createJourneySummaries()
const myJourneys = journeys.filter((journey) => journey.scope === 'my-journeys')
const communityJourneys = journeys.filter((journey) => journey.scope === 'community-journeys')
</script>

<template>
  <section class="journey-list-page" aria-labelledby="journey-list-title">
    <div class="journey-list-page__heading">
      <div>
        <span class="page-eyebrow">OdyJourney</span>
        <h1 id="journey-list-title">Your OdyJourneys</h1>
        <p>Choose a Journey to continue configuring its Resources, Agents, and execution flow.</p>
      </div>
      <button class="primary-action" type="button" disabled title="Journey creation is outside M2.2">＋ New OdyJourney</button>
    </div>

    <div class="journey-toolbar" aria-label="Journey list controls">
      <input aria-label="Search journeys" placeholder="⌕  Search by name or description" disabled />
      <button type="button" disabled>Status ⌄</button>
      <button type="button" disabled>Owner ⌄</button>
      <button type="button" disabled>Recently updated ⌄</button>
      <span>{{ journeys.length }} {{ journeys.length === 1 ? 'journey' : 'journeys' }}</span>
    </div>

    <div v-if="journeys.length === 0" class="empty-state" role="status">No Journeys yet.</div>
    <template v-else>
      <section class="journey-section" aria-labelledby="my-journeys-heading">
        <div class="journey-section__heading"><h2 id="my-journeys-heading">MY JOURNEYS</h2><i /></div>
        <div class="journey-grid"><JourneyCard v-for="journey in myJourneys" :key="journey.id" :journey="journey" /></div>
      </section>
      <section class="journey-section" aria-labelledby="community-journeys-heading">
        <div class="journey-section__heading"><h2 id="community-journeys-heading">COMMUNITY JOURNEYS</h2><i /></div>
        <p v-if="communityJourneys.length === 0" class="section-placeholder">Community Journeys are coming soon.</p>
      </section>
    </template>

    <p class="journey-hint"><span>i</span> Click a Journey card to continue configuration.</p>
  </section>
</template>
