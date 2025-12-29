<template>
  <label class="app-input">
    <span v-if="label" class="input-label">{{ label }}</span>
    <select :value="modelValue" @change="$emit('update:modelValue', $event.target.value)">
      <option v-if="emptyLabel" value="">{{ emptyLabel }}</option>
      <option v-for="option in options" :key="option" :value="option">
        {{ option }}
      </option>
    </select>
  </label>
</template>

<script lang="ts">
export default {
  name: 'AppSelect',
  props: {
    modelValue: {
      type: String,
      default: ''
    },
    label: {
      type: String,
      default: ''
    },
    options: {
      type: Array,
      default: () => []
    },
    emptyLabel: {
      type: String,
      default: ''
    }
  },
  emits: ['update:modelValue']
};
</script>
