import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

/* ── Interfaces matching backend DTOs ── */

export interface MapPin {
  id: number | null;
  name: string;
  type: string;
  description: string;
  latitude: number;
  longitude: number;
  address: string;
  source: 'COMMUNITY' | 'OSM' | 'EVENT' | 'ALERT';
  status?: string;
}

export interface EcoAlert {
  id: number;
  alertType: string;
  description: string;
  latitude: number;
  longitude: number;
  address?: string;
  status: 'OPEN' | 'CONFIRMED' | 'RESOLVED';
  confirmations: number;
  createdAt?: string;
}

export interface AirQuality {
  latitude: number;
  longitude: number;
  aqi: number;
  aqiLabel: string;
  co?: number;
  no2?: number;
  o3?: number;
  pm2_5?: number;
  pm10?: number;
}

export interface EcoMapDTO {
  communityPins: MapPin[];
  osmPins: MapPin[];
  airQuality: AirQuality;
  alertPins: EcoAlert[];
}

export interface EcoPlaceSubmit {
  name: string;
  description: string;
  placeType: string;
  latitude: number;
  longitude: number;
  address?: string;
}

@Injectable({ providedIn: 'root' })
export class EcoMapService {
  private readonly base = `${environment.apiUrl}/api/eco/map`;

  constructor(private http: HttpClient) {}

  getMap(lat: number, lng: number, radius = 5): Observable<EcoMapDTO> {
    const params = new HttpParams()
      .set('lat', lat.toString())
      .set('lng', lng.toString())
      .set('radius', radius.toString());
    return this.http.get<EcoMapDTO>(this.base, { params });
  }

  submitPin(place: EcoPlaceSubmit): Observable<any> {
    return this.http.post(`${this.base}/pins`, place);
  }

  verifyPin(id: number): Observable<any> {
    return this.http.put(`${this.base}/pins/${id}/verify`, {});
  }

  getPending(): Observable<MapPin[]> {
    return this.http.get<MapPin[]>(`${this.base}/pins/pending`);
  }

  getMyPins(): Observable<MapPin[]> {
    return this.http.get<MapPin[]>(`${this.base}/pins/mine`);
  }

  // ─── ECO ALERTS ───
  private readonly alertBase = `${environment.apiUrl}/api/eco/alerts`;

  reportAlert(alert: Partial<EcoAlert>): Observable<EcoAlert> {
    return this.http.post<EcoAlert>(this.alertBase, alert);
  }

  confirmAlert(id: number): Observable<any> {
    return this.http.put(`${this.alertBase}/${id}/confirm`, {});
  }

  resolveAlert(id: number): Observable<any> {
    return this.http.put(`${this.alertBase}/${id}/status?status=RESOLVED`, {});
  }

  // ─── LOCATION SHARING ───
  private readonly locBase = `${environment.apiUrl}/api/eco/location`;

  updateLocation(lat: number, lng: number): Observable<any> {
    return this.http.put(this.locBase, { latitude: lat, longitude: lng });
  }

  stopLocationSharing(): Observable<any> {
    return this.http.delete(this.locBase);
  }
}
