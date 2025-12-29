<template>
  <span :class="['app-badge', `tone-${tone}`]">
    <slot />
  </span>
</template>

<script lang="ts">
export default {
  name: 'AppBadge',
  props: {
    tone: {
      type: String,
      default: 'neutral'
    }
  }
};
</script>
