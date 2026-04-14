import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ProductService } from '../../services/product.service';
import { OrderService } from '../../services/order.service';
import { UserService } from '../../services/user.service';
import { NotificationService } from '../../services/notification.service';
import { FormationService } from '../../services/formation.service';
import { SessionService } from '../../services/session.service';
import { Product, Order } from '../../services/product.models';
import { Formation, FormationResource, FormationStatus, Session, SessionStatus } from '../../services/formation.models';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.css'
})
export class AdminComponent implements OnInit {
  currentUser: any = null;
  activeTab: string = 'overview';
  loading = true;

  // Stats
  stats = {
    totalUsers: 0,
    totalOrders: 0,
    totalProducts: 0,
    totalRevenue: 0
  };

  // Products
  products: Product[] = [];
  productsLoading = false;
  showProductModal = false;
  editingProduct: Product | null = null;
  productForm = {
    name: '',
    description: '',
    price: 0,
    stock: 0,
    category: 'FOOD',
    image: '',
    origin: '',
    isEcological: true
  };
  selectedImageFile: File | null = null;
  imagePreview: string | null = null;

  // Orders
  orders: any[] = [];
  ordersLoading = false;
  selectedOrder: any | null = null;
  orderCustomers: Map<number, any> = new Map(); // Cache customer data

  categories = ['NATURAL_COSMETICS', 'ECO_FRIENDLY_HOME', 'SUSTAINABLE_FASHION', 'KITCHEN_AND_DINING', 'ECO_GARDENING', 'ECO_PET_PRODUCTS', 'ECO_GIFT_SETS'];

  // Category mapping for display (same as shop)
  categoryEmojis: Record<string, string> = {
    'NATURAL_COSMETICS': '🌿',
    'ECO_FRIENDLY_HOME': '🏠',
    'SUSTAINABLE_FASHION': '👕',
    'KITCHEN_AND_DINING': '🍽️',
    'ECO_GARDENING': '🌱',
    'ECO_PET_PRODUCTS': '🐾',
    'ECO_GIFT_SETS': '🎁'
  };

  categoryColors: Record<string, string> = {
    'NATURAL_COSMETICS': '#f0ece4',
    'ECO_FRIENDLY_HOME': '#e8f4e8',
    'SUSTAINABLE_FASHION': '#e8e4dc',
    'KITCHEN_AND_DINING': '#e4ede4',
    'ECO_GARDENING': '#dce8dc',
    'ECO_PET_PRODUCTS': '#ece8e4',
    'ECO_GIFT_SETS': '#f4e8e8'
  };

  // Countries list with flags
  countries = [
    { name: 'France', flag: '🇫🇷' },
    { name: 'Italy', flag: '🇮🇹' },
    { name: 'Spain', flag: '🇪🇸' },
    { name: 'Germany', flag: '🇩🇪' },
    { name: 'Portugal', flag: '🇵🇹' },
    { name: 'Netherlands', flag: '🇳🇱' },
    { name: 'Belgium', flag: '🇧🇪' },
    { name: 'Switzerland', flag: '🇨🇭' },
    { name: 'Austria', flag: '🇦🇹' },
    { name: 'Greece', flag: '🇬🇷' },
    { name: 'Turkey', flag: '🇹🇷' },
    { name: 'Morocco', flag: '🇲🇦' },
    { name: 'Tunisia', flag: '🇹🇳' },
    { name: 'Egypt', flag: '🇪🇬' },
    { name: 'USA', flag: '🇺🇸' },
    { name: 'Canada', flag: '🇨🇦' },
    { name: 'Mexico', flag: '🇲🇽' },
    { name: 'Brazil', flag: '🇧🇷' },
    { name: 'Argentina', flag: '🇦🇷' },
    { name: 'Colombia', flag: '🇨🇴' },
    { name: 'UK', flag: '🇬🇧' },
    { name: 'Ireland', flag: '🇮🇪' },
    { name: 'Sweden', flag: '🇸🇪' },
    { name: 'Norway', flag: '🇳🇴' },
    { name: 'Denmark', flag: '🇩🇰' },
    { name: 'Finland', flag: '🇫🇮' },
    { name: 'Poland', flag: '🇵🇱' },
    { name: 'Czech Republic', flag: '🇨🇿' },
    { name: 'Hungary', flag: '🇭🇺' },
    { name: 'Romania', flag: '🇷🇴' },
    { name: 'Japan', flag: '🇯🇵' },
    { name: 'China', flag: '🇨🇳' },
    { name: 'South Korea', flag: '🇰🇷' },
    { name: 'India', flag: '🇮🇳' },
    { name: 'Thailand', flag: '🇹🇭' },
    { name: 'Vietnam', flag: '🇻🇳' },
    { name: 'Indonesia', flag: '🇮🇩' },
    { name: 'Philippines', flag: '🇵🇭' },
    { name: 'Malaysia', flag: '🇲🇾' },
    { name: 'Singapore', flag: '🇸🇬' },
    { name: 'Australia', flag: '🇦🇺' },
    { name: 'New Zealand', flag: '🇳🇿' },
    { name: 'South Africa', flag: '🇿🇦' },
    { name: 'Kenya', flag: '🇰🇪' },
    { name: 'Ethiopia', flag: '🇪🇹' },
    { name: 'Local', flag: '🌍' }
  ];

