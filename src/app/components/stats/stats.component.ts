import { Component } from '@angular/core';
import { FadeInDirective } from '../../fade-in.directive';

@Component({
  selector: 'app-stats',
  standalone: true,
  imports: [FadeInDirective],
  templateUrl: './stats.component.html',
  styleUrl: './stats.component.css'
})
export class StatsComponent {
}
