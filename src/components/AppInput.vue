<template>
  <label class="app-input">
    <span v-if="label" class="input-label">{{ label }}</span>
    <input
      :type="type"
      :placeholder="placeholder"
      :value="modelValue"
      :min="min"
      :max="max"
      @input="$emit('update:modelValue', $event.target.value)"
    />
  </label>
</template>

<script lang="ts">
export default {
  name: 'AppInput',
  props: {
    modelValue: {
      type: [String, Number],
      default: ''
    },
    label: {
      type: String,
      default: ''
    },
    placeholder: {
      type: String,
      default: ''
    },
    type: {
      type: String,
      default: 'text'
    },
    min: {
      type: [String, Number],
      default: undefined
    },
    max: {
      type: [String, Number],
      default: undefined
    }
  },
  emits: ['update:modelValue']
};
</script>
