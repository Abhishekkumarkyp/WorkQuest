<template>
  <div class="page chat-page">
    <div class="chat-layout">
      <!-- Sidebar: Peer List -->
      <aside class="chat-sidebar">
        <div class="sidebar-header">
          <h3>Chats</h3>
        </div>
        <div class="chat-peer-list">
          <div
            v-for="peer in peers"
            :key="peer.id"
            class="chat-peer-item"
            :class="{ active: activePeer?.id === peer.id }"
            @click="selectPeer(peer)"
          >
            <div class="peer-avatar">{{ getInitials(peer.name) }}</div>
            <div class="peer-info">
              <div class="peer-name">{{ peer.name }}</div>
              <div class="peer-status">
                <span class="status-dot" :class="{ online: isOnline(peer) }"></span>
                {{ isOnline(peer) ? 'Online' : 'Offline' }}
              </div>
            </div>
          </div>
          <div v-if="peers.length === 0" class="muted empty-peers">
            No peers found. Start LAN or wait for discovery.
          </div>
        </div>
      </aside>

      <!-- Main: Chat Area -->
      <main class="chat-main">
        <template v-if="activePeer">
          <div class="chat-header">
            <div class="chat-header-info">
              <h3>{{ activePeer.name }}</h3>
              <span class="muted">{{ activePeer.host }}:{{ activePeer.port }}</span>
            </div>
             <div class="chat-header-actions">
               <AppButton size="sm" variant="primary" @click="startCall" :disabled="!!activeCall">
                 Phone Call
               </AppButton>
             </div>
          </div>
          
          <div class="chat-messages" ref="messagesContainer">
            <div v-for="message in chatThread" :key="message.id" class="message-row" :class="message.direction">
              <div class="message-bubble">
                <div v-if="message.kind === 'file'" class="file-message">
                  <div class="file-info">
                    <div class="file-name">{{ message.fileName }}</div>
                    <div class="file-size">{{ formatFileSize(message.fileSize) }}</div>
                  </div>
                  <div v-if="isImageFile(message.fileName) && message.filePath" class="file-preview">
                    <img :src="fileUrl(message.filePath)" :alt="message.fileName" />
                  </div>
                  <div v-else-if="isPdfFile(message.fileName) && message.filePath" class="file-preview pdf-preview">
                    <embed :src="fileUrl(message.filePath)" type="application/pdf" />
                  </div>
                  <AppButton
                    v-if="message.filePath"
                    variant="ghost"
                    compact
                    @click="openFile(message.filePath)"
                  >
                    Open
                  </AppButton>
                </div>
                <div v-else class="message-text">{{ message.text }}</div>
                <div class="message-meta">
                  <span>{{ formatTime(message.sentAt) }}</span>
                  <span class="message-status" :class="messageStatusClass(message)">
                    {{ messageStatusText(message) }}
                  </span>
                </div>
              </div>
            </div>
             <div v-if="chatThread.length === 0" class="empty-chat">
              <p>No messages yet. Say hello!</p>
            </div>
          </div>

          <div class="chat-input-area">
            <AppInput 
              v-model="chatDraft" 
              placeholder="Type a message..." 
              @keydown.enter="sendChat"
              autofocus
            />
            <div class="chat-input-actions">
              <AppButton class="icon-button" variant="ghost" aria-label="Attach file" title="Attach file" @click="sendFile">
                <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M7.2 12.6 14.8 5a4 4 0 0 1 5.7 5.7l-9.1 9.1a5.7 5.7 0 0 1-8.1-8.1l8.5-8.5a.9.9 0 0 1 1.3 1.3l-8.5 8.5a3.9 3.9 0 1 0 5.5 5.5l9.1-9.1a2.2 2.2 0 0 0-3.1-3.1l-7.6 7.6a1.2 1.2 0 0 0 1.7 1.7l6.1-6.1a.9.9 0 1 1 1.3 1.3l-6.1 6.1a3 3 0 0 1-4.2-4.2Z"
                    fill="currentColor"
                  />
                </svg>
              </AppButton>
              <AppButton @click="sendChat" :disabled="busy || !chatDraft.trim()">
                Send
              </AppButton>
            </div>
          </div>
        </template>
        
        <EmptyState 
          v-else 
          title="Select a conversation" 
          subtitle="Choose a peer from the left to start chatting." 
        />
      </main>
    </div>


    <!-- Call Overlay -->
    <div v-if="activeCall" class="call-overlay">
      <div class="call-card">
        <div class="call-avatar">{{ getInitials(activeCallPeerName) }}</div>
        <div class="call-status">
           <h3>{{ activeCallPeerName }}</h3>
           <p>{{ callStatusText }}</p>
        </div>
        <div class="call-audio-status">
          <div class="status-item">
            <span class="status-label">Mic</span>
            <span class="status-value" :class="micStatusClass">{{ micStatusText }}</span>
          </div>
          <div class="status-item">
            <span class="status-label">Speaker</span>
            <span class="status-value" :class="speakerStatusClass">{{ speakerStatusText }}</span>
          </div>
        </div>
        <div class="call-actions">
           <AppButton
             class="icon-button"
             variant="ghost"
             :disabled="!canToggleMute"
             :aria-label="muteButtonLabel"
             :title="muteButtonLabel"
             @click="toggleMute"
           >
             <svg v-if="isMicMuted" class="icon" viewBox="0 0 24 24" aria-hidden="true">
               <path
                 d="M7.2 6.6A4.8 4.8 0 0 1 12 3a4.8 4.8 0 0 1 4.8 4.8v4.2c0 1.1-.4 2.2-1.2 3l2.1 2.1a7.6 7.6 0 0 0 2.8-5.1.9.9 0 1 1 1.8.2 9.4 9.4 0 0 1-3.3 6.1l2.1 2.1a.9.9 0 1 1-1.3 1.3L3.4 5.1a.9.9 0 1 1 1.3-1.3l2.5 2.5ZM5.5 8.8v3.2c0 3.5 2.7 6.4 6.2 6.7v2.4h2.6v-2.4a6.7 6.7 0 0 0 2.6-.8l-1.5-1.5a4.9 4.9 0 0 1-8.1-3.5V9.9l-1.8-1.1Z"
                 fill="currentColor"
               />
             </svg>
             <svg v-else class="icon" viewBox="0 0 24 24" aria-hidden="true">
               <path
                 d="M12 3a4.8 4.8 0 0 1 4.8 4.8v4.2a4.8 4.8 0 1 1-9.6 0V7.8A4.8 4.8 0 0 1 12 3Zm0 16.8a7 7 0 0 0 7-7 .9.9 0 1 1 1.8 0 8.8 8.8 0 0 1-8 8.7v2.6h-1.6v-2.6a8.8 8.8 0 0 1-8-8.7.9.9 0 1 1 1.8 0 7 7 0 0 0 7 7Z"
                 fill="currentColor"
               />
             </svg>
           </AppButton>
           <AppButton
             v-if="activeCall.state === 'ringing' && !isOutgoingCall"
             class="icon-button answer-button"
             variant="ghost"
             aria-label="Answer"
             title="Answer"
             @click="answerCall"
           >
             <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
               <path
                 d="M6.6 3.5c1-.9 2.4-1 3.5-.2l2.1 1.6c1 .7 1.3 2 .8 3.1l-.9 2c.7 1.4 1.8 2.7 3.1 3.5l2-1c1-.5 2.3-.2 3.1.8l1.6 2.1c.9 1.1.8 2.6-.2 3.5l-1.2 1.1c-1 .9-2.4 1.3-3.8 1-6.2-1.3-11-6.1-12.3-12.3-.3-1.4.1-2.8 1-3.8l1.1-1.2Z"
                 fill="currentColor"
               />
             </svg>
           </AppButton>
           <AppButton
             class="icon-button hangup-button"
             variant="ghost"
             aria-label="Hang up"
             title="Hang up"
             @click="endCall"
           >
             <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
               <path
                 d="M3.2 10.5c5.5-4.9 12.1-4.9 17.6 0 .7.6.7 1.6.2 2.3l-1.6 2.1c-.7 1-2 1.3-3.1.8l-2-1c-2.2.9-4.3.9-6.5 0l-2 1c-1 .5-2.3.2-3.1-.8l-1.6-2.1c-.5-.7-.5-1.7.2-2.3Z"
                 fill="currentColor"
               />
             </svg>
           </AppButton>
        </div>
      </div>
    </div>
    <audio ref="remoteAudio" autoplay></audio>
  </div>
