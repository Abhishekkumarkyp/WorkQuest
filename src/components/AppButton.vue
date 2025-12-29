<template>
  <button :class="['app-button', `variant-${variant}`, { compact }]" @click="$emit('click')">
    <slot />
  </button>
</template>

<script lang="ts">
export default {
  name: 'AppButton',
  props: {
    variant: {
      type: String,
      default: 'primary'
    },
    compact: {
      type: Boolean,
      default: false
    }
  },
  emits: ['click']
};
</script>
