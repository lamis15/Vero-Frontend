import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserResponse } from '../../../services/auth.service';

interface CalendarDate { num: number; isToday: boolean; }

@Component({
  selector: 'app-admin-right-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-right-panel.component.html'
})
export class AdminRightPanelComponent implements OnInit {
  @Input() admin: UserResponse | null = null;

  currentMonth = '';
  calendarDates: CalendarDate[] = [];

  ngOnInit(): void {
    const now = new Date();
    this.currentMonth = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const today = now.getDate();
    this.calendarDates = [-3, -2, -1, 0, 1, 2, 3].map(o => ({ num: today + o, isToday: o === 0 }));
  }

  initial(name?: string): string {
    return (name || '?').trim().charAt(0).toUpperCase();
  }
}