</template>

<script lang="ts">
import { nextTick } from 'vue';
import dayjs from 'dayjs';
import AppButton from '../components/AppButton.vue';
import AppInput from '../components/AppInput.vue';
import EmptyState from '../components/EmptyState.vue';
import { useLanStore } from '../stores/lan';
import { useToastStore } from '../stores/toast';
import type { LanPeer } from '@shared/lan-protocol';

export default {
  name: 'LanChat',
  components: { AppButton, AppInput, EmptyState },
  data() {
    return {
      chatDraft: ''
    };
  },
  computed: {
    lanStore() {
      return useLanStore();
    },
    peers() {
      return this.lanStore.peers;
    },
    activePeer() {
      return this.lanStore.activePeer;
    },

    chatThread() {
      return this.lanStore.chatThread;
    },
    busy() {
      return this.lanStore.busy;
    },
    activeCall() {
        return this.lanStore.activeCall;
    },
    activeCallPeerName() {
        if (!this.activeCall) return '';
        const peer = this.peers.find(p => p.id === this.activeCall?.peerId);
        return peer ? peer.name : 'Unknown';
    },
    audioDevices() {
        return this.lanStore.audioDevices;
    },
    micStatusText() {
        if (!this.activeCall) return 'Unknown';
        if (this.activeCall.muted) return 'Muted';
        const track = this.activeCall.localStream?.getAudioTracks()[0];
        if (!track) return 'Off';
        if (track.readyState !== 'live') return 'Unavailable';
        if (!track.enabled) return 'Muted';
        return 'On';
    },
    micStatusClass() {
        return this.micStatusText.toLowerCase();
    },
    speakerStatusText() {
        if (!this.activeCall) return 'Unknown';
        if (this.audioDevices && this.audioDevices.hasSpeaker === false) return 'Missing';
        const track = this.activeCall.remoteStream?.getAudioTracks()[0];
        if (!track) return 'Waiting';
        if (track.readyState !== 'live') return 'Unavailable';
        return 'On';
    },
    speakerStatusClass() {
        return this.speakerStatusText.toLowerCase();
    },
    isMicMuted() {
        if (!this.activeCall) return false;
        return this.activeCall.muted;
    },
    muteButtonLabel() {
        return this.isMicMuted ? 'Unmute' : 'Mute';
    },
    canToggleMute() {
        if (!this.activeCall) return false;
        const track = this.activeCall.localStream?.getAudioTracks()[0];
        return !!track && track.readyState === 'live';
    },
    isOutgoingCall() {
        // If state is calling, we initiated. If ringing, we received (unless we distinguish ringing out vs ringing in)
        // Store implementation sets state='calling' for initiator, 'ringing' for receiver.
        return this.activeCall?.state === 'calling';
    },
    callStatusText() {
        if (!this.activeCall) return '';
        if (this.activeCall.state === 'calling') return 'Calling...';
        if (this.activeCall.state === 'ringing') return 'Incoming Call...';
        if (this.activeCall.state === 'connected') return 'Connected';
        return '';
    }
  },
  watch: {
    chatThread: {
      handler() {
        this.scrollToBottom();
      },
      deep: true
    },
    activePeer() {
      this.scrollToBottom();
    },
    'activeCall.remoteStream'(stream: MediaStream | null) {
      if (stream) {
        nextTick(() => {
          const audio = this.$refs.remoteAudio as HTMLAudioElement;
          if (audio) {
            audio.srcObject = stream;
            audio.play().catch((e) => {
              console.error('Audio play failed', e);
              useToastStore().addToast('Audio playback failed. Check speakers/output device.', 'error');
            });
          }
        });
      }
    }
  },
  methods: {
    formatTime(value: string) {
      return dayjs(value).format('HH:mm');
    },
    formatFileSize(size?: number) {
      if (!size && size !== 0) return '--';
      if (size < 1024) return `${size} B`;
      const kb = size / 1024;
      if (kb < 1024) return `${kb.toFixed(1)} KB`;
      const mb = kb / 1024;
      if (mb < 1024) return `${mb.toFixed(1)} MB`;
      const gb = mb / 1024;
      return `${gb.toFixed(1)} GB`;
    },
    isImageFile(name?: string) {
      if (!name) return false;
      return /\.(png|jpe?g|gif|webp|bmp)$/i.test(name);
    },
    isPdfFile(name?: string) {
      if (!name) return false;
      return /\.pdf$/i.test(name);
    },
    fileUrl(filePath?: string) {
      if (!filePath) return '';
      const normalized = filePath.replace(/\\/g, '/');
      return `file:///${encodeURI(normalized)}`;
    },
    openFile(filePath?: string) {
      if (!filePath) return;
      if (this.isImageFile(filePath) || this.isPdfFile(filePath)) {
        const url = this.fileUrl(filePath);
        window.open(url, '_blank');
        return;
      }
      window.electronAPI.showItemInFolder(filePath);
    },
    messageStatusText(message: any) {
      if (message.direction !== 'out') return '✓✓';
      return message.status === 'delivered' ? '✓✓' : '✓';
    },
    messageStatusClass(message: any) {
      if (message.direction !== 'out') return 'delivered';
      return message.status === 'delivered' ? 'delivered' : 'sent';
    },
    getInitials(name: string) {
      return name.substring(0, 2).toUpperCase();
    },
    isOnline(peer: LanPeer) {
      // Simple heuristic: if we see them in discovery, they are "online" roughly speaking.
      // Since 'peers' list is exactly what is discovered, they are online.
      return true;
    },
    selectPeer(peer: LanPeer) {
      this.lanStore.setActiveChatPeer(peer.id);
    },
    async sendChat() {
      if (!this.activePeer || !this.chatDraft.trim()) return;
      const success = await this.lanStore.sendChat(this.activePeer.id, this.chatDraft);
      if (success) {
        this.chatDraft = '';
        this.scrollToBottom();
      }
    },
    async sendFile() {
        if (!this.activePeer) return;
        await this.lanStore.sendFile(this.activePeer.id);
    },
    scrollToBottom() {
      nextTick(() => {
        const container = this.$refs.messagesContainer as HTMLElement;
        if (container) {
          container.scrollTop = container.scrollHeight;
        }
      });
    },
    startCall() {
        if (this.activePeer) {
            this.lanStore.initiateCall(this.activePeer.id);
        }
    },
    answerCall() {
        this.lanStore.answerCall();
    },
    endCall() {
        this.lanStore.endCall();
    },
    toggleMute() {
        this.lanStore.toggleMute();
    }
  }
};
</script>

