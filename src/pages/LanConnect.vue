<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h2>LAN Connect</h2>
        <p>Discover peers and establish connections.</p>
      </div>
      <div class="header-actions">
        <AppButton variant="ghost" @click="refreshPeers" :disabled="busy">
          Refresh Peers
        </AppButton>
        <AppButton v-if="lanRunning" variant="ghost" @click="stopLan" :disabled="busy">
          Stop LAN
        </AppButton>
        <AppButton v-else @click="startLan" :disabled="busy">
          Start LAN
        </AppButton>
      </div>
    </div>

    <div class="lan-grid">
      <AppCard>
        <div class="card-header">
          <div>
            <h3>LAN Status</h3>
            <p class="muted">Broadcasting WorkQuest over mDNS.</p>
          </div>
          <AppBadge :tone="lanRunning ? 'success' : 'danger'">
            {{ lanRunning ? 'Running' : 'Stopped' }}
          </AppBadge>
        </div>
        <div class="status-grid">
          <div>
            <strong>{{ lanRunning ? 'Active' : 'Inactive' }}</strong>
            <span>Status</span>
          </div>
          <div>
            <strong>{{ lanPort || '---' }}</strong>
            <span>Port</span>
          </div>
          <div>
            <strong>{{ lanDevice || '---' }}</strong>
            <span>Device</span>
          </div>
        </div>
      </AppCard>

      <AppCard>
        <div class="card-header">
          <h3>Peers</h3>
          <span class="muted">{{ peers.length }} found</span>
        </div>
        <div v-if="peers.length" class="peer-list">
          <div v-for="peer in peers" :key="peer.id" class="peer-row">
            <div>
              <h4>{{ peer.name }}</h4>
              <div class="peer-meta">
                <span>{{ peer.host }}:{{ peer.port }}</span>
                <span>Last seen {{ formatTime(peer.lastSeen) }}</span>
                <span v-if="isManualPeer(peer)">Manual</span>
              </div>
            </div>
            <div class="peer-actions">
              <AppButton compact variant="ghost" @click="openChat(peer)" :disabled="busy">
                Chat
              </AppButton>
              <AppButton compact variant="ghost" @click="pingPeer(peer)" :disabled="busy">
                Ping
              </AppButton>
              <AppButton compact @click="getSummary(peer)" :disabled="busy">
                Get Summary
              </AppButton>
              <AppButton
                v-if="isManualPeer(peer)"
                compact
                variant="ghost"
                @click="removeManualPeer(peer)"
                :disabled="manualBusy"
              >
                Remove
              </AppButton>
            </div>
          </div>
        </div>
        <EmptyState v-else title="No peers yet" subtitle="Start LAN on another device." />
      </AppCard>

      <AppCard>
        <div class="card-header">
          <div>
            <h3>Manual Peer</h3>
            <p class="muted">Use when mDNS discovery is blocked.</p>
          </div>
        </div>
        <div class="manual-peer-form">
          <AppInput v-model="manualHost" label="Peer IP" placeholder="192.168.1.20" />
          <AppInput v-model="manualPort" label="Port" placeholder="49273" type="number" />
          <AppInput v-model="manualName" label="Name (optional)" placeholder="Work laptop" />
          <div class="manual-peer-actions">
            <AppButton
              @click="addManualPeer"
              :disabled="manualBusy || !manualHost.trim() || !manualPort.trim()"
            >
              Add Peer
            </AppButton>
          </div>
        </div>
        <p class="muted">Use the port shown on the peer's LAN Status card.</p>
      </AppCard>

      <AppCard>
        <div class="card-header">
          <h3>Peer Summaries</h3>
          <span class="muted">{{ peerSummaries.length }} received</span>
        </div>
        <div v-if="peerSummaries.length" class="summary-grid">
          <div v-for="summary in peerSummaries" :key="summary.peerId" class="summary-card">
            <div class="summary-header">
              <div>
                <h4>{{ summary.name }}</h4>
                <div class="muted">{{ summary.host }}:{{ summary.port }}</div>
              </div>
              <div class="muted">{{ formatTime(summary.receivedAt) }}</div>
            </div>
            <div class="summary-metrics">
              <div>
                <strong>{{ summary.summary.doneCount }}</strong>
                <span>Done</span>
              </div>
              <div>
                <strong>{{ summary.summary.inProgressCount }}</strong>
                <span>In Progress</span>
              </div>
              <div>
                <strong>{{ summary.summary.blockedCount }}</strong>
                <span>Blocked</span>
              </div>
              <div>
                <strong>{{ summary.summary.totalTasks }}</strong>
                <span>Total</span>
              </div>
            </div>
            <div class="summary-top">
              <h5>Top Tasks</h5>
              <ul v-if="summary.summary.top3Titles.length">
                <li v-for="title in summary.summary.top3Titles" :key="title">{{ title }}</li>
              </ul>
              <p v-else class="muted">No tasks found.</p>
            </div>
          </div>
        </div>
        <EmptyState v-else title="No summaries yet" subtitle="Ping a peer to get started." />
      </AppCard>

      <AppCard>
        <div class="card-header">
          <h3>Protocol Details</h3>
          <span class="muted">Peer-to-peer on the same Wi-Fi</span>
        </div>
        <div class="protocol-details">
          <p>
            Discovery uses mDNS (Bonjour) with the <strong>{{ protocolService }}</strong> service. After discovery,
            devices open a direct WebSocket connection over TCP on a local, ephemeral port.
          </p>
          <ul>
            <li>No Internet required. Both devices must be on the same subnet.</li>
            <li>Messages are JSON payloads with device name, port, id, and timestamp.</li>
            <li>Protocol version: {{ protocolVersion }}.</li>
            <li>Traffic is local only and not encrypted; use on trusted Wi-Fi networks.</li>
          </ul>
        </div>
      </AppCard>
    </div>
  </div>
