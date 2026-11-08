export type PostType = 'sell' | 'event' | 'information';
export type PostStatus =
  | 'active'
  | 'draft'
  | 'hidden'
  | 'rejected'
  | 'sold'
  | 'expired'
  | 'completed';
export type UserStatus = 'active' | 'suspended' | 'deactivated';
export type VerificationStatus = 'pending' | 'verified' | 'rejected';
export type ReportStatus = 'open' | 'reviewing' | 'resolved' | 'dismissed';
export type AgreementStatus =
  | 'negotiating'
  | 'agreed'
  | 'meetup_scheduled'
  | 'completed'
  | 'cancelled'
  | 'disputed';
export type ReviewVisible = 'visible' | 'hidden';
export type CategoryType = PostType;

export interface UserRow {
  id: string;
  name: string;
  username: string;
  email: string;
  area: string;
  phoneMasked: string;
  phoneVerified: boolean;
  faceVerified: boolean;
  status: UserStatus;
  listings: number;
  reports: number;
  joinedAt: string;
  lastActive: string;
}

export interface PostRow {
  id: string;
  title: string;
  type: PostType;
  category: string;
  seller: string;
  area: string;
  price?: number;
  status: PostStatus;
  reported: boolean;
  createdAt: string;
  image: string;
}

export interface VerificationRow {
  id: string;
  user: string;
  username: string;
  phone: string;
  faceVerified: boolean;
  status: VerificationStatus;
  submittedAt: string;
}

export interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  type: CategoryType;
  active: boolean;
  sortOrder: number;
  listings: number;
}

export interface ReportRow {
  id: string;
  reporter: string;
  target: string;
  targetIcon: string;
  listingTitle: string;
  reason: string;
  status: ReportStatus;
  createdAt: string;
}

export interface AgreementRow {
  id: string;
  listing: string;
  buyer: string;
  buyerIcon: string;
  seller: string;
  sellerIcon: string;
  price: number;
  status: AgreementStatus;
  meetup: string;
  updatedAt: string;
}

export interface ReviewRow {
  id: string;
  reviewer: string;
  reviewerIcon: string;
  reviewee: string;
  revieweeIcon: string;
  rating: number;
  comment: string;
  listingTitle: string;
  createdAt: string;
  visible: ReviewVisible;
}

export interface NotificationRow {
  id: string;
  audience: string;
  title: string;
  body: string;
  type: 'info' | 'success' | 'warning';
  sentAt: string;
  read: boolean;
  storedLocally: boolean;
}

export interface AdminRow {
  id: string;
  name: string;
  email: string;
  role: 'super-admin' | 'admin';
  active: boolean;
  lastLogin: string;
}

export interface AuditRow {
  id: string;
  admin: string;
  action: string;
  target: string;
  targetIcon: string;
  ip: string;
  at: string;
}

export interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalPosts: number;
  activePosts: number;
  flaggedPosts: number;
  conversations: number;
  totalCategories: number;
  activeCategories: number;
}

export interface DashboardBar {
  label: string;
  value: number;
}