<style scoped>
.chat-page {
  height: 100%;
  padding: 0; 
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.chat-layout {
  display: grid;
  grid-template-columns: 260px 1fr;
  flex: 1;
  height: 100%;
  overflow: hidden;
  min-height: 0;
}

/* Sidebar */
.chat-sidebar {
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  padding: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.chat-peer-list {
  flex: 1;
  overflow-y: auto;
}

.chat-peer-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  cursor: pointer;
  transition: background 0.2s;
}

.chat-peer-item:hover {
  background: rgba(255, 255, 255, 0.04);
}

.chat-peer-item.active {
  background: rgba(88, 140, 255, 0.15);
  border-left: 3px solid #588cff;
}

.peer-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #1e293b, #334155);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 0.9rem;
  color: #fff;
}

.peer-info {
  display: grid;
  gap: 2px;
}

.peer-name {
  font-weight: 500;
  font-size: 0.9rem;
}

.peer-status {
  font-size: 0.75rem;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #64748b;
}

.status-dot.online {
  background: #10b981;
  box-shadow: 0 0 8px rgba(16, 185, 129, 0.4);
}

.empty-peers {
  padding: 20px;
  font-size: 0.85rem;
  text-align: center;
}

/* Main Area */
.chat-main {
  display: flex;
  flex-direction: column;
  background: rgba(6, 8, 14, 0.2);
  min-height: 0;
}

