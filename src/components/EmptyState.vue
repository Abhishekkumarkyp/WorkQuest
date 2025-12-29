<template>
  <div class="empty-state">
    <div class="empty-icon">{{ icon }}</div>
    <h3>{{ title }}</h3>
    <p>{{ subtitle }}</p>
    <slot />
  </div>
</template>

<script lang="ts">
export default {
  name: 'EmptyState',
  props: {
    title: {
      type: String,
      default: 'Nothing here yet.'
    },
    subtitle: {
      type: String,
      default: 'Add your first item to get started.'
    },
    icon: {
      type: String,
      default: '?'
    }
  }
};
</script>
