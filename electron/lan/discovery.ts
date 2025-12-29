import { Bonjour } from 'bonjour-service';
import type { Browser, Service } from 'bonjour-service';
import type { LanPeer } from '@shared/lan-protocol';
import {
  LAN_APP_NAME,
  LAN_PROTOCOL_VERSION,
  LAN_SERVICE_PROTOCOL,
  LAN_SERVICE_TYPE
} from '@shared/lan-protocol';

const pickAddress = (service: Service) => {
  const addresses = Array.isArray(service.addresses) ? service.addresses : [];
  const ipv4 = addresses.find((address) => address.includes('.'));
  return ipv4 || addresses[0] || service.host || '';
};

export class LanDiscovery {
  private bonjour: Bonjour | null = null;
  private browser: Browser | null = null;
  private peers = new Map<string, LanPeer>();
  private serviceName: string;

  constructor(
    private deviceName: string,
    private port: number,
    private onPeersUpdate: (peers: LanPeer[]) => void
  ) {
    this.serviceName = `WorkQuest-${deviceName}`;
  }

  start() {
    if (this.bonjour) return;
    this.bonjour = new Bonjour();
    this.bonjour.publish({
      name: this.serviceName,
      type: LAN_SERVICE_TYPE,
      protocol: LAN_SERVICE_PROTOCOL,
      port: this.port,
      txt: {
        app: LAN_APP_NAME,
        device: this.deviceName,
        v: LAN_PROTOCOL_VERSION
      }
    });
    this.startBrowser();
  }

  stop() {
    this.browser?.stop();
    this.browser = null;
    this.bonjour?.destroy();
    this.bonjour = null;
    this.peers.clear();
  }

  refresh() {
    this.peers.clear();
    this.browser?.stop();
    this.browser = null;
    if (this.bonjour) {
      this.startBrowser();
    }
    const current = this.listPeers();
    this.onPeersUpdate(current);
    return current;
  }

  listPeers() {
    return Array.from(this.peers.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  getPeer(id: string) {
    return this.peers.get(id) || null;
  }

  private startBrowser() {
    if (!this.bonjour) return;
    this.browser = this.bonjour.find({ type: LAN_SERVICE_TYPE, protocol: LAN_SERVICE_PROTOCOL });
    this.browser.on('up', (service) => this.handleUp(service));
    this.browser.on('down', (service) => this.handleDown(service));
  }

  private handleUp(service: Service) {
    if (service.name === this.serviceName && service.port === this.port) {
      return;
    }
    const name = (service.txt && typeof service.txt.device === 'string' && service.txt.device.length)
      ? service.txt.device
      : service.name;
    const id = `${name}::${service.port}`;
    const host = pickAddress(service);
    if (!host) return;
    const now = new Date().toISOString();
    this.peers.set(id, {
      id,
      name,
      host,
      port: service.port,
      lastSeen: now
    });
    this.onPeersUpdate(this.listPeers());
  }

  private handleDown(service: Service) {
    const name = (service.txt && typeof service.txt.device === 'string' && service.txt.device.length)
      ? service.txt.device
      : service.name;
    const id = `${name}::${service.port}`;
    this.peers.delete(id);
    this.onPeersUpdate(this.listPeers());
  }
}
