import { Routes } from '@angular/router';
import { authGuard } from './services/auth.guard';
import { adminGuard } from './services/admin.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./components/landing/landing.component').then(m => m.LandingComponent)
  },
  {
    path: 'track',
    loadComponent: () =>
      import('./components/tracker/tracker.component').then(m => m.TrackerComponent)
  },
  {
    path: 'map',
    loadComponent: () =>
      import('./components/eco-map/eco-map.component').then(m => m.EcoMapComponent)
  },
  {
    path: 'shop',
    loadComponent: () =>
      import('./components/shop/shop.component').then(m => m.ShopComponent)
  },
  {
    path: 'events',
    loadComponent: () =>
      import('./components/events/events.component').then(m => m.EventsComponent)
  },
  {
    path: 'donate',
    loadComponent: () =>
      import('./components/donate/donate.component').then(m => m.DonateComponent)
  },
  {
    path: 'donate/success',
    loadComponent: () =>
      import('./components/donate/donate-success.component').then(m => m.DonateSuccessComponent)
  },
  {
    path: 'donate/cancel',
    redirectTo: '/donate'
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./components/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./components/reset-password/reset-password').then(m => m.ResetPassword)
  },
  {
    path: 'profile',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/profile/profile.component').then(m => m.ProfileComponent)
  },
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./components/admin/admin').then(m => m.Admin),
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./components/admin/admin-users/admin-users.component').then(m => m.AdminUsersComponent)
      },
      {
        path: 'users/new',
        loadComponent: () =>
          import('./components/admin/admin-users/admin-user-create.component').then(m => m.AdminUserCreateComponent)
      },
      {
        path: 'users/:id/edit',
        loadComponent: () =>
          import('./components/admin/admin-users/admin-user-edit.component').then(m => m.AdminUserEditComponent)
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./components/admin/admin-dashboard/admin-dashboard.component').then(m => m.AdminDashboardComponent)
      },
      {
        path: 'messages',
        loadComponent: () =>
          import('./components/admin/admin-messages/admin-messages.component').then(m => m.AdminMessagesComponent)
      },
      {
        path: 'forum',
        loadComponent: () =>
          import('./components/admin/admin-forum/admin-forum.component').then(m => m.AdminForumComponent)
      },
      {
        path: 'products',
        loadComponent: () =>
          import('./components/admin/admin-products/admin-products.component').then(m => m.AdminProductsComponent)
      },
      {
        path: 'formations',
        loadComponent: () =>
          import('./components/admin/admin-formations/admin-formations.component').then(m => m.AdminFormationsComponent)
      },
      { path: '**', redirectTo: 'dashboard' }
    ]
  },
  {
    path: 'chat',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/chatbot/chatbot.component').then(m => m.ChatbotComponent)
  },
  {
    path: 'messages',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/messagerie/messagerie.component').then(m => m.MessagerieComponent)
  },
  {
    path: 'community',
    loadComponent: () =>
      import('./components/community/community.component').then(m => m.CommunityComponent)
  },
  {
    path: 'community/:id',
    loadComponent: () =>
      import('./components/community/thread/thread.component').then(m => m.ThreadComponent)
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
    path: 'formations/:id/checkout',
    loadComponent: () => import('./components/formation-checkout/formation-checkout.component').then(m => m.FormationCheckoutComponent)
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
    path: 'my-reservations',
    loadComponent: () =>
      import('./components/my-reservations/my-reservations.component').then(m => m.MyReservationsComponent)
  },
  {
    path: 'petitions',
    loadComponent: () => import('./components/petition/petition')
      .then(m => m.PetitionComponent)
  },
  { path: '**', redirectTo: '' }
];
