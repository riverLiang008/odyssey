<script setup lang="ts">
import { computed } from 'vue'
import { parseMarkdown, type MarkdownInline } from '@/domain/knowledge/markdown'

const props = defineProps<{ source: string }>()
const blocks = computed(() => parseMarkdown(props.source))

function tagForHeading(level: number) {
  return `h${Math.min(6, Math.max(1, level))}`
}

function tokenTag(token: MarkdownInline) {
  if (token.type === 'strong') return 'strong'
  if (token.type === 'emphasis') return 'em'
  if (token.type === 'code') return 'code'
  if (token.type === 'link') return 'a'
  return 'span'
}
</script>

<template>
  <div class="knowledge-markdown" aria-label="Rendered Markdown preview">
    <template v-if="blocks.length">
      <template v-for="(block, blockIndex) in blocks" :key="blockIndex">
        <component :is="tagForHeading(block.level)" v-if="block.type === 'heading'">
          <component :is="tokenTag(token)" v-for="(token, tokenIndex) in block.content" :key="tokenIndex" :href="token.type === 'link' ? token.href : undefined" :target="token.type === 'link' ? '_blank' : undefined" :rel="token.type === 'link' ? 'noopener noreferrer' : undefined">{{ token.content }}</component>
        </component>
        <p v-else-if="block.type === 'paragraph'">
          <component :is="tokenTag(token)" v-for="(token, tokenIndex) in block.content" :key="tokenIndex" :href="token.type === 'link' ? token.href : undefined" :target="token.type === 'link' ? '_blank' : undefined" :rel="token.type === 'link' ? 'noopener noreferrer' : undefined">{{ token.content }}</component>
        </p>
        <blockquote v-else-if="block.type === 'quote'">
          <component :is="tokenTag(token)" v-for="(token, tokenIndex) in block.content" :key="tokenIndex" :href="token.type === 'link' ? token.href : undefined">{{ token.content }}</component>
        </blockquote>
        <component :is="block.ordered ? 'ol' : 'ul'" v-else-if="block.type === 'list'">
          <li v-for="(item, itemIndex) in block.items" :key="itemIndex"><component :is="tokenTag(token)" v-for="(token, tokenIndex) in item" :key="tokenIndex" :href="token.type === 'link' ? token.href : undefined">{{ token.content }}</component></li>
        </component>
        <pre v-else-if="block.type === 'code'"><code :data-language="block.language">{{ block.content }}</code></pre>
        <hr v-else />
      </template>
    </template>
    <p v-else class="knowledge-markdown-empty">This file is empty.</p>
  </div>
</template>