</template>

<script lang="ts">
import dayjs from 'dayjs';
import AppButton from '../components/AppButton.vue';
import AppBadge from '../components/AppBadge.vue';
import AppCard from '../components/AppCard.vue';
import AppInput from '../components/AppInput.vue';
import EmptyState from '../components/EmptyState.vue';
import { LAN_PROTOCOL_VERSION, LAN_SERVICE_PROTOCOL, LAN_SERVICE_TYPE } from '@shared/lan-protocol';
import type { LanPeer } from '@shared/lan-protocol';
import { useLanStore } from '../stores/lan';
import { useRouter } from 'vue-router';

export default {
  name: 'LanConnect',
  components: { AppButton, AppBadge, AppCard, AppInput, EmptyState },
  setup() {
    const router = useRouter();
    return { router };
  },
  data() {
    return {
      manualHost: '',
      manualPort: '',
      manualName: '',
      protocolService: `${LAN_SERVICE_TYPE} (${LAN_SERVICE_PROTOCOL})`,
      protocolVersion: LAN_PROTOCOL_VERSION
    };
  },
  computed: {
    lanStore() {
      return useLanStore();
    },
    lanRunning() {
      return this.lanStore.lanRunning;
    },
    lanPort() {
      return this.lanStore.lanPort;
    },
    lanDevice() {
      return this.lanStore.lanDevice;
    },
    peers() {
      return this.lanStore.peers;
    },
    peerSummaries() {
      return this.lanStore.peerSummaries;
    },
    busy() {
      return this.lanStore.busy;
    },
    manualBusy() {
      return this.lanStore.manualBusy;
    }
  },
  methods: {
    formatTime(value: string) {
      return dayjs(value).format('HH:mm:ss');
    },
    isManualPeer(peer: LanPeer) {
      return peer.id.startsWith('manual::');
    },
    startLan() {
      return this.lanStore.startLan();
    },
    stopLan() {
      return this.lanStore.stopLan();
    },
    refreshPeers() {
      return this.lanStore.refreshPeers();
    },
    pingPeer(peer: LanPeer) {
      return this.lanStore.pingPeer(peer);
    },
    getSummary(peer: LanPeer) {
      return this.lanStore.getSummary(peer);
    },
    async addManualPeer() {
      await this.lanStore.addManualPeer({
        host: this.manualHost,
        port: this.manualPort,
        name: this.manualName
      });
      if (!this.manualBusy) {
         this.manualHost = '';
         this.manualPort = '';
         this.manualName = '';
      }
    },
    removeManualPeer(peer: LanPeer) {
      return this.lanStore.removeManualPeer(peer);
    },
    openChat(peer: LanPeer) {
      this.lanStore.setActiveChatPeer(peer.id);
      this.router.push('/lan-chat');
    }
  }
};
</script>

<style scoped>
.lan-grid {
  display: grid;
  gap: 20px;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
}

.status-grid span {
  color: var(--text-secondary);
  font-size: 0.8rem;
}

.peer-list {
  display: grid;
  gap: 14px;
}

.peer-row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.peer-row:last-child {
  border-bottom: none;
}

.peer-meta {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  color: var(--text-secondary);
  font-size: 0.8rem;
}

.peer-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.summary-grid {
  display: grid;
  gap: 16px;
}

.summary-card {
  padding: 16px;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(6, 8, 14, 0.4);
  display: grid;
  gap: 12px;
}

.summary-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.summary-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 10px;
}

.summary-metrics span {
  color: var(--text-secondary);
  font-size: 0.75rem;
}

.summary-top ul {
  margin-top: 8px;
  display: grid;
  gap: 6px;
  padding-left: 18px;
}

.manual-peer-form {
  display: grid;
  gap: 12px;
  margin-bottom: 10px;
}

.manual-peer-actions {
  display: flex;
  justify-content: flex-end;
}

.protocol-details p {
  margin: 0 0 10px;
  color: var(--text-secondary);
}

.protocol-details ul {
  margin: 0;
  padding-left: 18px;
  display: grid;
  gap: 6px;
  color: var(--text-secondary);
}
</style>
