import { Routes } from '@angular/router';
import { LandingComponent } from './components/landing/landing.component';
import { TrackerComponent } from './components/tracker/tracker.component';
import { ShopComponent } from './components/shop/shop.component';
import { EventsComponent } from './components/events/events.component';
import { DonateComponent } from './components/donate/donate.component';

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
  {
    path: 'formations',
    loadComponent: () => import('./components/formations/formations.component').then(m => m.FormationsComponent)
  },
  {
    path: 'formations/:id',
    loadComponent: () => import('./components/formation-detail/formation-detail.component').then(m => m.FormationDetailComponent)
  },
  {
    path: 'formations/:id/quiz',
    loadComponent: () => import('./components/quiz/quiz.component').then(m => m.QuizComponent)
  },
  {
    path: 'checkout',
    loadComponent: () => import('./components/checkout/checkout.component').then(m => m.CheckoutComponent)
  },
  {
    path: 'cart',
    loadComponent: () => import('./components/cart/cart').then(m => m.CartComponent)
  },
  {
    path: 'orders',
    loadComponent: () => import('./components/orders/orders.component').then(m => m.OrdersComponent)
  },
  {
    path: 'admin',
    loadComponent: () => import('./components/admin/admin.component').then(m => m.AdminComponent)
  },
  { path: '**', redirectTo: '' }
];
