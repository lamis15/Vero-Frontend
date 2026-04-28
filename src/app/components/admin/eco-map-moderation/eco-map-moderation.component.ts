import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { EcoMapService, MapPin } from '../../../services/eco-map.service';

@Component({
  selector: 'app-eco-map-moderation',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './eco-map-moderation.component.html',
  styleUrls: ['./eco-map-moderation.component.css']
})
export class EcoMapModerationComponent implements OnInit {
  
  pendingPins: MapPin[] = [];
  loading = true;
  error: string | null = null;
  selectedType: string = 'all';

  constructor(
    private ecoMapService: EcoMapService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    console.log('Component initialized');
    this.loadPendingPins();
  }

  loadPendingPins(): void {
    console.log('Loading pending pins...');
    this.loading = true;
    this.error = null;
    
    this.ecoMapService.getPending().subscribe({
      next: (pins: MapPin[]) => {
        console.log('✅ Received pins:', pins);
        this.pendingPins = pins;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('❌ Error loading pending pins:', err);
        this.loading = false;
        this.cdr.detectChanges();
        
        console.log('Status:', err?.status);
        console.log('Message:', err?.message);
        console.log('Full error:', err);
        
        if (err?.status === 401) {
          this.error = 'Authentication required. Please log in again.';
        } else if (err?.status === 403) {
          this.error = 'Access denied. Admin privileges required.';
        } else if (err?.status === 404) {
          this.error = 'Endpoint not found. Check backend configuration.';
        } else if (err?.status === 0) {
          this.error = 'Cannot connect to backend. Make sure the server is running on http://localhost:8080';
        } else {
          this.error = `Failed to load pending pins: ${err?.message || 'Unknown error'}`;
        }
      }
    });
  }

  approvePin(pin: MapPin): void {
    if (!pin.id) return;
    
    this.ecoMapService.updatePinStatus(pin.id, 'VERIFIED').subscribe({
      next: () => {
        console.log('✅ Pin approved');
        this.pendingPins = this.pendingPins.filter(p => p.id !== pin.id);
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('Error approving pin:', err);
        alert('Failed to approve pin. Please try again.');
      }
    });
  }

  rejectPin(pin: MapPin): void {
    if (!pin.id) return;
    
    if (!confirm(`Are you sure you want to reject "${pin.name}"? This action cannot be undone.`)) {
      return;
    }
    
    this.ecoMapService.deletePin(pin.id).subscribe({
      next: () => {
        console.log('✅ Pin rejected');
        this.pendingPins = this.pendingPins.filter(p => p.id !== pin.id);
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('Error rejecting pin:', err);
        alert('Failed to reject pin. Please try again.');
      }
    });
  }

  get filteredPins(): MapPin[] {
    if (this.selectedType === 'all') {
      return this.pendingPins;
    }
    return this.pendingPins.filter(p => p.type === this.selectedType);
  }

  onFilterChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.selectedType = target.value;
  }

  getPinTypeIcon(type: string): string {
    const typeUpper = type?.toUpperCase();
    switch (typeUpper) {
      case 'RECYCLING': return '♻️';
      case 'EV_CHARGING': return '🔌';
      case 'FARMERS_MARKET': return '🌾';
      case 'BIKE_STATION': return '🚲';
      case 'COMMUNITY_GARDEN': return '🌱';
      case 'PARK': return '🌳';
      case 'WATER_FOUNTAIN': return '💧';
      default: return '📍';
    }
  }

  getStatusColor(status: string): string {
    switch (status?.toUpperCase()) {
      case 'PENDING': return 'var(--vc-warning)';
      case 'VERIFIED': return 'var(--vc-success)';
      case 'REJECTED': return 'var(--vc-danger)';
      default: return 'var(--vc-text-muted)';
    }
  }
}