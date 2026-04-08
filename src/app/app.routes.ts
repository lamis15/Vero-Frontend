import { Routes } from '@angular/router';
import { LandingComponent } from './components/landing/landing.component';
import { TrackerComponent } from './components/tracker/tracker.component';
import { ShopComponent } from './components/shop/shop.component';
import { EventsComponent } from './components/events/events.component';
import { DonateComponent } from './components/donate/donate.component';
import { PetitionComponent } from './components/petition/petition';

export const routes: Routes = [
  { path: '', component: LandingComponent },
  { path: 'track', component: TrackerComponent },
  { path: 'shop', component: ShopComponent },
  { path: 'events', component: EventsComponent },
  {
    path: 'donate',
    loadComponent: () => import('./components/donate/donate.component').then(m => m.DonateComponent)
  },
  {
    path: 'login',
    loadComponent: () => import('./components/login/login.component').then(m => m.LoginComponent)
  },
  { 
    path: 'community', 
    loadComponent: () => import('./components/community/community.component').then(m => m.CommunityComponent) 
  },
  { 
    path: 'community/:id', 
    loadComponent: () => import('./components/community/thread/thread.component').then(m => m.ThreadComponent) 
  },
  { path: 'petitions', component: PetitionComponent },
  { path: '**', redirectTo: '' }
  
  
];
