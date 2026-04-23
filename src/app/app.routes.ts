import { Routes } from '@angular/router';

export const routes: Routes = [
  { 
    path: '', 
    loadComponent: () => import('./components/landing/landing.component').then(m => m.LandingComponent) 
  },
  { 
    path: 'track', 
    loadComponent: () => import('./components/tracker/tracker.component').then(m => m.TrackerComponent) 
  },
  {
    path: 'map',
    loadComponent: () => import('./components/eco-map/eco-map.component').then(m => m.EcoMapComponent)
  },
  { 
    path: 'shop', 
    loadComponent: () => import('./components/shop/shop.component').then(m => m.ShopComponent) 
  },
  { 
    path: 'events', 
    loadComponent: () => import('./components/events/events.component').then(m => m.EventsComponent) 
  },
  {
    path: 'donate',
    loadComponent: () => import('./components/donate/donate.component').then(m => m.DonateComponent)
  },
  {
    path: 'donate/success',
    loadComponent: () => import('./components/donate/donate-success.component').then(m => m.DonateSuccessComponent)
  },
  {
    path: 'donate/cancel',
    redirectTo: '/donate'
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
  {
    path: 'my-reservations',
    loadComponent: () => import('./components/my-reservations/my-reservations.component').then(m => m.MyReservationsComponent)
  },
 {
  path: 'petitions',
  loadComponent: () => import('./components/petition/petition')
    .then(m => m.PetitionComponent)
},
  { path: '**', redirectTo: '' }


];
