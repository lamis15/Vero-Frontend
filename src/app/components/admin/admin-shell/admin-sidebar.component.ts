import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { UserResponse } from '../../../services/auth.service';

@Component({
  selector: 'app-admin-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './admin-sidebar.component.html'
})
export class AdminSidebarComponent {
  @Input() admin: UserResponse | null = null;
  @Output() logout = new EventEmitter<void>();

  initial(name?: string): string {
    return (name || '?').trim().charAt(0).toUpperCase();
  }
}
