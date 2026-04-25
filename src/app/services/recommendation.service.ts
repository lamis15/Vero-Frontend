import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Product } from './product.models';

@Injectable({ providedIn: 'root' })
export class RecommendationService {
  private readonly API = `${environment.apiUrl}/api/ai`;

  constructor(private http: HttpClient) {}

  getRecommendationsForCurrentUser(): Observable<Product[]> {
    return this.http.get<Product[]>(`${this.API}/recommend/me`);
  }

  getRecommendationsForUser(userId: number): Observable<Product[]> {
    return this.http.get<Product[]>(`${this.API}/recommend/user/${userId}`);
  }

  getRecommendationsByCategory(category: string): Observable<Product[]> {
    return this.http.get<Product[]>(`${this.API}/recommend/category/${category}`);
  }

  getEcoScore(produitId: number): Observable<string> {
    return this.http.get(`${this.API}/eco-score/${produitId}`, { responseType: 'text' });
  }
}
