import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { OrderService } from '../../services/order.service';
import { AuthService } from '../../services/auth.service';
import { Order } from '../../services/product.models';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './orders.component.html',
  styleUrl: './orders.component.css'
})
export class OrdersComponent implements OnInit {
  orders: Order[] = [];
  loading = true;
  error: string | null = null;
  successMessage: string | null = null;

  constructor(
    private orderService: OrderService,
    private authService: AuthService,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    // Check for success message
    this.route.queryParams.subscribe(params => {
      if (params['success'] === 'true') {
        this.successMessage = `Payment successful! Order #${params['orderId']} has been placed.`;
        setTimeout(() => {
          this.successMessage = null;
        }, 5000);
      }
    });

    this.loadOrders();
  }

  loadOrders() {
    this.loading = true;
    this.error = null;

    // Get current user first, then load their orders
    this.authService.getCurrentUser().subscribe({
      next: (user) => {
        this.orderService.getByUser(user.id).subscribe({
          next: (orders) => {
            this.orders = orders.sort((a, b) => {
              const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
              const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
              return dateB - dateA;
            });
            this.loading = false;
          },
          error: (err) => {
            console.error('Error loading orders:', err);
            this.error = 'Failed to load orders';
            this.loading = false;
          }
        });
      },
      error: (err) => {
        console.error('Error getting current user:', err);
        this.error = 'Failed to authenticate user';
        this.loading = false;
      }
    });
  }

  getStatusClass(status: string): string {
    const statusMap: Record<string, string> = {
      'PENDING': 'status-pending',
      'ACCEPTED': 'status-accepted',
      'REJECTED': 'status-rejected'
    };
    return statusMap[status] || 'status-pending';
  }

  getStatusLabel(status: string): string {
    const labelMap: Record<string, string> = {
      'PENDING': 'Pending',
      'ACCEPTED': 'Accepted',
      'REJECTED': 'Rejected'
    };
    return labelMap[status] || status;
  }
}