.chat-header {
  padding: 16px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(6, 8, 14, 0.6);
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 0;
}

.message-row {
  display: flex;
}

.message-row.in {
  justify-content: flex-start;
}

.message-row.out {
  justify-content: flex-end;
}

.message-bubble {
  max-width: 70%;
  padding: 10px 14px;
  border-radius: 16px;
  background: #1e293b;
  position: relative;
}

.message-row.in .message-bubble {
  border-bottom-left-radius: 4px;
}

.message-row.out .message-bubble {
  background: #2563eb;
  border-bottom-right-radius: 4px;
}

.message-text {
  line-height: 1.5;
  white-space: pre-wrap;
}

.message-meta {
  margin-top: 4px;
  font-size: 0.65rem;
  opacity: 0.7;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
}

.message-status {
  font-weight: 600;
  letter-spacing: 0.5px;
}

.message-status.sent {
  opacity: 0.6;
}

.message-status.delivered {
  color: #10b981;
  opacity: 0.95;
}

.file-message {
  display: grid;
  gap: 10px;
}

.file-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  font-size: 0.85rem;
}

.file-name {
  font-weight: 600;
  word-break: break-all;
}

.file-size {
  color: var(--text-secondary);
  font-size: 0.75rem;
}

.file-preview {
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.file-preview img {
  display: block;
  width: 100%;
  max-height: 240px;
  object-fit: contain;
  background: rgba(0, 0, 0, 0.2);
}

.file-preview.pdf-preview embed {
  width: 100%;
  height: 240px;
  border: 0;
}

.chat-input-area {
  padding: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(6, 8, 14, 0.6);
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
}

.chat-input-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.empty-chat {
  margin: auto;
  color: var(--text-secondary);
  font-style: italic;
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* Call Overlay */
.call-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.3s;
}

.call-card {
  background: #1e293b;
  padding: 30px;
  border-radius: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  width: 300px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.5);
}

