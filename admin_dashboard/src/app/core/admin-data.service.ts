import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, firstValueFrom, type Observable, map } from 'rxjs';

import { environment } from '../../environments/environment';
import type {
  AdminRow,
  AgreementRow,
  AgreementStatus,
  AuditRow,
  CategoryRow,
  DashboardBar,
  DashboardStats,
  NotificationRow,
  PostRow,
  PostStatus,
  ReportRow,
  ReportStatus,
  ReviewRow,
  ReviewVisible,
  UserRow,
  UserStatus,
  VerificationRow,
  VerificationStatus,
} from './admin.models';
import { ToastService } from './toast.service';

export interface Settings {
  appName: string;
  supportEmail: string;
  radius: number;
  maintenance: string;
  autoModeration: string;
}

interface Envelope<T> {
  data: T;
}

interface ListPayload<T> {
  items: T[];
  total?: number;
}

interface OverviewPayload {
  stats: {
    total_users: number;
    active_users: number;
    total_posts: number;
    active_posts: number;
    flagged_posts: number;
    conversations: number;
    total_categories: number;
    active_categories: number;
  };
  weekly: { label: string; value: number }[];
  categories: { label: string; value: number }[];
  activity: { id: string; action: string; target: string; admin: string; at: string }[];
}

interface ApiUserRow {
  id: string;
  name: string;
  username: string;
  email: string;
  area: string;
  phone_masked: string;
  phone_verified: boolean;
  face_verified: boolean;
  status: UserStatus;
  listings: number;
  reports: number;
  joined_at: string;
  last_active: string;
}

interface ApiPostRow {
  id: string;
  title: string;
  type: PostRow['type'];
  category: string;
  seller: string;
  area: string;
  price: number | null;
  status: PostStatus;
  reported: boolean;
  created_at: string;
  image: string;
}

interface ApiVerificationRow {
  id: string;
  user: string;
  username: string;
  phone: string;
  face_verified: boolean;
  status: VerificationStatus;
  submitted_at: string;
}

interface ApiCategoryRow {
  id: string;
  name: string;
  slug: string;
  type: CategoryRow['type'];
  active: boolean;
  sort_order: number;
  listings: number;
}

interface ApiReportRow {
  id: string;
  reporter: string;
  target: string;
  target_icon: string;
  listing_title: string;
  reason: string;
  note?: string;
  status: ReportStatus;
  created_at: string;
}

interface ApiAgreementRow {
  id: string;
  listing: string;
  buyer: string;
  buyer_icon: string;
  seller: string;
  seller_icon: string;
  price: number;
  status: AgreementStatus;
  meetup: string;
  updated_at: string;
}

interface ApiReviewRow {
  id: string;
  reviewer: string;
  reviewer_icon: string;
  reviewee: string;
  reviewee_icon: string;
  rating: number;
  comment: string;
  listing_title: string;
  created_at: string;
  visible: ReviewVisible;
}

interface ApiNotificationRow {
  id: string;
  audience: string;
  title: string;
  body: string;
  type: NotificationRow['type'];
  sent_at: string;
  read: boolean;
  stored_locally: boolean;
}

interface ApiAdminRow {
  id: string;
  name: string;
  email: string;
  role: AdminRow['role'];
  active: boolean;
  last_login: string | null;
  temporary_password?: string | null;
}

interface ApiAuditRow {
  id: string;
  admin: string;
  action: string;
  target: string;
  target_icon: string;
  ip: string;
  at: string;
}

interface ApiSettings {
  app_name: string;
  support_email: string;
  radius: number;
  maintenance: string;
  auto_moderation: string;
}

const EMPTY_STATS: DashboardStats = {
  totalUsers: 0,
  activeUsers: 0,
  totalPosts: 0,
  activePosts: 0,
  flaggedPosts: 0,
  conversations: 0,
  totalCategories: 0,
  activeCategories: 0,
};

