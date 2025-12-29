import { defineStore } from 'pinia';
import { useToastStore } from './toast';
import type { LanChatMessageEvent, LanManualPeerInput, LanPeer, TodaySummaryPayload } from '@shared/lan-protocol';
import router from '../router';

export type ChatEntry = {
    id: string;
    peerId: string;
    direction: 'in' | 'out';
    text: string;
    sentAt: string;
    from: string;
    kind?: 'text' | 'file';
    filePath?: string;
    fileName?: string;
    fileSize?: number;
    status?: 'sent' | 'delivered';
};

export type PeerSummaryEntry = {
    peerId: string;
    name: string;
    host: string;
    port: number;
    receivedAt: string;
    summary: TodaySummaryPayload;
};

export const useLanStore = defineStore('lan', {
    state: () => ({
        lanRunning: false,
        lanPort: null as number | null,
        lanDevice: '',
        peers: [] as LanPeer[],
        peerSummaries: [] as PeerSummaryEntry[],
        chatMessages: [] as ChatEntry[],
        activeChatPeerId: null as string | null,
        activeCall: null as null | {
            peerId: string;
            state: 'calling' | 'ringing' | 'connected';
            peerConnection: RTCPeerConnection | null;
            localStream: MediaStream | null;
            remoteStream: MediaStream | null;
            muted: boolean;
        },
        audioDevices: {
            hasMic: null as boolean | null,
            hasSpeaker: null as boolean | null
        },
        disconnectTimer: null as ReturnType<typeof setTimeout> | null,
        ringtoneContext: null as AudioContext | null,
        ringtoneOscillator: null as OscillatorNode | null,
        ringtoneGain: null as GainNode | null,
        ringtoneTimer: null as ReturnType<typeof setInterval> | null,
        pendingIceCandidates: {} as Record<string, RTCIceCandidateInit[]>,
        busy: false,
        manualBusy: false,
        _initialized: false
    }),

    actions: {
        buildSdpPayload(
            fallbackType: 'offer' | 'answer',
            description: RTCSessionDescriptionInit | RTCSessionDescription | null
        ) {
            if (!description || typeof description.sdp !== 'string' || !description.sdp.trim()) {
                throw new Error('Missing local SDP.');
            }
            return {
                type: description.type ?? fallbackType,
                sdp: description.sdp
            };
        },

        normalizeRemoteSdpPayload(
            type: 'CALL_OFFER' | 'CALL_ANSWER',
            payload: { sdp?: unknown }
        ): RTCSessionDescriptionInit | null {
            const fallbackType = type === 'CALL_OFFER' ? 'offer' : 'answer';
            const rawSdp = payload?.sdp;

            if (typeof rawSdp === 'string') {
                return { type: fallbackType, sdp: rawSdp };
            }

            if (rawSdp && typeof rawSdp === 'object') {
                const sdpValue = (rawSdp as { sdp?: unknown }).sdp;
                if (typeof sdpValue !== 'string' || !sdpValue.trim()) return null;
                const sdpType = (rawSdp as { type?: unknown }).type;
                return {
                    type: typeof sdpType === 'string' ? sdpType : fallbackType,
                    sdp: sdpValue
                };
            }

            return null;
        },

        normalizeIceCandidate(raw: unknown): RTCIceCandidateInit | null {
            if (!raw || typeof raw !== 'object') return null;
            const candidate = raw as RTCIceCandidateInit;
            const candidateLine = typeof candidate.candidate === 'string' ? candidate.candidate.trim() : '';
            const hasMid = typeof candidate.sdpMid === 'string' && candidate.sdpMid.trim().length > 0;
            const hasLineIndex = typeof candidate.sdpMLineIndex === 'number' && !Number.isNaN(candidate.sdpMLineIndex);
            if (!candidateLine || (!hasMid && !hasLineIndex)) return null;
            return candidate;
        },

        serializeIceCandidate(raw: RTCIceCandidate | RTCIceCandidateInit | null): RTCIceCandidateInit | null {
            if (!raw) return null;
            const candidate = typeof (raw as RTCIceCandidate).toJSON === 'function'
                ? (raw as RTCIceCandidate).toJSON()
                : {
                    candidate: (raw as RTCIceCandidateInit).candidate,
                    sdpMid: (raw as RTCIceCandidateInit).sdpMid,
                    sdpMLineIndex: (raw as RTCIceCandidateInit).sdpMLineIndex,
                    usernameFragment: (raw as RTCIceCandidateInit).usernameFragment
                };
            return this.normalizeIceCandidate(candidate);
        },

        getUserMediaErrorMessage(error: unknown) {
            const name = (error as { name?: string })?.name;
            if (name === 'NotAllowedError') return 'Microphone permission denied.';
            if (name === 'NotFoundError') return 'No microphone detected.';
            if (name === 'NotReadableError') return 'Microphone is busy or unavailable.';
            return 'Failed to access microphone.';
        },

        async checkAudioDevices() {
            const toast = useToastStore();
            if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
                toast.addToast('Media devices API is unavailable.', 'error');
                return { hasMic: false, hasSpeaker: false };
            }
            try {
                const devices = await navigator.mediaDevices.enumerateDevices();
                const hasMic = devices.some((device) => device.kind === 'audioinput');
                const hasSpeaker = devices.some((device) => device.kind === 'audiooutput');
                this.audioDevices = { hasMic, hasSpeaker };
                if (!hasMic) {
                    toast.addToast('No microphone detected. Check your input device.', 'error');
                }
                if (!hasSpeaker) {
                    toast.addToast('No speaker output detected. You may not hear audio.', 'warning');
                }
                return { hasMic, hasSpeaker };
            } catch {
                toast.addToast('Unable to read media devices. Check permissions.', 'error');
                this.audioDevices = { hasMic: false, hasSpeaker: false };
                return { hasMic: false, hasSpeaker: false };
            }
        },

        queueIceCandidate(peerId: string, candidate: RTCIceCandidateInit) {
            if (!this.pendingIceCandidates[peerId]) {
                this.pendingIceCandidates[peerId] = [];
            }
            this.pendingIceCandidates[peerId].push(candidate);
        },

        async flushIceCandidates(peerId: string, pc: RTCPeerConnection) {
            const queued = this.pendingIceCandidates[peerId];
            if (!queued || queued.length === 0) return;
            delete this.pendingIceCandidates[peerId];
            for (const candidate of queued) {
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (error) {
                    console.warn('Failed to add queued ICE candidate', error);
                }
            }
        },

        clearDisconnectTimer() {
            if (this.disconnectTimer) {
                clearTimeout(this.disconnectTimer);
                this.disconnectTimer = null;
            }
        },

        scheduleDisconnectTimeout() {
            if (this.disconnectTimer) return;
            this.disconnectTimer = setTimeout(() => {
                if (!this.activeCall?.peerConnection) return;
                if (this.activeCall.peerConnection.connectionState === 'disconnected') {
                    this.endCall();
                }
            }, 8000);
        },

        async sendSignalingSafe(
            peerId: string,
            type: 'CALL_OFFER' | 'CALL_ANSWER' | 'ICE_CANDIDATE' | 'CALL_END',
            payload: any,
            options?: { critical?: boolean; toastMessage?: string }
        ) {
            try {
                await window.electronAPI.lan.sendSignaling(peerId, type, payload);
                return true;
            } catch (error) {
                console.warn(`Signaling send failed: ${type}`, error);
                if (options?.critical) {
                    useToastStore().addToast(options.toastMessage ?? 'Failed to send signaling message.', 'error');
                }
                return false;
            }
        },

        startRingtone() {
            if (this.ringtoneContext) return;
            try {
                const context = new AudioContext();
                const oscillator = context.createOscillator();
                const gain = context.createGain();
                oscillator.type = 'triangle';
                oscillator.frequency.value = 440;
                gain.gain.value = 0;
                oscillator.connect(gain);
                gain.connect(context.destination);
                oscillator.start();

                const playPattern = () => {
                    const now = context.currentTime;
                    gain.gain.cancelScheduledValues(now);
                    gain.gain.setValueAtTime(0, now);

                    oscillator.frequency.setValueAtTime(440, now);
                    gain.gain.linearRampToValueAtTime(0.25, now + 0.02);
                    gain.gain.linearRampToValueAtTime(0, now + 0.28);

                    oscillator.frequency.setValueAtTime(660, now + 0.35);
                    gain.gain.linearRampToValueAtTime(0.22, now + 0.37);
                    gain.gain.linearRampToValueAtTime(0, now + 0.65);
                };

                playPattern();
                const timer = setInterval(playPattern, 2000);

                if (context.state === 'suspended') {
                    void context.resume();
                }

                this.ringtoneContext = context;
                this.ringtoneOscillator = oscillator;
                this.ringtoneGain = gain;
                this.ringtoneTimer = timer;
            } catch (error) {
                console.warn('Ringtone failed to start', error);
            }
        },

        stopRingtone() {
            if (this.ringtoneTimer) {
                clearInterval(this.ringtoneTimer);
                this.ringtoneTimer = null;
            }
            if (this.ringtoneOscillator) {
                try {
                    this.ringtoneOscillator.stop();
                } catch {
                    // ignore
                }
                this.ringtoneOscillator = null;
            }
            if (this.ringtoneContext) {
                void this.ringtoneContext.close();
                this.ringtoneContext = null;
            }
            this.ringtoneGain = null;
        },

        async init() {
            if (this._initialized) return;
            this._initialized = true;

            window.electronAPI.lan.onPeersUpdated((updatedPeers) => {
                this.peers = updatedPeers;
            });

            window.electronAPI.lan.onSignaling((event) => {
                this.handleSignalingMessage(event);
            });

            window.electronAPI.lan.onChatMessage((event: LanChatMessageEvent) => {
                this.handleIncomingMessage(event);
            });

            window.electronAPI.lan.onFileReceived((event) => {
                const entry: ChatEntry = {
                    id: crypto.randomUUID(),
                    peerId: event.peerId,
                    direction: 'in',
                    text: `Received file: ${event.name}`,
                    sentAt: new Date().toISOString(),
                    from: this.peers.find((peer) => peer.id === event.peerId)?.name || 'Peer',
                    kind: 'file',
                    filePath: event.filePath,
                    fileName: event.name,
                    fileSize: event.size,
                    status: 'delivered'
                };
                this.chatMessages.push(entry);
                useToastStore().addToast(`File saved to ${event.filePath}`, 'success');
            });

            window.electronAPI.lan.onChatAck((event) => {
                const entry = this.chatMessages.find(
                    (message) => message.id === event.messageId && message.direction === 'out'
                );
                if (entry) {
                    entry.status = 'delivered';
                }
            });

            window.electronAPI.lan.onFileAck((event) => {
                const entry = this.chatMessages.find(
                    (message) => message.id === event.fileId && message.direction === 'out'
                );
                if (entry) {
                    entry.status = 'delivered';
                }
            });

            // Attempt to restore state if already running
            try {
                const peers = await window.electronAPI.lan.peers();
                // If we get peers, it might imply we are running or at least discovered some.
                // However, 'peers' calls returns list from discovery.
                // We might need a proper 'getStatus' API to know if we are actually running,
                // but for now we basically rely on user action or 'start' call.
                // A more robust way would be to ask backend if server is up.
                // For this POC, we'll just load peers.
                this.peers = peers;
            } catch {
                // ignore
            }

            // Listen for notification clicks from main process
            window.electronAPI.onNotificationClick((data) => {
                if (data.action === 'chat' && data.peerId) {
                    this.activeChatPeerId = data.peerId;
                    router.push('/lan-chat');
                }
                if (data.action === 'call' && data.peerId) {
                    this.activeChatPeerId = data.peerId;
                    router.push('/lan-chat');
                }
            });
        },

        async startLan() {
            const toast = useToastStore();
            this.busy = true;
            try {
                const status = await window.electronAPI.lan.start();
                this.lanRunning = true;
                this.lanPort = status.port;
                this.lanDevice = status.deviceName;
                this.peers = await window.electronAPI.lan.peers(); // Initial fetch
                toast.addToast('LAN started.', 'success');
            } catch (error) {
                toast.addToast('Failed to start LAN.', 'error');
            } finally {
                this.busy = false;
            }
        },

        async stopLan() {
            const toast = useToastStore();
            this.busy = true;
            try {
                await window.electronAPI.lan.stop();
                this.lanRunning = false;
                this.lanPort = null;
                this.lanDevice = '';
                this.peers = [];
                toast.addToast('LAN stopped.', 'success');
            } catch (error) {
                toast.addToast('Failed to stop LAN.', 'error');
            } finally {
                this.busy = false;
            }
        },

        async refreshPeers() {
            const toast = useToastStore();
            this.busy = true;
            try {
                this.peers = await window.electronAPI.lan.refresh();
                toast.addToast('Peer list refreshed.', 'success');
            } catch (error) {
                toast.addToast('Failed to refresh peers.', 'error');
            } finally {
                this.busy = false;
            }
        },

        async pingPeer(peer: LanPeer) {
            const toast = useToastStore();
            this.busy = true;
            try {
                await window.electronAPI.lan.ping(peer.id);
                toast.addToast(`Pinged ${peer.name}.`, 'success');
            } catch (error) {
                toast.addToast(`Ping failed for ${peer.name}.`, 'error');
            } finally {
                this.busy = false;
            }
        },

        async getSummary(peer: LanPeer) {
            const toast = useToastStore();
            this.busy = true;
            try {
                const summary = await window.electronAPI.lan.getTodaySummary(peer.id);
                const entry: PeerSummaryEntry = {
                    peerId: peer.id,
                    name: peer.name,
                    host: peer.host,
                    port: peer.port,
                    receivedAt: new Date().toISOString(),
                    summary
                };
                const index = this.peerSummaries.findIndex((item) => item.peerId === peer.id);
                if (index >= 0) {
                    this.peerSummaries.splice(index, 1, entry);
                } else {
                    this.peerSummaries.unshift(entry);
                }
                toast.addToast(`Summary received from ${peer.name}.`, 'success');
            } catch (error) {
                toast.addToast(`Failed to get summary from ${peer.name}.`, 'error');
            } finally {
                this.busy = false;
            }
        },

        async addManualPeer(input: { host: string, port: string, name: string }) {
            const toast = useToastStore();
            const host = input.host.trim();
            const port = Number(input.port);

            if (!host || !Number.isFinite(port)) return;

            this.manualBusy = true;
            try {
                await window.electronAPI.lan.addManualPeer({
                    host,
                    port,
                    name: input.name.trim() || undefined
                });
                // We don't need to manually refresh peers here as the backend will trigger update
                // but explicit load ensures we have it if the event is missed (unlikely)
                this.peers = await window.electronAPI.lan.peers();
                toast.addToast('Manual peer added.', 'success');
            } catch (error) {
                toast.addToast('Failed to add manual peer.', 'error');
                throw error;
            } finally {
                this.manualBusy = false;
            }
        },

        async removeManualPeer(peer: LanPeer) {
            const toast = useToastStore();
            this.manualBusy = true;
            try {
                await window.electronAPI.lan.removeManualPeer(peer.id);
                this.peers = await window.electronAPI.lan.peers();
                toast.addToast(`Removed ${peer.name}.`, 'success');
            } catch (error) {
                toast.addToast(`Failed to remove ${peer.name}.`, 'error');
            } finally {
                this.manualBusy = false;
            }
        },

        async sendChat(peerId: string, text: string) {
            const toast = useToastStore();
            const peer = this.peers.find(p => p.id === peerId);
            if (!peer) return;

            this.busy = true;
            try {
                const payload = await window.electronAPI.lan.sendChat(peerId, text);
                const entry: ChatEntry = {
                    id: payload.id,
                    peerId: peer.id,
                    direction: 'out',
                    text: payload.text,
                    sentAt: payload.sentAt,
                    from: payload.from.name || 'You',
                    kind: 'text',
                    status: 'sent'
                };
                this.chatMessages.push(entry);
                return true;
            } catch (error) {
                toast.addToast(`Failed to send message to ${peer.name}.`, 'error');
                return false;
            } finally {
                this.busy = false;
            }
        },

        async sendFile(peerId: string) {
            const toast = useToastStore();
            const peer = this.peers.find((p) => p.id === peerId);
            if (!peer) return;
            try {
                const picker = await window.electronAPI.lan.pickFile();
                if (picker.canceled || !picker.filePath) return;
                const file = await window.electronAPI.lan.sendFile(peerId, picker.filePath);
                const entry: ChatEntry = {
                    id: file.id,
                    peerId: peer.id,
                    direction: 'out',
                    text: `Sent file: ${file.name}`,
                    sentAt: new Date().toISOString(),
                    from: 'You',
                    kind: 'file',
                    fileName: file.name,
                    fileSize: file.size,
                    filePath: picker.filePath,
                    status: 'sent'
                };
                this.chatMessages.push(entry);
                toast.addToast(`Sent ${file.name} to ${peer.name}.`, 'success');
            } catch (error) {
                toast.addToast(`Failed to send file to ${peer.name}.`, 'error');
            }
        },

        handleIncomingMessage(event: LanChatMessageEvent) {
            const entry: ChatEntry = {
                id: event.message.id,
                peerId: event.peerId,
                direction: 'in',
                text: event.message.text,
                sentAt: event.message.sentAt,
                from: event.message.from.name,
                kind: 'text',
                status: 'delivered'
            };
            const exists = this.chatMessages.some((message) => message.id === entry.id);
            if (!exists) {
                this.chatMessages.push(entry);
            }

            // If we are NOT on the chat page OR we are chatting with someone else
            // show a notification
            const isOnChatPage = router.currentRoute.value.path === '/lan-chat';
            const isChattingWithSender = this.activeChatPeerId === event.peerId;

            if (!isOnChatPage || !isChattingWithSender) {
                window.electronAPI.showNotification({
                    title: `Message from ${entry.from}`,
                    body: entry.text,
                    payload: { action: 'chat', peerId: event.peerId }
                });
            }
        },

        setActiveChatPeer(peerId: string | null) {
            this.activeChatPeerId = peerId;
        },

        async initiateCall(peerId: string) {
            if (this.activeCall) return;
            const peer = this.peers.find((p) => p.id === peerId);
            if (!peer) return;

            try {
                const { hasMic } = await this.checkAudioDevices();
                if (!hasMic) return;

                console.log('Initiating call to', peerId);
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                console.log('Got local stream', stream.id);
                const pc = new RTCPeerConnection({
                    iceServers: [] // LAN only, no STUN/TURN needed usually if same subnet
                });

                stream.getTracks().forEach(track => pc.addTrack(track, stream));

                pc.onicecandidate = (event) => {
                    const candidate = this.serializeIceCandidate(event.candidate);
                    if (candidate) {
                        console.log('Sending ICE candidate');
                        void this.sendSignalingSafe(peerId, 'ICE_CANDIDATE', { candidate, callId: '1' });
                    }
                };

                pc.ontrack = (event) => {
                    const stream = event.streams[0] ?? new MediaStream([event.track]);
                    console.log('Received remote track', stream.id);
                    if (this.activeCall && this.activeCall.peerConnection === pc) {
                        this.activeCall.remoteStream = stream;
                    }
                };

                pc.onconnectionstatechange = () => {
                    console.log('PC connection state:', pc.connectionState);
                    if (!this.activeCall || this.activeCall.peerConnection !== pc) return;
                    if (pc.connectionState === 'connected') {
                        this.clearDisconnectTimer();
                        this.activeCall.state = 'connected';
                        return;
                    }
                    if (pc.connectionState === 'disconnected') {
                        this.scheduleDisconnectTimeout();
                        return;
                    }
                    if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
                        this.clearDisconnectTimer();
                        this.endCall();
                    }
                };

                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                console.log('Sending CALL_OFFER');
                const sdpPayload = this.buildSdpPayload('offer', pc.localDescription ?? offer);

                this.activeCall = {
                    peerId,
                    state: 'calling',
                    peerConnection: pc,
                    localStream: stream,
                    remoteStream: null,
                    muted: false
                };

                const sent = await this.sendSignalingSafe(
                    peerId,
                    'CALL_OFFER',
                    { sdp: sdpPayload, callId: '1' },
                    { critical: true, toastMessage: 'Failed to reach peer for call offer.' }
                );
                if (!sent) {
                    this.endCall();
                    return;
                }
            } catch (err) {
                console.error('Failed to start call', err);
                useToastStore().addToast(this.getUserMediaErrorMessage(err), 'error');
            }
        },

        async answerCall() {
            if (!this.activeCall || this.activeCall.state !== 'ringing' || !this.activeCall.peerConnection) return;
            const peerId = this.activeCall.peerId;
            const pc = this.activeCall.peerConnection;


            try {
                this.stopRingtone();
                const { hasMic } = await this.checkAudioDevices();
                if (!hasMic) return;

                console.log('Answering call from', peerId);
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                console.log('Got local stream for answer', stream.id);
                stream.getTracks().forEach(track => pc.addTrack(track, stream));
                this.activeCall.localStream = stream;
                this.activeCall.muted = false;

                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                const sdpPayload = this.buildSdpPayload('answer', pc.localDescription ?? answer);

                this.activeCall.state = 'connected'; // Optimistic

                const sent = await this.sendSignalingSafe(
                    peerId,
                    'CALL_ANSWER',
                    { sdp: sdpPayload, callId: '1' },
                    { critical: true, toastMessage: 'Failed to send call answer.' }
                );
                if (!sent) {
                    this.endCall();
                    return;
                }
            } catch (err) {
                console.error('Failed to answer call', err);
                useToastStore().addToast(this.getUserMediaErrorMessage(err), 'error');
                this.endCall();
            }
        },

        toggleMute() {
            if (!this.activeCall || !this.activeCall.localStream) return;
            const track = this.activeCall.localStream.getAudioTracks()[0];
            if (!track) return;
            const nextMuted = track.enabled;
            track.enabled = !nextMuted;
            this.activeCall.muted = nextMuted;
        },

        endCall() {
            if (!this.activeCall) return;
            const { peerConnection, localStream, peerId } = this.activeCall;

            if (peerConnection) {
                peerConnection.close();
            }
            if (localStream) {
                localStream.getTracks().forEach(t => t.stop());
            }

            // Notify peer
            // We only send if we think we are still connected or calling
            // But sending redundant END is properly handled usually.
            void this.sendSignalingSafe(peerId, 'CALL_END', { callId: '1' });

            this.activeCall = null;
            this.stopRingtone();
            this.clearDisconnectTimer();
            delete this.pendingIceCandidates[peerId];
        },

        async handleSignalingMessage(event: { peerId: string; type: string; payload: any }) {
            const { peerId, type, payload } = event;
            console.log('Received signaling message:', type, 'from', peerId);

            if (type === 'CALL_OFFER') {
                const remoteDescription = this.normalizeRemoteSdpPayload('CALL_OFFER', payload);
                if (!remoteDescription) {
                    console.warn('Ignoring CALL_OFFER with invalid SDP payload.');
                    return;
                }
                if (this.activeCall) {
                    // Busy line or handle collision. For now, auto-reject or ignore?
                    // Better: Send 'CALL_END' with reason 'busy'.
                    void this.sendSignalingSafe(peerId, 'CALL_END', { callId: payload.callId, reason: 'busy' });
                    return;
                }

                // Incoming call
                const pc = new RTCPeerConnection({ iceServers: [] });

                pc.onicecandidate = (e) => {
                    const candidate = this.serializeIceCandidate(e.candidate);
                    if (candidate) {
                        void this.sendSignalingSafe(peerId, 'ICE_CANDIDATE', { candidate, callId: payload.callId });
                    }
                };

                pc.ontrack = (e) => {
                    const stream = e.streams[0] ?? new MediaStream([e.track]);
                    console.log('Received remote track (answerer)', stream.id);
                    if (this.activeCall && this.activeCall.peerConnection === pc) {
                        this.activeCall.remoteStream = stream;
                    }
                };
                pc.onconnectionstatechange = () => {
                    console.log('PC connection state (answerer):', pc.connectionState);
                    if (!this.activeCall || this.activeCall.peerConnection !== pc) return;
                    if (pc.connectionState === 'connected') {
                        this.clearDisconnectTimer();
                        return;
                    }
                    if (pc.connectionState === 'disconnected') {
                        this.scheduleDisconnectTimeout();
                        return;
                    }
                    if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
                        this.clearDisconnectTimer();
                        this.endCall();
                    }
                };

                this.activeCall = {
                    peerId,
                    state: 'ringing',
                    peerConnection: pc,
                    localStream: null,
                    remoteStream: null,
                    muted: false
                };

                this.activeChatPeerId = peerId;
                const peerName =
                    this.peers.find((known) => known.id === peerId)?.name ||
                    (payload?.from?.name as string | undefined) ||
                    'Unknown';
                window.electronAPI.showNotification({
                    title: 'Incoming call',
                    body: `${peerName} is calling.`,
                    payload: { action: 'call', peerId }
                });
                this.startRingtone();

                await pc.setRemoteDescription(new RTCSessionDescription(remoteDescription));

                await this.flushIceCandidates(peerId, pc);

                // Play ringtone? 

            } else if (type === 'CALL_ANSWER') {
                if (this.activeCall && this.activeCall.peerId === peerId) {
                    const remoteDescription = this.normalizeRemoteSdpPayload('CALL_ANSWER', payload);
                    if (!remoteDescription) {
                        console.warn('Ignoring CALL_ANSWER with invalid SDP payload.');
                        return;
                    }
                    await this.activeCall.peerConnection?.setRemoteDescription(new RTCSessionDescription(remoteDescription));
                    this.activeCall.state = 'connected';
                    if (this.activeCall.peerConnection) {
                        await this.flushIceCandidates(peerId, this.activeCall.peerConnection);
                    }
                }
            } else if (type === 'ICE_CANDIDATE') {
                const candidate = this.normalizeIceCandidate(payload?.candidate);
                if (!candidate) {
                    console.warn('Ignoring ICE_CANDIDATE with invalid payload.');
                    return;
                }
                if (this.activeCall && this.activeCall.peerId === peerId && this.activeCall.peerConnection) {
                    const pc = this.activeCall.peerConnection;
                    if (pc.remoteDescription) {
                        try {
                            await pc.addIceCandidate(new RTCIceCandidate(candidate));
                        } catch (error) {
                            console.warn('Failed to add ICE candidate', error);
                            this.queueIceCandidate(peerId, candidate);
                        }
                    } else {
                        this.queueIceCandidate(peerId, candidate);
                    }
                } else {
                    this.queueIceCandidate(peerId, candidate);
                }
            } else if (type === 'CALL_END') {
                if (this.activeCall && this.activeCall.peerId === peerId) {
                    // Peer hung up
                    // Clean up locally
                    if (this.activeCall.peerConnection) this.activeCall.peerConnection.close();
                    if (this.activeCall.localStream) this.activeCall.localStream.getTracks().forEach(t => t.stop());
                    this.activeCall = null;
                    this.stopRingtone();
                    this.clearDisconnectTimer();
                    delete this.pendingIceCandidates[peerId];
                }
            }
        }
    },

    getters: {
        chatThread: (state) => {
            if (!state.activeChatPeerId) return [];
            return state.chatMessages.filter((message) => message.peerId === state.activeChatPeerId);
        },
        activePeer: (state) => {
            return state.peers.find((peer) => peer.id === state.activeChatPeerId) ?? null;
        }
    }
});
