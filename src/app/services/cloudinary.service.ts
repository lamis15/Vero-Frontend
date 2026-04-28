import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class CloudinaryService {
  private cloudName = environment.cloudinary.cloudName;
  private uploadPreset = environment.cloudinary.uploadPreset;
  private apiUrl = `https://api.cloudinary.com/v1_1/${this.cloudName}/image/upload`;

  constructor(private http: HttpClient) {}

  /**
   * Upload une image vers Cloudinary (unsigned upload)
   */
  uploadImageWithTransform(file: File, width: number = 800, height: number = 800): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', this.uploadPreset);
    
    console.log('📤 Uploading to Cloudinary:', {
      cloudName: this.cloudName,
      uploadPreset: this.uploadPreset,
      apiUrl: this.apiUrl,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type
    });

    // Use fetch instead of HttpClient to avoid interceptors adding Authorization header
    return new Observable(observer => {
      fetch(this.apiUrl, {
        method: 'POST',
        body: formData
      })
      .then(response => {
        if (!response.ok) {
          throw new Error(`Cloudinary upload failed: ${response.status} ${response.statusText}`);
        }
        return response.json();
      })
      .then(data => {
        console.log('✅ Cloudinary upload SUCCESS:', data);
        observer.next(data);
        observer.complete();
      })
      .catch(error => {
        console.error('❌ Cloudinary upload ERROR:', error);
        observer.error(error);
      });
    });
  }
}