function fmt(value: string | null | undefined): string {
  if (!value) {
    return '-';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }
  return (
    date.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }) +
    ' ' +
    date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  );
}

function isBroadcast(audience: string): boolean {
  const value = audience.trim().toLowerCase();
  return value.includes('semua') || value.includes('seluruh') || value === 'all';
}

@Injectable({ providedIn: 'root' })
export class AdminDataService {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(ToastService);
  private readonly base = environment.apiBaseUrl;

  private readonly users = new BehaviorSubject<UserRow[]>([]);
  private readonly posts = new BehaviorSubject<PostRow[]>([]);
  private readonly verifications = new BehaviorSubject<VerificationRow[]>([]);
  private readonly categories = new BehaviorSubject<CategoryRow[]>([]);
  private readonly reports = new BehaviorSubject<ReportRow[]>([]);
  private readonly agreements = new BehaviorSubject<AgreementRow[]>([]);
  private readonly reviews = new BehaviorSubject<ReviewRow[]>([]);
  private readonly notifications = new BehaviorSubject<NotificationRow[]>([]);
  private readonly admins = new BehaviorSubject<AdminRow[]>([]);
  private readonly audit = new BehaviorSubject<AuditRow[]>([]);
  private readonly overview = new BehaviorSubject<OverviewPayload>({
    stats: {
      total_users: 0,
      active_users: 0,
      total_posts: 0,
      active_posts: 0,
      flagged_posts: 0,
      conversations: 0,
      total_categories: 0,
      active_categories: 0,
    },
    weekly: [],
    categories: [],
    activity: [],
  });
  private readonly settingsSubject = new BehaviorSubject<Settings>({
    appName: 'C2C Nearby',
    supportEmail: 'support@c2cnearby.id',
    radius: 4000,
    maintenance: 'inactive',
    autoModeration: 'medium',
  });

  readonly stats: Observable<DashboardStats> = this.overview.pipe(
    map((payload) => ({
      totalUsers: payload.stats.total_users,
      activeUsers: payload.stats.active_users,
      totalPosts: payload.stats.total_posts,
      activePosts: payload.stats.active_posts,
      flaggedPosts: payload.stats.flagged_posts,
      conversations: payload.stats.conversations,
      totalCategories: payload.stats.total_categories,
      activeCategories: payload.stats.active_categories,
    })),
  );

  readonly weeklyBars$ = this.overview.pipe(map((payload) => payload.weekly));
  readonly categoryBars$ = this.overview.pipe(map((payload) => payload.categories));
  readonly activity$ = this.overview.pipe(map((payload) => payload.activity));
  readonly settings$ = this.settingsSubject.asObservable();

  /** Prefetch used by the route guard so every screen opens with real rows. */
  async loadAll(): Promise<void> {
    await Promise.allSettled([
      this.loadOverview(),
      this.loadUsers(),
      this.loadPosts(),
      this.loadVerifications(),
      this.loadCategories(),
      this.loadReports(),
      this.loadAgreements(),
      this.loadReviews(),
      this.loadNotifications(),
      this.loadAdmins(),
      this.loadAudit(),
      this.loadSettings(),
    ]);
  }

