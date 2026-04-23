import {
  Component, OnInit, OnDestroy, AfterViewInit,
  ElementRef, ViewChild, NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import * as L from 'leaflet';
import { EcoMapService, MapPin, AirQuality } from '../../services/eco-map.service';
import { AuthService } from '../../services/auth.service';

/* ── Spot model ── */
export interface EcoSpot {
  id: number;
  name: string;
  category: string;
  categoryKey: string;
  distance: string;
  isOpen: boolean;
  pinColor: string;
  emoji: string;
  lat: number;
  lng: number;
  description: string;
  ecoPoints: number;
  source: string;
  marker?: L.Marker;
}

export interface FilterLayer {
  key: string;
  label: string;
  emoji: string;
  color: string;
  active: boolean;
}

interface Toast { id: number; message: string; visible: boolean; }

/* ── Category meta ── */
const CAT: Record<string, { label: string; emoji: string; color: string; pts: number }> = {
  RECYCLING: { label: 'Recycling', emoji: '♻️', color: '#10b981', pts: 15 },
  EV_CHARGING: { label: 'EV Charging', emoji: '⚡', color: '#3b82f6', pts: 10 },
  ZERO_WASTE_STORE: { label: 'Zero Waste', emoji: '🥕', color: '#f59e0b', pts: 20 },
  FARMERS_MARKET: { label: 'Market', emoji: '🥕', color: '#f59e0b', pts: 20 },
  BIKE_STATION: { label: 'Mobility', emoji: '🚲', color: '#8b5cf6', pts: 8 },
  COMMUNITY_GARDEN: { label: 'Garden', emoji: '🪴', color: '#22c55e', pts: 25 },
  COMPOSTING: { label: 'Composting', emoji: '♻️', color: '#059669', pts: 18 },
  ECO_EVENT: { label: 'Event', emoji: '🌍', color: '#0ea5e9', pts: 30 },
  THRIFT: { label: 'Thrift', emoji: '👗', color: '#ec4899', pts: 12 },
};

/* ── Hardcoded Tunis spots ── */
const TUNIS_SPOTS: EcoSpot[] = [
  { id: 1, name: 'Green Cycle Hub', category: 'Recycling', categoryKey: 'RECYCLING', lat: 36.8110, lng: 10.1660, description: 'Full-service recycling centre — electronics, batteries, textiles.', isOpen: true, pinColor: '#10b981', emoji: '♻️', ecoPoints: 15, distance: '', source: 'LOCAL' },
  { id: 2, name: 'SolarCharge Lac', category: 'EV Charging', categoryKey: 'EV_CHARGING', lat: 36.8300, lng: 10.2330, description: 'Solar-powered EV charging with 4 Type-2 connectors.', isOpen: true, pinColor: '#3b82f6', emoji: '⚡', ecoPoints: 10, distance: '', source: 'LOCAL' },
  { id: 3, name: 'Marché Central', category: 'Market', categoryKey: 'FARMERS_MARKET', lat: 36.7990, lng: 10.1720, description: 'Historic covered market — local produce, spices, zero-waste bulk.', isOpen: true, pinColor: '#f59e0b', emoji: '🥕', ecoPoints: 20, distance: '', source: 'LOCAL' },
  { id: 4, name: 'Vélo Station Habib Bourguiba', category: 'Mobility', categoryKey: 'BIKE_STATION', lat: 36.8000, lng: 10.1800, description: 'Bike-sharing dock — 8 bikes & 4 e-scooters available.', isOpen: true, pinColor: '#8b5cf6', emoji: '🚲', ecoPoints: 8, distance: '', source: 'LOCAL' },
  { id: 5, name: 'Jardin du Belvédère', category: 'Garden', categoryKey: 'COMMUNITY_GARDEN', lat: 36.8125, lng: 10.1790, description: 'Public botanical garden with community composting area.', isOpen: false, pinColor: '#22c55e', emoji: '🪴', ecoPoints: 25, distance: '', source: 'LOCAL' },
  { id: 6, name: 'EcoThreads Carthage', category: 'Thrift', categoryKey: 'THRIFT', lat: 36.8530, lng: 10.3250, description: 'Curated vintage clothing and upcycled fashion boutique.', isOpen: true, pinColor: '#ec4899', emoji: '👗', ecoPoints: 12, distance: '', source: 'LOCAL' },
  { id: 7, name: 'Parc Ennahli Compost', category: 'Composting', categoryKey: 'COMPOSTING', lat: 36.8400, lng: 10.2100, description: 'Public composting bins inside Ennahli urban park.', isOpen: true, pinColor: '#059669', emoji: '♻️', ecoPoints: 18, distance: '', source: 'LOCAL' },
];

@Component({
  selector: 'app-eco-map',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './eco-map.component.html',
  styleUrl: './eco-map.component.css'
})
export class EcoMapComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapContainer', { static: false }) mapEl!: ElementRef;

  /* ── Map ── */
  private map!: L.Map;
  private userMarker!: L.Marker;
  private spotMarkers: L.Marker[] = [];
  userLat = 36.8065;
  userLng = 10.1815;

  /* ── Data ── */
  filters: FilterLayer[] = [
    { key: 'RECYCLING', label: 'Recycling', emoji: '♻️', color: '#10b981', active: true },
    { key: 'EV_CHARGING', label: 'EV Charging', emoji: '⚡', color: '#3b82f6', active: true },
    { key: 'FARMERS_MARKET', label: 'Markets', emoji: '🥕', color: '#f59e0b', active: true },
    { key: 'BIKE_STATION', label: 'Mobility', emoji: '🚲', color: '#8b5cf6', active: true },
    { key: 'COMMUNITY_GARDEN', label: 'Gardens', emoji: '🪴', color: '#22c55e', active: true },
    { key: 'COMPOSTING', label: 'Composting', emoji: '♻️', color: '#059669', active: true },
    { key: 'THRIFT', label: 'Thrift', emoji: '👗', color: '#ec4899', active: true },
  ];

  spots: EcoSpot[] = [];
  selectedSpot: EcoSpot | null = null;
  checkedIn = new Set<number>();
  userPoints = 0;
  checkInCount = 0;
  badgesEarned = 0;
  toasts: Toast[] = [];
  private toastId = 0;
  loading = true;
  showAddPin = false;
  communityPinCount = 0;

  newPinName = '';
  newPinDesc = '';
  newPinType = 'RECYCLING';

  aqi: AirQuality = { latitude: 36.8065, longitude: 10.1815, aqi: 0, aqiLabel: 'Loading...' };

  constructor(
    private mapService: EcoMapService,
    public authService: AuthService,
    private zone: NgZone
  ) { }

  ngOnInit(): void { }

  ngAfterViewInit(): void {
    this.initMap();
    this.loadData();
  }

  ngOnDestroy(): void {
    if (this.map) this.map.remove();
  }

  /* ════════════════════════════════════
     MAP INIT
     ════════════════════════════════════ */
  private initMap(): void {
    this.map = L.map(this.mapEl.nativeElement, {
      center: [this.userLat, this.userLng],
      zoom: 13,
      zoomControl: false,
      attributionControl: false
    });

    // Stadia Alidade Smooth — muted, clean, premium. No API key needed.
    L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png', {
      maxZoom: 20,
      attribution: '© Stadia Maps © OpenMapTiles © OpenStreetMap'
    }).addTo(this.map);

    // Zoom control top-right
    L.control.zoom({ position: 'topright' }).addTo(this.map);

    // User location marker
    const userIcon = L.divIcon({
      className: 'user-marker-icon',
      html: `<div class="user-dot"><svg viewBox="0 0 24 24" fill="white" width="14" height="14"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>
             <div class="user-ripple u1"></div><div class="user-ripple u2"></div><div class="user-ripple u3"></div>
             <span class="user-label">You</span>`,
      iconSize: [40, 50],
      iconAnchor: [20, 25]
    });
    this.userMarker = L.marker([this.userLat, this.userLng], { icon: userIcon, zIndexOffset: 1000 }).addTo(this.map);
  }

  /* ════════════════════════════════════
     DATA LOADING
     ════════════════════════════════════ */
  private loadData(): void {
    this.loading = true;
    this.mapService.getMap(this.userLat, this.userLng, 5).subscribe({
      next: (dto) => {
        const apiPins = [...(dto.communityPins || []), ...(dto.osmPins || [])];
        const apiSpots = apiPins.map((p, i) => this.pinToSpot(p, i));
        // Merge: hardcoded always present + API adds on top
        this.spots = [
          ...TUNIS_SPOTS.map(s => ({ ...s, distance: this.calcDist(s.lat, s.lng) })),
          ...apiSpots
        ];
        if (dto.airQuality) this.aqi = dto.airQuality;
        this.communityPinCount = (dto.communityPins || []).length;
        this.zone.run(() => { this.loading = false; });
        setTimeout(() => this.renderMarkers(), 100);
      },
      error: () => {
        // API down / 403 → show hardcoded Tunis spots
        this.spots = TUNIS_SPOTS.map(s => ({ ...s, distance: this.calcDist(s.lat, s.lng) }));
        this.zone.run(() => { this.loading = false; });
        setTimeout(() => this.renderMarkers(), 100);
      }
    });
  }

  private pinToSpot(pin: MapPin, index: number): EcoSpot {
    const m = CAT[pin.type] || { label: pin.type, emoji: '📍', color: '#6b7280', pts: 5 };
    return {
      id: pin.id ?? -(index + 100),
      name: pin.name || `Eco Point (${m.label})`,
      category: m.label, categoryKey: pin.type,
      distance: this.calcDist(pin.latitude, pin.longitude),
      isOpen: true, pinColor: m.color, emoji: m.emoji,
      lat: pin.latitude, lng: pin.longitude,
      description: pin.description || pin.address || '',
      ecoPoints: m.pts, source: pin.source
    };
  }

  /* ════════════════════════════════════
     MARKERS
     ════════════════════════════════════ */
  private renderMarkers(): void {
    // Clear old
    this.spotMarkers.forEach(m => m.remove());
    this.spotMarkers = [];

    this.spots.forEach(spot => {
      const icon = L.divIcon({
        className: 'eco-pin-icon',
        html: `<div class="pin-body" style="background:${spot.pinColor}"><span class="pin-emoji">${spot.emoji}</span></div><div class="pin-tail" style="border-top-color:${spot.pinColor}"></div>`,
        iconSize: [42, 52],
        iconAnchor: [21, 52]
      });
      const marker = L.marker([spot.lat, spot.lng], { icon }).addTo(this.map);
      marker.on('click', () => this.zone.run(() => this.selectSpot(spot)));
      spot.marker = marker;
      this.spotMarkers.push(marker);
    });

    this.applyFilters();
  }

  private applyFilters(): void {
    const activeKeys = new Set(this.filters.filter(f => f.active).map(f => f.key));
    this.spots.forEach(s => {
      if (s.marker) {
        const el = (s.marker as any)._icon as HTMLElement;
        if (!el) return;
        if (activeKeys.has(s.categoryKey)) {
          el.style.opacity = '1';
          el.style.pointerEvents = 'auto';
          el.style.transform = '';
        } else {
          el.style.opacity = '0.15';
          el.style.pointerEvents = 'none';
          el.style.transform = 'scale(0.6)';
        }
      }
    });
  }

  /* ════════════════════════════════════
     USER ACTIONS
     ════════════════════════════════════ */

  toggleFilter(key: string): void {
    const f = this.filters.find(x => x.key === key);
    if (f) f.active = !f.active;
    this.applyFilters();
  }

  get visibleSpots(): EcoSpot[] {
    const keys = new Set(this.filters.filter(f => f.active).map(f => f.key));
    return this.spots
      .filter(s => keys.has(s.categoryKey))
      .sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));
  }

  selectSpot(spot: EcoSpot): void {
    this.selectedSpot = spot;
    if (this.map) {
      this.map.flyTo([spot.lat, spot.lng], 16, { duration: 0.8 });
    }
  }

  closePopup(): void {
    this.selectedSpot = null;
  }

  checkIn(spot: EcoSpot, event?: Event): void {
    if (event) event.stopPropagation();
    if (this.checkedIn.has(spot.id)) return;
    this.checkedIn.add(spot.id);
    this.userPoints += spot.ecoPoints;
    this.checkInCount++;
    if (this.checkInCount >= 5) this.badgesEarned = Math.max(this.badgesEarned, 1);
    this.showToast(`✅ Checked in at ${spot.name}! +${spot.ecoPoints} Eco Points`);
  }

  isCheckedIn(id: number): boolean { return this.checkedIn.has(id); }

  getDirections(spot: EcoSpot): void {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${spot.lat},${spot.lng}`, '_blank');
  }

  /* ── AQI ── */
  getAqiColor(): string {
    const a = this.aqi?.aqi ?? 0;
    if (a <= 1) return '#22c55e'; if (a === 2) return '#84cc16';
    if (a === 3) return '#f59e0b'; if (a === 4) return '#ef4444';
    return '#7c3aed';
  }
  getAqiEmoji(): string {
    const a = this.aqi?.aqi ?? 0;
    if (a <= 2) return '🟢'; if (a === 3) return '🟡'; if (a === 4) return '🔴'; return '🟣';
  }

  /* ── Add Pin ── */
  toggleAddPin(): void { this.showAddPin = !this.showAddPin; }

  submitNewPin(): void {
    if (!this.newPinName.trim()) return;
    const center = this.map.getCenter();
    this.mapService.submitPin({
      name: this.newPinName, description: this.newPinDesc,
      placeType: this.newPinType,
      latitude: center.lat, longitude: center.lng
    }).subscribe({
      next: () => {
        this.showToast('📍 Pin submitted! Awaiting verification.');
        this.newPinName = ''; this.newPinDesc = ''; this.showAddPin = false;
      },
      error: () => this.showToast('❌ Could not submit pin.')
    });
  }

  /* ── Toast ── */
  showToast(message: string): void {
    const id = ++this.toastId;
    const t: Toast = { id, message, visible: false };
    this.toasts.push(t);
    setTimeout(() => t.visible = true, 50);
    setTimeout(() => { t.visible = false; setTimeout(() => this.toasts = this.toasts.filter(x => x.id !== id), 400); }, 3000);
  }

  /* ── Helpers ── */
  private calcDist(lat: number, lng: number): string {
    const R = 6371;
    const dLat = (lat - this.userLat) * Math.PI / 180;
    const dLon = (lng - this.userLng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(this.userLat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    const d = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(1)} km`;
  }
}