  // Formations
  formations: Formation[] = [];
  formationsLoading = false;
  showFormationModal = false;
  editingFormation: Formation | null = null;
  formationForm: {
    title: string;
    description: string;
    duration: number;
    maxCapacity: number;
    price: number;
    status: FormationStatus;
  } = {
    title: '',
    description: '',
    duration: 0,
    maxCapacity: 0,
    price: 0,
    status: 'PLANNED' as FormationStatus
  };

  // Sessions
  sessions: Session[] = [];
  sessionsLoading = false;
  showSessionModal = false;
  editingSession: Session | null = null;
  sessionForm = {
    title: '',
    startDate: '',
    endDate: '',
    status: 'SCHEDULED' as SessionStatus,
    meetLink: '',
    trainerId: 0,
    formationId: 0
  };
  selectedFormationForSessions: Formation | null = null;

  formationStatuses = ['PLANNED', 'IN_PROGRESS', 'COMPLETED'];
  sessionStatuses = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

  // AI Description
  generatingDescription = false;

  // Resources
  selectedResourceFile: File | null = null;
  resourceUploading = false;
  formationResources: FormationResource[] = [];

  // Quiz
  showQuizModal = false;
  quizForm: {
    title: string;
    passingScore: number;
    questions: Array<{ text: string; options: Array<{ text: string; isCorrect: boolean }> }>;
  } = { title: '', passingScore: 80, questions: [] };

  constructor(
    private authService: AuthService,
    private productService: ProductService,
    private orderService: OrderService,
    private userService: UserService,
    private formationService: FormationService,
    private sessionService: SessionService,
    private router: Router,
    private notificationService: NotificationService
  ) {}

  ngOnInit() {
    this.authService.getCurrentUser().subscribe({
      next: (user) => {
        this.currentUser = user;
        if (user.role !== 'ADMIN') {
          this.router.navigate(['/']);
        } else {
          this.loadDashboardData();
        }
      },
      error: (err) => {
        console.error('Error loading user:', err);
        this.router.navigate(['/login']);
      }
    });
  }

  loadDashboardData() {
    this.loadProducts();
    this.loadOrders();
    this.loadFormations();
    this.loading = false;
  }

  setActiveTab(tab: string) {
    this.activeTab = tab;
    if (tab === 'products' && this.products.length === 0) {
      this.loadProducts();
    }
    if (tab === 'orders' && this.orders.length === 0) {
      this.loadOrders();
    }
    if (tab === 'formations' && this.formations.length === 0) {
      this.loadFormations();
    }
  }

  // Product Management
  loadProducts() {
    this.productsLoading = true;
    this.productService.getAll().subscribe({
      next: (products) => {
        this.products = products;
        this.stats.totalProducts = products.length;
        this.productsLoading = false;
      },
      error: (err) => {
        console.error('Error loading products:', err);
        this.productsLoading = false;
      }
    });
  }

  openProductModal(product?: Product) {
    if (product) {
      this.editingProduct = product;
      this.productForm = {
        name: product.name,
        description: product.description,
        price: product.price,
        stock: product.stock,
        category: product.category,
        image: product.image || '',
        origin: product.origin || '',
        isEcological: product.isEcological
      };
      this.imagePreview = product.image || null;
    } else {
      this.editingProduct = null;
      this.productForm = {
        name: '',
        description: '',
        price: 0,
        stock: 0,
        category: 'NATURAL_COSMETICS' as any,
        image: '',
        origin: '',
        isEcological: true
      };
      this.imagePreview = null;
    }
    this.selectedImageFile = null;
    this.showProductModal = true;
  }