.call-avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: #3b82f6;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  font-weight: bold;
}

.call-status {
  text-align: center;
}

.call-status h3 {
  margin: 0;
  font-size: 1.2rem;
}

.call-status p {
  margin: 5px 0 0;
  opacity: 0.7;
}

.call-actions {
  display: flex;
  gap: 15px;
}

.icon-button {
  width: 40px;
  height: 40px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.answer-button.app-button {
  color: #16a34a;
  background: rgba(22, 163, 74, 0.2);
  border-color: rgba(22, 163, 74, 0.5);
}

.answer-button.app-button:hover {
  background: rgba(22, 163, 74, 0.3);
}

.hangup-button.app-button {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.5);
}

.hangup-button.app-button:hover {
  background: rgba(239, 68, 68, 0.3);
}

.icon {
  width: 18px;
  height: 18px;
}

.call-audio-status {
  display: grid;
  gap: 8px;
  width: 100%;
}

.status-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(255, 255, 255, 0.06);
  padding: 8px 12px;
  border-radius: 10px;
  font-size: 0.85rem;
}

.status-label {
  color: var(--text-secondary);
}

.status-value {
  font-weight: 600;
}

.status-value.on {
  color: #10b981;
}

.status-value.off,
.status-value.missing,
.status-value.unavailable {
  color: #f97316;
}

.status-value.waiting {
  color: #facc15;
}

.status-value.muted {
  color: #ef4444;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
</style>
