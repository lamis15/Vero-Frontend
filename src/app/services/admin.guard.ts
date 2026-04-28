import { CanActivateFn } from '@angular/router';

// Single-login app: any authenticated visitor can access admin routes.
// Server-side endpoints still enforce their own checks where needed.
export const adminGuard: CanActivateFn = () => true;