  closeProductModal() {
    this.showProductModal = false;
    this.editingProduct = null;
    this.selectedImageFile = null;
    this.imagePreview = null;
  }

  onImageSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        this.notificationService.error('Please select a valid image file');
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        this.notificationService.error('Image size should be less than 5MB');
        return;
      }

      this.selectedImageFile = file;

      // Create preview
      const reader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>) => {
        this.imagePreview = e.target?.result as string;
        this.productForm.image = e.target?.result as string; // Store base64 in form
      };
      reader.readAsDataURL(file);
    }
  }

  removeImage() {
    this.selectedImageFile = null;
    this.imagePreview = null;
    this.productForm.image = '';
  }

  triggerFileInput() {
    const fileInput = document.getElementById('imageUpload') as HTMLInputElement;
    fileInput?.click();
  }

  saveProduct() {
    // Validation des champs obligatoires
    if (!this.productForm.name || this.productForm.name.trim() === '') {
      this.notificationService.warning('Please enter a product name');
      return;
    }

    if (!this.productForm.description || this.productForm.description.trim() === '') {
      this.notificationService.warning('Please enter a product description');
      return;
    }

    if (!this.productForm.price || this.productForm.price <= 0) {
      this.notificationService.warning('Please enter a valid price (greater than 0)');
      return;
    }

    if (this.productForm.stock === null || this.productForm.stock === undefined || this.productForm.stock < 0) {
      this.notificationService.warning('Please enter a valid stock quantity (0 or greater)');
      return;
    }

    if (!this.productForm.category) {
      this.notificationService.warning('Please select a category');
      return;
    }

    if (!this.productForm.origin || this.productForm.origin.trim() === '') {
      this.notificationService.warning('Please select a country of origin');
      return;
    }

    if (!this.productForm.image || this.productForm.image.trim() === '') {
      this.notificationService.warning('Please upload a product image');
      return;
    }

    const productData: any = { ...this.productForm };
    
    if (this.editingProduct) {
      productData.id = this.editingProduct.id;
      this.productService.update(productData).subscribe({
        next: () => {
          this.notificationService.success('Product updated successfully!');
          this.loadProducts();
          this.closeProductModal();
        },
        error: (err) => {
          console.error('Error updating product:', err);
          this.notificationService.error('Error updating product. Please try again.');
        }
      });
    } else {
      this.productService.create(productData).subscribe({
        next: () => {
          this.notificationService.success('Product created successfully!');
          this.loadProducts();
          this.closeProductModal();
        },
        error: (err) => {
          console.error('Error creating product:', err);
          this.notificationService.error('Error creating product. Please try again.');
        }
      });
    }
  }

  deleteProduct(id: number) {
    if (confirm('Are you sure you want to delete this product?')) {
      this.productService.delete(id).subscribe({
        next: () => this.loadProducts(),
        error: (err) => console.error('Error deleting product:', err)
      });
    }
  }

  // Order Management
  loadOrders() {
    this.ordersLoading = true;
    
    // Load orders and users in parallel
    forkJoin({
      orders: this.orderService.getAll(),
      users: this.userService.getAll()
    }).subscribe({
      next: ({ orders, users }) => {
        // Create a map of users for quick lookup
        const userMap = new Map(users.map(u => [u.id, u]));
        
        // Enhance orders with customer names
        this.orders = orders.map(order => ({
          ...order,
          customerName: userMap.get(order.idUser)?.fullName || 'Unknown User',
          customerEmail: userMap.get(order.idUser)?.email || ''
        })).sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });
        
        this.stats.totalOrders = orders.length;
        this.stats.totalRevenue = orders
          .filter(o => o.status === 'ACCEPTED')
          .reduce((sum, o) => sum + o.totalAmount, 0);
        this.ordersLoading = false;
      },
      error: (err) => {
        console.error('Error loading orders:', err);
        this.ordersLoading = false;
      }
    });
  }

  viewOrderDetails(order: any) {
    this.selectedOrder = order;
  }

  closeOrderDetails() {
    this.selectedOrder = null;
  }

  updateOrderStatus(orderId: number, status: string) {
    this.orderService.updateStatus(orderId, status as any).subscribe({
      next: () => {
        this.loadOrders();
        if (this.selectedOrder && this.selectedOrder.id === orderId) {
          this.selectedOrder.status = status;
        }
      },
      error: (err) => console.error('Error updating order status:', err)
    });
  }

  getProductNames(order: any): string {
    if (!order.produits || order.produits.length === 0) {
      return 'No products';
    }
    return order.produits.map((p: any) => p.name).join(', ');
  }

  getStatusClass(status: string): string {
    const statusMap: Record<string, string> = {
      'PENDING': 'status-pending',
      'ACCEPTED': 'status-accepted',
      'REJECTED': 'status-rejected'
    };
    return statusMap[status] || 'status-pending';
  }

  getProductEmoji(category: string): string {
    return this.categoryEmojis[category] || '📦';
  }

  getProductColor(category: string): string {
    return this.categoryColors[category] || '#f0f0f0';
  }

  // Formation Management
  loadFormations() {
    this.formationsLoading = true;
    this.formationService.getAll().subscribe({
      next: (formations) => {
        this.formations = formations;
        this.formationsLoading = false;
      },
      error: (err) => {
        console.error('Error loading formations:', err);
        this.notificationService.error('Error loading formations');
        this.formationsLoading = false;
      }
    });
  }

  openFormationModal(formation?: Formation) {
    if (formation) {
      this.editingFormation = formation;
      this.formationForm = {
        title: formation.title,
        description: formation.description,
        duration: formation.duration,
        maxCapacity: formation.maxCapacity,
        price: formation.price || 0,
        status: formation.status
      };
    } else {
      this.editingFormation = null;
      this.formationForm = {
        title: '',
        description: '',
        duration: 0,
        maxCapacity: 0,
        price: 0,
        status: 'PLANNED' as FormationStatus
      };
    }
    this.showFormationModal = true;
  }

  closeFormationModal() {
    this.showFormationModal = false;
    this.editingFormation = null;
  }

  saveFormation() {
    if (!this.formationForm.title || this.formationForm.title.trim() === '') {
      this.notificationService.warning('Please enter a formation title');
      return;
    }

    if (!this.formationForm.description || this.formationForm.description.trim() === '') {
      this.notificationService.warning('Please enter a formation description');
      return;
    }

    if (!this.formationForm.duration || this.formationForm.duration <= 0) {
      this.notificationService.warning('Please enter a valid duration (greater than 0)');
      return;
    }

    if (!this.formationForm.maxCapacity || this.formationForm.maxCapacity <= 0) {
      this.notificationService.warning('Please enter a valid capacity (greater than 0)');
      return;
    }

    const formationData: any = { ...this.formationForm };
    
    if (this.editingFormation) {
      formationData.id = this.editingFormation.id;
      formationData.participantIds = this.editingFormation.participantIds || [];
      this.formationService.update(formationData).subscribe({
        next: () => {
          this.notificationService.success('Formation updated successfully!');
          this.loadFormations();
          this.closeFormationModal();
        },
        error: (err) => {
          console.error('Error updating formation:', err);
          this.notificationService.error('Error updating formation. Please try again.');
        }
      });
    } else {
      this.formationService.create(formationData).subscribe({
        next: () => {
          this.notificationService.success('Formation created successfully!');
          this.loadFormations();
          this.closeFormationModal();
        },
        error: (err) => {
          console.error('Error creating formation:', err);
          this.notificationService.error('Error creating formation. Please try again.');
        }
      });
    }
  }

  deleteFormation(id: number) {
    if (confirm('Are you sure you want to delete this formation? All associated sessions will also be deleted.')) {
      this.formationService.delete(id).subscribe({
        next: () => {
          this.notificationService.success('Formation deleted successfully!');
          this.loadFormations();
        },
        error: (err) => {
          console.error('Error deleting formation:', err);
          this.notificationService.error('Error deleting formation. Please try again.');
        }
      });
    }
  }

  updateFormationStatus(id: number, status: FormationStatus) {
    this.formationService.updateStatus(id, status).subscribe({
      next: () => {
        this.notificationService.success('Formation status updated!');
        this.loadFormations();
      },
      error: (err) => {
        console.error('Error updating formation status:', err);
        this.notificationService.error('Error updating status. Please try again.');
      }
    });
  }

  // Session Management
  viewFormationSessions(formation: Formation) {
    this.selectedFormationForSessions = formation;
    this.loadSessionsForFormation(formation.id!);
  }

  closeSessionsView() {
    this.selectedFormationForSessions = null;
    this.sessions = [];
  }

  loadSessionsForFormation(formationId: number) {
    this.sessionsLoading = true;
    this.sessionService.getByFormation(formationId).subscribe({
      next: (sessions) => {
        this.sessions = sessions;
        this.sessionsLoading = false;
      },
      error: (err) => {
        console.error('Error loading sessions:', err);
        this.notificationService.error('Error loading sessions');
        this.sessionsLoading = false;
      }
    });
  }

  openSessionModal(session?: Session) {
    if (!this.selectedFormationForSessions) {
      this.notificationService.warning('Please select a formation first');
      return;
    }

    if (session) {
      this.editingSession = session;
      this.sessionForm = {
        title: session.title,
        startDate: session.startDate.substring(0, 16), // Format for datetime-local
        endDate: session.endDate.substring(0, 16),
        status: session.status,
        meetLink: session.meetLink || '',
        trainerId: session.trainerId,
        formationId: this.selectedFormationForSessions.id!
      };
    } else {
      this.editingSession = null;
      this.sessionForm = {
        title: '',
        startDate: '',
        endDate: '',
        status: 'SCHEDULED' as SessionStatus,
        meetLink: '',
        trainerId: this.currentUser?.id || 0,
        formationId: this.selectedFormationForSessions.id!
      };
    }
    this.showSessionModal = true;
  }

  closeSessionModal() {
    this.showSessionModal = false;
    this.editingSession = null;
  }

  saveSession() {
    if (!this.sessionForm.title || this.sessionForm.title.trim() === '') {
      this.notificationService.warning('Please enter a session title');
      return;
    }

    if (!this.sessionForm.startDate) {
      this.notificationService.warning('Please select a start date');
      return;
    }

    if (!this.sessionForm.endDate) {
      this.notificationService.warning('Please select an end date');
      return;
    }

    const startDate = new Date(this.sessionForm.startDate);
    const endDate = new Date(this.sessionForm.endDate);

    if (endDate <= startDate) {
      this.notificationService.warning('End date must be after start date');
      return;
    }

    const sessionData: any = {
      title: this.sessionForm.title,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      status: this.sessionForm.status,
      meetLink: this.sessionForm.meetLink,
      trainerId: this.sessionForm.trainerId
    };
    
    if (this.editingSession) {
      sessionData.id = this.editingSession.id;
      this.sessionService.update(sessionData).subscribe({
        next: () => {
          this.notificationService.success('Session updated successfully!');
          this.loadSessionsForFormation(this.selectedFormationForSessions!.id!);
          this.closeSessionModal();
        },
        error: (err) => {
          console.error('Error updating session:', err);
          this.notificationService.error('Error updating session. Please try again.');
        }
      });
    } else {
      this.sessionService.create(sessionData, this.sessionForm.formationId).subscribe({
        next: () => {
          this.notificationService.success('Session created successfully!');
          this.loadSessionsForFormation(this.selectedFormationForSessions!.id!);
          this.closeSessionModal();
        },
        error: (err) => {
          console.error('Error creating session:', err);
          this.notificationService.error('Error creating session. Please try again.');
        }
      });
    }
  }

  deleteSession(id: number) {
    if (confirm('Are you sure you want to delete this session?')) {
      this.sessionService.delete(id).subscribe({
        next: () => {
          this.notificationService.success('Session deleted successfully!');
          this.loadSessionsForFormation(this.selectedFormationForSessions!.id!);
        },
        error: (err) => {
          console.error('Error deleting session:', err);
          this.notificationService.error('Error deleting session. Please try again.');
        }
      });
    }
  }

  updateSessionStatus(id: number, status: SessionStatus) {
    this.sessionService.updateStatus(id, status).subscribe({
      next: () => {
        this.notificationService.success('Session status updated!');
        this.loadSessionsForFormation(this.selectedFormationForSessions!.id!);
      },
      error: (err) => {
        console.error('Error updating session status:', err);
        this.notificationService.error('Error updating status. Please try again.');
      }
    });
  }

  getFormationStatusClass(status: FormationStatus): string {
    const statusMap: Record<string, string> = {
      'PLANNED': 'status-planned',
      'IN_PROGRESS': 'status-in-progress',
      'COMPLETED': 'status-completed'
    };
    return statusMap[status] || 'status-planned';
  }

  getSessionStatusClass(status: SessionStatus): string {
    const statusMap: Record<string, string> = {
      'SCHEDULED': 'status-scheduled',
      'IN_PROGRESS': 'status-in-progress',
      'COMPLETED': 'status-completed',
      'CANCELLED': 'status-cancelled'
    };
    return statusMap[status] || 'status-scheduled';
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // AI Description Generation
  generateDescription(): void {
    if (!this.formationForm.title || this.formationForm.title.trim() === '') {
      this.notificationService.warning('Veuillez saisir un titre avant de générer une description');
      return;
    }
    this.generatingDescription = true;
    this.formationService.generateDescription(this.formationForm.title, this.formationForm.duration).subscribe({
      next: (res) => {
        this.formationForm.description = res.description;
        this.generatingDescription = false;
      },
      error: (err) => {
        console.error('Error generating description:', err);
        this.notificationService.error('Erreur lors de la génération de la description');
        this.generatingDescription = false;
      }
    });
  }

  // Pin Toggle
  togglePin(formation: Formation): void {
    this.formationService.togglePin(formation.id!).subscribe({
      next: (updated) => {
        formation.pinned = updated.pinned;
        this.formations.sort((a, b) => {
          if (a.pinned === b.pinned) return 0;
          return a.pinned ? -1 : 1;
        });
      },
      error: (err) => {
        console.error('Error toggling pin:', err);
        this.notificationService.error("Erreur lors du changement d'épinglage");
      }
    });
  }

  // Resources
  onResourceFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.selectedResourceFile = input.files[0];
    }
  }

  uploadResource(formationId: number): void {
    if (!this.selectedResourceFile) {
      this.notificationService.warning('Veuillez sélectionner un fichier');
      return;
    }
    this.resourceUploading = true;
    this.formationService.uploadResource(formationId, this.selectedResourceFile).subscribe({
      next: () => {
        this.notificationService.success('Ressource uploadée avec succès');
        this.selectedResourceFile = null;
        this.resourceUploading = false;
        this.loadResources(formationId);
      },
      error: (err) => {
        console.error('Error uploading resource:', err);
        this.notificationService.error("Erreur lors de l'upload de la ressource");
        this.resourceUploading = false;
      }
    });
  }

  deleteResource(formationId: number, resourceId: number): void {
    if (confirm('Supprimer cette ressource ?')) {
      this.formationService.deleteResource(formationId, resourceId).subscribe({
        next: () => {
          this.notificationService.success('Ressource supprimée');
          this.loadResources(formationId);
        },
        error: (err) => {
          console.error('Error deleting resource:', err);
          this.notificationService.error('Erreur lors de la suppression');
        }
      });
    }
  }

  loadResources(formationId: number): void {
    this.formationService.getResources(formationId).subscribe({
      next: (resources) => { this.formationResources = resources; },
      error: (err) => { console.error('Error loading resources:', err); }
    });
  }

  // Quiz
  openQuizModal(): void {
    this.quizForm = { title: '', passingScore: 80, questions: [] };
    this.showQuizModal = true;
  }

  closeQuizModal(): void {
    this.showQuizModal = false;
  }

  addQuestion(): void {
    this.quizForm.questions.push({ text: '', options: [
      { text: '', isCorrect: false },
      { text: '', isCorrect: false }
    ]});
  }

  removeQuestion(index: number): void {
    this.quizForm.questions.splice(index, 1);
  }

  addOption(qIndex: number): void {
    this.quizForm.questions[qIndex].options.push({ text: '', isCorrect: false });
  }

  removeOption(qIndex: number, oIndex: number): void {
    this.quizForm.questions[qIndex].options.splice(oIndex, 1);
  }

  saveQuiz(formationId: number): void {
    if (!this.quizForm.title.trim()) {
      this.notificationService.warning('Veuillez saisir un titre pour le quiz');
      return;
    }
    if (this.quizForm.questions.length === 0) {
      this.notificationService.warning('Veuillez ajouter au moins une question');
      return;
    }
    this.formationService.createQuiz(formationId, this.quizForm).subscribe({
      next: () => {
        this.notificationService.success('Quiz créé avec succès');
        this.closeQuizModal();
      },
      error: (err) => {
        console.error('Error creating quiz:', err);
        this.notificationService.error('Erreur lors de la création du quiz');
      }
    });
  }
}
