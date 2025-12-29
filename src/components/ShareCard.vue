<template>
  <div class="share-card">
    <div class="share-header">
      <div>
        <h2>WorkQuest Daily</h2>
        <p>{{ date }}</p>
      </div>
      <div class="share-points">{{ points }} pts</div>
    </div>
    <div class="share-body">
      <p class="share-summary">{{ summary }}</p>
      <div class="share-highlight">
        <span>Highlight</span>
        <h3>{{ highlight }}</h3>
      </div>
      <div class="share-stats">
        <div>
          <strong>{{ completed }}</strong>
          <span>Tasks Done</span>
        </div>
        <div>
          <strong>{{ focusSessions }}</strong>
          <span>Focus Sessions</span>
        </div>
        <div>
          <strong>{{ streak }}</strong>
          <span>Day Streak</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
export default {
  name: 'ShareCard',
  props: {
    date: {
      type: String,
      default: ''
    },
    summary: {
      type: String,
      default: ''
    },
    highlight: {
      type: String,
      default: 'Crushed it.'
    },
    completed: {
      type: Number,
      default: 0
    },
    focusSessions: {
      type: Number,
      default: 0
    },
    streak: {
      type: Number,
      default: 0
    },
    points: {
      type: Number,
      default: 0
    }
  }
};
</script>