  private async request<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
    const response = await firstValueFrom(
      this.http.request<Envelope<T>>(options.method ?? 'GET', `${this.base}${path}`, {
        body: options.body,
      }),
    );
    return response.data;
  }

  private async loadOverview(): Promise<void> {
    const payload = await this.request<OverviewPayload>('/admin/overview');
    this.overview.next(payload);
  }

  private async loadUsers(): Promise<void> {
    const payload = await this.request<ListPayload<ApiUserRow>>('/admin/users?limit=100');
    this.users.next(
      payload.items.map((row) => ({
        id: row.id,
        name: row.name,
        username: row.username,
        email: row.email,
        area: row.area,
        phoneMasked: row.phone_masked,
        phoneVerified: row.phone_verified,
        faceVerified: row.face_verified,
        status: row.status,
        listings: row.listings,
        reports: row.reports,
        joinedAt: fmt(row.joined_at),
        lastActive: fmt(row.last_active),
      })),
    );
  }

  private async loadPosts(): Promise<void> {
    const payload = await this.request<ListPayload<ApiPostRow>>('/admin/listings?limit=100');
    this.posts.next(
      payload.items.map((row) => ({
        id: row.id,
        title: row.title,
        type: row.type,
        category: row.category,
        seller: row.seller,
        area: row.area,
        price: row.price ?? undefined,
        status: row.status,
        reported: row.reported,
        createdAt: fmt(row.created_at),
        image: row.image,
      })),
    );
  }

  private async loadVerifications(): Promise<void> {
    const payload =
      await this.request<ListPayload<ApiVerificationRow>>('/admin/verifications?limit=100');
    this.verifications.next(
      payload.items.map((row) => ({
        id: row.id,
        user: row.user,
        username: row.username,
        phone: row.phone,
        faceVerified: row.face_verified,
        status: row.status,
        submittedAt: fmt(row.submitted_at),
      })),
    );
  }

  private async loadCategories(): Promise<void> {
    const payload = await this.request<ListPayload<ApiCategoryRow>>('/admin/categories');
    this.categories.next(
      payload.items.map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        type: row.type,
        active: row.active,
        sortOrder: row.sort_order,
        listings: row.listings,
      })),
    );
  }

  private async loadReports(): Promise<void> {
    const payload = await this.request<ListPayload<ApiReportRow>>('/admin/reports?limit=100');
    this.reports.next(
      payload.items.map((row) => ({
        id: row.id,
        reporter: row.reporter,
        target: row.target,
        targetIcon: row.target_icon,
        listingTitle: row.listing_title,
        reason: row.reason,
        status: row.status,
        createdAt: fmt(row.created_at),
      })),
    );
  }

  private async loadAgreements(): Promise<void> {
    const payload = await this.request<ListPayload<ApiAgreementRow>>('/admin/agreements?limit=100');
    this.agreements.next(
      payload.items.map((row) => ({
        id: row.id,
        listing: row.listing,
        buyer: row.buyer,
        buyerIcon: row.buyer_icon,
        seller: row.seller,
        sellerIcon: row.seller_icon,
        price: row.price,
        status: row.status,
        meetup: row.meetup,
        updatedAt: fmt(row.updated_at),
      })),
    );
  }

  private async loadReviews(): Promise<void> {
    const payload = await this.request<ListPayload<ApiReviewRow>>('/admin/reviews?limit=100');
    this.reviews.next(
      payload.items.map((row) => ({
        id: row.id,
        reviewer: row.reviewer,
        reviewerIcon: row.reviewer_icon,
        reviewee: row.reviewee,
        revieweeIcon: row.reviewee_icon,
        rating: row.rating,
        comment: row.comment,
        listingTitle: row.listing_title,
        createdAt: fmt(row.created_at),
        visible: row.visible,
      })),
    );
  }

  private async loadNotifications(): Promise<void> {
    const payload = await this.request<ListPayload<ApiNotificationRow>>('/admin/notifications');
    this.notifications.next(
      payload.items.map((row) => ({
        id: row.id,
        audience: row.audience,
        title: row.title,
        body: row.body,
        type: row.type,
        sentAt: fmt(row.sent_at),
        read: row.read,
        storedLocally: row.stored_locally,
      })),
    );
  }

  private async loadAdmins(): Promise<void> {
    const payload = await this.request<ListPayload<ApiAdminRow>>('/admin/admins');
    this.admins.next(
      payload.items.map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        active: row.active,
        lastLogin: row.last_login ? fmt(row.last_login) : '-',
      })),
    );
  }

  private async loadAudit(): Promise<void> {
    const payload = await this.request<ListPayload<ApiAuditRow>>('/admin/audit-logs?limit=100');
    this.audit.next(
      payload.items.map((row) => ({
        id: row.id,
        admin: row.admin,
        action: row.action,
        target: row.target,
        targetIcon: row.target_icon,
        ip: row.ip,
        at: fmt(row.at),
      })),
    );
  }

  private async loadSettings(): Promise<void> {
    const payload = await this.request<ApiSettings>('/admin/settings');
    this.settingsSubject.next({
      appName: payload.app_name,
      supportEmail: payload.support_email,
      radius: payload.radius,
      maintenance: payload.maintenance,
      autoModeration: payload.auto_moderation,
    });
  }

  private fail(action: string, error: unknown): void {
    console.error(`[admin] ${action} gagal`, error);
    this.toast.error(`Gagal menyimpan perubahan: ${action}.`);
  }

  getUsers() {
    return this.users.asObservable();
  }

  getPosts() {
    return this.posts.asObservable();
  }

  getVerifications() {
    return this.verifications.asObservable();
  }

  getCategories() {
    return this.categories.asObservable();
  }

  getReports() {
    return this.reports.asObservable();
  }

  getAgreements() {
    return this.agreements.asObservable();
  }

  getReviews() {
    return this.reviews.asObservable();
  }

  getNotifications() {
    return this.notifications.asObservable();
  }

  getAdmins() {
    return this.admins.asObservable();
  }

  getAudit() {
    return this.audit.asObservable();
  }

  updateUsers(next: UserRow[]): void {
    this.users.next(next);
  }

  updateUserStatus(id: string, status: UserStatus): void {
    void this.mutate(
      `/admin/users/${id}`,
      { status },
      'ubah status pengguna',
      () => Promise.all([this.loadUsers(), this.loadAudit(), this.loadOverview()]),
    );
  }

  updatePost(title: string, status: PostStatus, id: string): void {
    void title;
    void this.mutate(
      `/admin/listings/${id}`,
      { status },
      'moderasi posting',
      () => Promise.all([this.loadPosts(), this.loadAudit(), this.loadOverview()]),
    );
  }

  hidePost(id: string): void {
    this.updatePost('', 'hidden', id);
  }

  flagPost(id: string): void {
    this.updatePost('', 'hidden', id);
  }

  moderatePost(id: string, status: PostStatus): void {
    this.updatePost('', status, id);
  }

  addCategory(category: Omit<CategoryRow, 'id'>): void {
    void this.mutate(
      '/admin/categories',
      {
        name: category.name,
        slug: category.slug,
        type: category.type,
        active: category.active,
        sort_order: category.sortOrder,
      },
      'tambah kategori',
      () => Promise.all([this.loadCategories(), this.loadOverview()]),
    );
  }

  updateCategory(category: CategoryRow): void {
    void this.mutate(
      `/admin/categories/${category.id}`,
      {
        name: category.name,
        slug: category.slug,
        type: category.type,
        active: category.active,
        sort_order: category.sortOrder,
      },
      'ubah kategori',
      () => Promise.all([this.loadCategories(), this.loadOverview()]),
    );
  }

  removeCategory(id: string): void {
    void this.mutate(
      `/admin/categories/${id}`,
      {},
      'hapus kategori',
      () => this.loadCategories(),
      'DELETE',
    );
  }

  toggleCategoryActive(id: string): void {
    const category = this.categories.getValue().find((row) => row.id === id);
    if (!category) {
      return;
    }
    void this.mutate(
      `/admin/categories/${id}`,
      { active: !category.active },
      'ubah status kategori',
      () => this.loadCategories(),
      'PATCH',
    );
  }

  updateVerification(id: string, status: VerificationStatus): void {
    if (status === 'pending') {
      return;
    }
    void this.mutate(
      `/admin/verifications/${id}`,
      { status },
      'putuskan verifikasi',
      () => Promise.all([this.loadVerifications(), this.loadAudit()]),
    );
  }

  resolveReport(id: string, status: ReportStatus, note?: string): void {
    void this.mutate(
      `/admin/reports/${id}`,
      { status, note },
      'selesaikan laporan',
      () => Promise.all([this.loadReports(), this.loadAudit(), this.loadOverview()]),
    );
  }

  updateAgreement(id: string, status: AgreementStatus): void {
    void this.mutate(
      `/admin/agreements/${id}`,
      { status },
      'ubah kesepakatan',
      () => this.loadAgreements(),
    );
  }

  upsertReview(review: ReviewRow): void {
    void this.mutate(
      `/admin/reviews/${review.id}`,
      { visible: review.visible },
      'ubah ulasan',
      () => Promise.all([this.loadReviews(), this.loadAudit()]),
    );
  }

  toggleReviewVisibility(id: string, visible: ReviewVisible): void {
    void this.mutate(
      `/admin/reviews/${id}`,
      { visible },
      'sembunyikan ulasan',
      () => Promise.all([this.loadReviews(), this.loadAudit()]),
    );
  }

  addNotification(notification: Omit<NotificationRow, 'id' | 'sentAt'>): void {
    void this.mutate(
      '/admin/notifications',
      {
        audience: isBroadcast(notification.audience) ? 'all' : notification.audience,
        title: notification.title,
        body: notification.body,
        type: notification.type,
      },
      'kirim notifikasi',
      () => Promise.all([this.loadNotifications(), this.loadAudit()]),
    );
  }

  bulkReadNotifications(ids: string[]): void {
    const next = this.notifications
      .getValue()
      .map((row) => (ids.includes(row.id) ? { ...row, read: true } : row));
    this.notifications.next(next);
  }

  updateAdminRole(id: string, role: AdminRow['role']): void {
    void this.mutate(
      `/admin/admins/${id}`,
      { role },
      'ubah peran admin',
      () => Promise.all([this.loadAdmins(), this.loadAudit()]),
    );
  }

  removeAdmin(id: string): void {
    void this.mutate(
      `/admin/admins/${id}`,
      {},
      'hapus admin',
      () => Promise.all([this.loadAdmins(), this.loadAudit()]),
      'DELETE',
    );
  }

  toggleAdminActive(id: string): void {
    const admin = this.admins.getValue().find((row) => row.id === id);
    if (!admin) {
      return;
    }
    void this.mutate(
      `/admin/admins/${id}`,
      { active: !admin.active },
      'ubah status admin',
      () => this.loadAdmins(),
      'PATCH',
    );
  }

  addAdmin(admin: Omit<AdminRow, 'id'>): void {
    void this.mutate(
      '/admin/admins',
      { email: admin.email, role: admin.role },
      'tambah admin',
      () => Promise.all([this.loadAdmins(), this.loadAudit()]),
      'POST',
      (payload) => {
        const created = payload as ApiAdminRow | null;
        if (created?.temporary_password) {
          this.toast.info(`Kata sandi sementara: ${created.temporary_password}`);
        }
      },
    );
  }

  updateSettings(next: Partial<Settings>): void {
    const payload: Record<string, unknown> = {};
    if (next.appName !== undefined) payload['app_name'] = next.appName;
    if (next.supportEmail !== undefined) payload['support_email'] = next.supportEmail;
    if (next.radius !== undefined) payload['radius'] = next.radius;
    if (next.maintenance !== undefined) payload['maintenance'] = next.maintenance;
    if (next.autoModeration !== undefined) payload['auto_moderation'] = next.autoModeration;
    void this.mutate('/admin/settings', payload, 'simpan setelan', () => this.loadSettings(), 'PUT');
  }

  private async mutate(
    path: string,
    body: unknown,
    action: string,
    reload: () => Promise<unknown>,
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE' = 'PATCH',
    after?: (payload: unknown) => void,
  ): Promise<void> {
    try {
      const payload = await this.request<unknown>(path, { method, body });
      after?.(payload);
      await reload();
      this.toast.success('Perubahan tersimpan.');
    } catch (error) {
      this.fail(action, error);
    }
  }
}

export type { DashboardBar };
