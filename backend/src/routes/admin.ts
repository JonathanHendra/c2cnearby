import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { Op } from 'sequelize';

import {
  authenticatedAdmin,
  type AuthContext,
  type AuthGuards,
} from '../auth/index.js';
import { hashAdminPassword } from '../auth/admin-password.js';
import { maskPhone } from '../auth/onboarding.js';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../common/errors.js';
import { ok } from '../common/response.js';
import type { DatabaseModels } from '../database/models/index.js';
import type { AdminRole } from '../database/models/admin.model.js';
import type { AgreementStatus } from '../database/models/conversation.model.js';
import type { ListingStatus } from '../database/models/listing.model.js';
import type { PostType } from '../database/models/category.model.js';
import type { ReportReason, ReportStatus } from '../database/models/report.model.js';

export interface AdminRoutesOptions {
  readonly ctx: AuthContext;
  readonly guards: AuthGuards;
}

interface PageQuery {
  q?: string;
  status?: string;
  type?: string;
  page?: number;
  limit?: number;
}

interface IdParams {
  id: string;
}

const DEFAULT_LIMIT = 50;

function iso(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function requiredIso(value: Date | string): string {
  return iso(value) ?? new Date(0).toISOString();
}

function money(value: string | number | null): number | null {
  if (value === null) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function displayName(user: {
  displayName: string | null;
  fullName: string | null;
  username: string;
}): string {
  return user.displayName ?? user.fullName ?? user.username;
}

function pageOf(query: PageQuery): { offset: number; limit: number; page: number } {
  const page = Math.max(1, Number(query.page ?? 1) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit ?? DEFAULT_LIMIT) || DEFAULT_LIMIT));
  return { offset: (page - 1) * limit, limit, page };
}

function like(query: string | undefined): string | null {
  const value = (query ?? '').trim();
  return value.length === 0 ? null : `%${value}%`;
}

const REPORT_REASON_LABEL: Record<ReportReason, string> = {
  spam: 'Spam / promosi berulang',
  fraud: 'Penipuan atau iklan palsu',
  prohibited: 'Barang atau jasa terlarang',
  harassment: 'Pelecehan atau ancaman',
  other: 'Lainnya',
};

const AGREEEMENT_STATUSES: readonly AgreementStatus[] = [
  'negotiating',
  'agreed',
  'meetup_scheduled',
  'completed',
  'cancelled',
  'disputed',
];

const LISTING_STATUSES: readonly ListingStatus[] = [
  'draft',
  'active',
  'hidden',
  'sold',
  'completed',
  'rejected',
  'expired',
];

const POST_TYPES: readonly PostType[] = ['sell', 'event', 'information'];

const sessionGuard = { security: [{ bearerAuth: [] }] } as const;

const idParams = Type.Object({ id: Type.String({ minLength: 1, maxLength: 36 }) });

async function recordAudit(
  ctx: AuthContext,
  request: FastifyRequest,
  action: string,
  targetType: string,
  targetId: string | null,
  metadata: Record<string, unknown> | null = null,
): Promise<void> {
  const admin = request.adminUser;
  await ctx.models.AdminAuditLog.create({
    adminId: admin?.id ?? null,
    action,
    targetType,
    targetId,
    metadata,
    ipAddress: request.ip ?? null,
  }, {});
}

function settingValue<T>(settings: Map<string, unknown>, key: string, fallback: T): T {
  const value = settings.get(key);
  return (value as T | undefined) ?? fallback;
}

export const adminRoutes: FastifyPluginAsync<AdminRoutesOptions> = async (app, options) => {
  const { ctx, guards } = options;
  const models: DatabaseModels = ctx.models;

  // ------------------------------------------------------------- dashboard
  app.get(
    '/admin/overview',
    {
      preHandler: guards.authorize('dashboard:read'),
      schema: { tags: ['admin'], summary: 'Ringkasan dashboard admin', ...sessionGuard },
    },
    async () => {
      const now = new Date();
      const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const [
        totalUsers,
        activeUsers,
        totalPosts,
        activePosts,
        flaggedPosts,
        conversations,
        totalCategories,
        activeCategories,
        openReports,
        pendingVerifications,
        totalReviews,
      ] = await Promise.all([
        models.User.count(),
        models.User.count({ where: { accountStatus: 'active' } }),
        models.Listing.count(),
        models.Listing.count({ where: { status: 'active' } }),
        models.Listing.count({
          where: {
            [Op.or]: [
              { status: 'hidden' },
              { status: 'rejected' },
            ],
          },
        }),
        models.Conversation.count(),
        models.Category.count(),
        models.Category.count({ where: { isActive: true } }),
        models.Report.count({ where: { status: { [Op.in]: ['open', 'reviewing'] } } }),
        models.UserVerification.count({
          where: { verificationType: 'face', status: 'pending' },
        }),
        models.Review.count(),
      ]);

      const recentListings = await models.Listing.findAll({
        attributes: ['createdAt'],
        where: { createdAt: { [Op.gte]: since } },
        raw: true,
      });

      // Buckets use the server's local calendar day so a listing created
      // "today" is never pushed outside the window by a UTC offset.
      const dayKey = (date: Date): string => {
        const month = `${date.getMonth() + 1}`.padStart(2, '0');
        const day = `${date.getDate()}`.padStart(2, '0');
        return `${date.getFullYear()}-${month}-${day}`;
      };

      const dayKeys: string[] = [];
      for (let index = 6; index >= 0; index -= 1) {
        const day = new Date(now.getTime() - index * 24 * 60 * 60 * 1000);
        dayKeys.push(dayKey(day));
      }
      const perDay = new Map<string, number>(dayKeys.map((key) => [key, 0]));
      for (const row of recentListings) {
        const key = dayKey(new Date(row.createdAt));
        if (perDay.has(key)) {
          perDay.set(key, (perDay.get(key) ?? 0) + 1);
        }
      }

      const categoryCounts = await models.Category.findAll({
        attributes: ['id', 'name'],
        order: [['sortOrder', 'ASC']],
        limit: 6,
      });
      const categoryBars = await Promise.all(
        categoryCounts.map(async (category) => ({
          label: category.name,
          value: await models.Listing.count({ where: { categoryId: category.id } }),
        })),
      );

      const audit = await models.AdminAuditLog.findAll({
        order: [['createdAt', 'DESC']],
        limit: 5,
      });
      const auditAdminIds = [
        ...new Set(audit.map((entry) => entry.adminId).filter((id): id is string => Boolean(id))),
      ];
      const auditAdmins = await models.AdminUser.findAll({
        where: { id: { [Op.in]: auditAdminIds } },
      });
      const auditAdminById = new Map(auditAdmins.map((admin) => [admin.id, admin.email ?? 'admin']));

      return ok({
        stats: {
          total_users: totalUsers,
          active_users: activeUsers,
          total_posts: totalPosts,
          active_posts: activePosts,
          flagged_posts: flaggedPosts,
          conversations,
          total_categories: totalCategories,
          active_categories: activeCategories,
          open_reports: openReports,
          pending_verifications: pendingVerifications,
          total_reviews: totalReviews,
        },
        weekly: dayKeys.map((key) => ({
          label: new Date(`${key}T00:00:00`).toLocaleDateString('id-ID', {
            weekday: 'short',
          }),
          value: perDay.get(key) ?? 0,
        })),
        categories: categoryBars.filter((bar) => bar.value > 0),
        activity: audit.map((entry) => ({
          id: entry.id,
          action: entry.action,
          target: entry.targetType,
          admin: entry.adminId ? (auditAdminById.get(entry.adminId) ?? 'admin') : 'sistem',
          at: requiredIso(entry.createdAt),
        })),
      });
    },
  );

  // ----------------------------------------------------------------- users
  app.get(
    '/admin/users',
    {
      preHandler: guards.authorize('users:read'),
      schema: { tags: ['admin'], summary: 'Daftar pengguna', ...sessionGuard },
    },
    async (request) => {
      const query = request.query as PageQuery;
      const { offset, limit, page } = pageOf(query);
      const search = like(query.q);
      const where: Record<string, unknown> = {};
      if (query.status && ['active', 'suspended', 'deactivated'].includes(query.status)) {
        where.accountStatus = query.status;
      }
      if (search) {
        Object.assign(where, {
          [Op.or]: [
            { username: { [Op.like]: search } },
            { displayName: { [Op.like]: search } },
            { fullName: { [Op.like]: search } },
            { areaLabel: { [Op.like]: search } },
          ],
        });
      }

      const { rows, count } = await models.User.findAndCountAll({
        where,
        order: [['createdAt', 'DESC']],
        offset,
        limit,
      });

      const items = await Promise.all(
        rows.map(async (user) => ({
          id: user.id,
          name: displayName(user),
          username: user.username,
          email: '',
          area: user.areaLabel ?? '',
          phone_masked: maskPhone(user.phonePrivate) ?? '-',
          phone_verified: user.phoneVerified,
          face_verified: user.faceVerificationStatus === 'verified',
          status: user.accountStatus,
          listings: await models.Listing.count({ where: { userId: user.id } }),
          reports: await models.Report.count({ where: { reportedUserId: user.id } }),
          joined_at: requiredIso(user.createdAt),
          last_active: iso(user.lastActiveAt) ?? requiredIso(user.createdAt),
        })),
      );

      return ok({ items, total: count, page, limit });
    },
  );

  app.patch(
    '/admin/users/:id',
    {
      preHandler: guards.authorize('users:status'),
      schema: {
        tags: ['admin'],
        summary: 'Ubah status akun pengguna',
        params: idParams,
        body: Type.Object({
          status: Type.Union([
            Type.Literal('active'),
            Type.Literal('suspended'),
            Type.Literal('deactivated'),
          ]),
        }),
        ...sessionGuard,
      },
    },
    async (request) => {
      const { id } = request.params as IdParams;
      const { status } = request.body as { status: 'active' | 'suspended' | 'deactivated' };
      const user = await models.User.findByPk(id);
      if (!user) {
        throw new NotFoundError('Pengguna tidak ditemukan.');
      }
      user.accountStatus = status;
      if (status === 'deactivated') {
        user.deletionRequestedAt = new Date();
      }
      await user.save({ fields: ['accountStatus', 'deletionRequestedAt'] });
      await recordAudit(ctx, request, `user_${status}`, 'user', id);
      return ok({ id, status });
    },
  );

  // -------------------------------------------------------------- listings
  app.get(
    '/admin/listings',
    {
      preHandler: guards.authorize('listings:read'),
      schema: { tags: ['admin'], summary: 'Daftar posting', ...sessionGuard },
    },
    async (request) => {
      const query = request.query as PageQuery;
      const { offset, limit, page } = pageOf(query);
      const search = like(query.q);
      const where: Record<string, unknown> = {};
      if (query.status && LISTING_STATUSES.includes(query.status as ListingStatus)) {
        where.status = query.status;
      }
      if (query.type && POST_TYPES.includes(query.type as PostType)) {
        where.postType = query.type;
      }
      if (search) {
        Object.assign(where, {
          [Op.or]: [
            { title: { [Op.like]: search } },
            { description: { [Op.like]: search } },
            { locationPublicLabel: { [Op.like]: search } },
          ],
        });
      }

      const { rows, count } = await models.Listing.findAndCountAll({
        where,
        order: [['createdAt', 'DESC']],
        offset,
        limit,
      });

      const items = await Promise.all(
        rows.map(async (listing) => {
          const [seller, category, image, reports] = await Promise.all([
            models.User.findByPk(listing.userId),
            listing.categoryId ? models.Category.findByPk(listing.categoryId) : null,
            models.ListingImage.findOne({
              where: { listingId: listing.id },
              order: [['sortOrder', 'ASC']],
            }),
            models.Report.count({ where: { listingId: listing.id } }),
          ]);
          return {
            id: listing.id,
            title: listing.title,
            type: listing.postType,
            category: category?.name ?? 'Tanpa kategori',
            seller: seller ? displayName(seller) : 'Pengguna dihapus',
            area: listing.locationPublicLabel,
            price: money(listing.price),
            status: listing.status,
            reported: reports > 0,
            created_at: requiredIso(listing.createdAt),
            image: image?.thumbnailUrl ?? '',
          };
        }),
      );

      return ok({ items, total: count, page, limit });
    },
  );

  app.patch(
    '/admin/listings/:id',
    {
      preHandler: guards.authorize('listings:moderate'),
      schema: {
        tags: ['admin'],
        summary: 'Moderasi posting',
        params: idParams,
        body: Type.Object({ status: Type.String({ maxLength: 32 }) }),
        ...sessionGuard,
      },
    },
    async (request) => {
      const { id } = request.params as IdParams;
      const { status } = request.body as { status: string };
      if (!LISTING_STATUSES.includes(status as ListingStatus)) {
        throw new ValidationError('Status posting tidak dikenal.');
      }
      const listing = await models.Listing.findByPk(id);
      if (!listing) {
        throw new NotFoundError('Posting tidak ditemukan.');
      }
      listing.status = status as ListingStatus;
      await listing.save({ fields: ['status'] });
      await recordAudit(ctx, request, `listing_${status}`, 'listing', id);
      return ok({ id, status });
    },
  );

  // -------------------------------------------------------------- categories
  app.get(
    '/admin/categories',
    {
      preHandler: guards.authorize('categories:read'),
      schema: { tags: ['admin'], summary: 'Daftar kategori', ...sessionGuard },
    },
    async () => {
      const rows = await models.Category.findAll({
        order: [
          ['postType', 'ASC'],
          ['sortOrder', 'ASC'],
        ],
      });
      const items = await Promise.all(
        rows.map(async (category) => ({
          id: category.id,
          name: category.name,
          slug: category.slug,
          type: category.postType,
          active: category.isActive,
          sort_order: category.sortOrder,
          listings: await models.Listing.count({ where: { categoryId: category.id } }),
        })),
      );
      return ok({ items });
    },
  );

  app.post(
    '/admin/categories',
    {
      preHandler: guards.authorize('categories:write'),
      schema: {
        tags: ['admin'],
        summary: 'Tambah kategori',
        body: Type.Object({
          name: Type.String({ minLength: 2, maxLength: 80 }),
          slug: Type.String({ minLength: 2, maxLength: 80 }),
          type: Type.Union([Type.Literal('sell'), Type.Literal('event'), Type.Literal('information')]),
          active: Type.Optional(Type.Boolean()),
          sort_order: Type.Optional(Type.Integer()),
        }),
        ...sessionGuard,
      },
    },
    async (request) => {
      const body = request.body as {
        name: string;
        slug: string;
        type: PostType;
        active?: boolean;
        sort_order?: number;
      };
      const slug = body.slug
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/^-+|-+$/g, '');
      const existing = await models.Category.findOne({ where: { slug } });
      if (existing) {
        throw new ConflictError('CATEGORY_SLUG_TAKEN', 'Slug kategori sudah dipakai.');
      }
      const category = await models.Category.create({
        name: body.name,
        slug,
        postType: body.type,
        isActive: body.active ?? true,
        sortOrder: body.sort_order ?? 0,
      }, {});
      await recordAudit(ctx, request, 'category_created', 'category', category.id);
      return ok({
        id: category.id,
        name: category.name,
        slug: category.slug,
        type: category.postType,
        active: category.isActive,
        sort_order: category.sortOrder,
        listings: 0,
      });
    },
  );

  app.patch(
    '/admin/categories/:id',
    {
      preHandler: guards.authorize('categories:write'),
      schema: {
        tags: ['admin'],
        summary: 'Ubah kategori',
        params: idParams,
        body: Type.Object({
          name: Type.Optional(Type.String({ minLength: 2, maxLength: 80 })),
          slug: Type.Optional(Type.String({ minLength: 2, maxLength: 80 })),
          type: Type.Optional(
            Type.Union([Type.Literal('sell'), Type.Literal('event'), Type.Literal('information')]),
          ),
          active: Type.Optional(Type.Boolean()),
          sort_order: Type.Optional(Type.Integer()),
        }),
        ...sessionGuard,
      },
    },
    async (request) => {
      const { id } = request.params as IdParams;
      const body = request.body as {
        name?: string;
        slug?: string;
        type?: PostType;
        active?: boolean;
        sort_order?: number;
      };
      const category = await models.Category.findByPk(id);
      if (!category) {
        throw new NotFoundError('Kategori tidak ditemukan.');
      }
      if (body.name !== undefined) category.name = body.name;
      if (body.slug !== undefined) {
        category.slug = body.slug
          .toLowerCase()
          .replace(/[^a-z0-9-]+/g, '-')
          .replace(/^-+|-+$/g, '');
        const duplicate = await models.Category.findOne({ where: { slug: category.slug } });
        if (duplicate && duplicate.id !== category.id) {
          throw new ConflictError('CATEGORY_SLUG_TAKEN', 'Slug kategori sudah dipakai.');
        }
      }
      if (body.type !== undefined) category.postType = body.type;
      if (body.active !== undefined) category.isActive = body.active;
      if (body.sort_order !== undefined) category.sortOrder = body.sort_order;
      await category.save();
      await recordAudit(ctx, request, 'category_updated', 'category', category.id);
      return ok({
        id: category.id,
        name: category.name,
        slug: category.slug,
        type: category.postType,
        active: category.isActive,
        sort_order: category.sortOrder,
        listings: await models.Listing.count({ where: { categoryId: category.id } }),
      });
    },
  );

  app.delete(
    '/admin/categories/:id',
    {
      preHandler: guards.authorize('categories:write'),
      schema: {
        tags: ['admin'],
        summary: 'Hapus kategori',
        params: idParams,
        ...sessionGuard,
      },
    },
    async (request) => {
      const { id } = request.params as IdParams;
      const category = await models.Category.findByPk(id);
      if (!category) {
        throw new NotFoundError('Kategori tidak ditemukan.');
      }
      const used = await models.Listing.count({ where: { categoryId: id } });
      if (used > 0) {
        throw new ConflictError(
          'CATEGORY_IN_USE',
          `Kategori masih dipakai oleh ${used} posting. Nonaktifkan saja alih-alih menghapus.`,
        );
      }
      await category.destroy();
      await recordAudit(ctx, request, 'category_deleted', 'category', id);
      return ok({ id });
    },
  );

  // ---------------------------------------------------------- verifications
  app.get(
    '/admin/verifications',
    {
      preHandler: guards.authorize('verifications:read'),
      schema: { tags: ['admin'], summary: 'Antrean verifikasi wajah', ...sessionGuard },
    },
    async (request) => {
      const query = request.query as PageQuery;
      const { offset, limit, page } = pageOf(query);
      const where: Record<string, unknown> = { verificationType: 'face' };
      if (query.status && ['pending', 'verified', 'rejected', 'expired'].includes(query.status)) {
        where.status = query.status;
      }
      const { rows, count } = await models.UserVerification.findAndCountAll({
        where,
        order: [['createdAt', 'DESC']],
        offset,
        limit,
      });
      const items = await Promise.all(
        rows.map(async (verification) => {
          const user = await models.User.findByPk(verification.userId);
          return {
            id: verification.id,
            user: user ? displayName(user) : 'Pengguna dihapus',
            username: user?.username ?? '-',
            phone: (user ? maskPhone(user.phonePrivate) : null) ?? '-',
            face_verified: user?.faceVerificationStatus === 'verified',
            status: verification.status,
            submitted_at: requiredIso(verification.createdAt),
          };
        }),
      );
      return ok({ items, total: count, page, limit });
    },
  );

  app.patch(
    '/admin/verifications/:id',
    {
      preHandler: guards.authorize('verifications:review'),
      schema: {
        tags: ['admin'],
        summary: 'Putuskan verifikasi wajah',
        params: idParams,
        body: Type.Object({
          status: Type.Union([Type.Literal('verified'), Type.Literal('rejected')]),
        }),
        ...sessionGuard,
      },
    },
    async (request) => {
      const { id } = request.params as IdParams;
      const { status } = request.body as { status: 'verified' | 'rejected' };
      const verification = await models.UserVerification.findByPk(id);
      if (!verification) {
        throw new NotFoundError('Verifikasi tidak ditemukan.');
      }
      verification.status = status;
      verification.verifiedAt = status === 'verified' ? new Date() : null;
      await verification.save({ fields: ['status', 'verifiedAt'] });
      await models.User.update(
        { faceVerificationStatus: status },
        { where: { id: verification.userId } },
      );
      await recordAudit(ctx, request, `verification_${status}`, 'user_verification', id);
      return ok({ id, status });
    },
  );

  // --------------------------------------------------------------- reports
  app.get(
    '/admin/reports',
    {
      preHandler: guards.authorize('reports:read'),
      schema: { tags: ['admin'], summary: 'Daftar laporan', ...sessionGuard },
    },
    async (request) => {
      const query = request.query as PageQuery;
      const { offset, limit, page } = pageOf(query);
      const where: Record<string, unknown> = {};
      if (query.status && ['open', 'reviewing', 'resolved', 'dismissed'].includes(query.status)) {
        where.status = query.status;
      }
      const { rows, count } = await models.Report.findAndCountAll({
        where,
        order: [['createdAt', 'DESC']],
        offset,
        limit,
      });
      const items = await Promise.all(
        rows.map(async (report) => {
          const [reporter, reportedUser, listing] = await Promise.all([
            models.User.findByPk(report.reporterId),
            report.reportedUserId ? models.User.findByPk(report.reportedUserId) : null,
            report.listingId ? models.Listing.findByPk(report.listingId) : null,
          ]);
          return {
            id: report.id,
            reporter: reporter ? displayName(reporter) : 'Pengguna dihapus',
            target: reportedUser
              ? displayName(reportedUser)
              : listing
                ? listing.title
                : 'Tidak diketahui',
            target_icon: reportedUser ? 'person' : 'post',
            listing_title: listing?.title ?? '-',
            reason: REPORT_REASON_LABEL[report.reason] ?? report.reason,
            note: report.description ?? '',
            status: report.status,
            created_at: requiredIso(report.createdAt),
          };
        }),
      );
      return ok({ items, total: count, page, limit });
    },
  );

  app.patch(
    '/admin/reports/:id',
    {
      preHandler: guards.authorize('reports:resolve'),
      schema: {
        tags: ['admin'],
        summary: 'Selesaikan laporan',
        params: idParams,
        body: Type.Object({
          status: Type.Union([
            Type.Literal('open'),
            Type.Literal('reviewing'),
            Type.Literal('resolved'),
            Type.Literal('dismissed'),
          ]),
          note: Type.Optional(Type.String({ maxLength: 500 })),
        }),
        ...sessionGuard,
      },
    },
    async (request) => {
      const { id } = request.params as IdParams;
      const { status, note } = request.body as { status: ReportStatus; note?: string };
      const report = await models.Report.findByPk(id);
      if (!report) {
        throw new NotFoundError('Laporan tidak ditemukan.');
      }
      const admin = authenticatedAdmin(request);
      report.status = status;
      report.resolutionNote = note ?? report.resolutionNote;
      if (status === 'resolved' || status === 'dismissed') {
        report.handledByAdminId = admin.id;
        report.handledAt = new Date();
      }
      await report.save({
        fields: ['status', 'resolutionNote', 'handledByAdminId', 'handledAt'],
      });
      await recordAudit(ctx, request, `report_${status}`, 'report', id, note ? { note } : null);
      return ok({ id, status });
    },
  );

  // ------------------------------------------------------------ agreements
  app.get(
    '/admin/agreements',
    {
      preHandler: guards.authorize('agreements:read'),
      schema: { tags: ['admin'], summary: 'Daftar kesepakatan', ...sessionGuard },
    },
    async (request) => {
      const query = request.query as PageQuery;
      const { offset, limit, page } = pageOf(query);
      const where: Record<string, unknown> = {};
      if (query.status && AGREEEMENT_STATUSES.includes(query.status as AgreementStatus)) {
        where.status = query.status;
      }
      const { rows, count } = await models.TransactionAgreement.findAndCountAll({
        where,
        order: [['updatedAt', 'DESC']],
        offset,
        limit,
      });
      const items = await Promise.all(
        rows.map(async (agreement) => {
          const [listing, buyer, seller] = await Promise.all([
            models.Listing.findByPk(agreement.listingId),
            models.User.findByPk(agreement.buyerId),
            models.User.findByPk(agreement.sellerId),
          ]);
          const meetup = [
            agreement.meetupLocationPublic,
            agreement.meetupAt ? requiredIso(agreement.meetupAt) : null,
          ]
            .filter((part): part is string => Boolean(part))
            .join(' · ');
          return {
            id: agreement.id,
            listing: listing?.title ?? 'Posting dihapus',
            buyer: buyer ? displayName(buyer) : 'Pengguna dihapus',
            buyer_icon: 'person',
            seller: seller ? displayName(seller) : 'Pengguna dihapus',
            seller_icon: 'person',
            price: money(agreement.agreedPrice) ?? 0,
            status: agreement.status,
            meetup,
            updated_at: requiredIso(agreement.updatedAt),
          };
        }),
      );
      return ok({ items, total: count, page, limit });
    },
  );

  app.patch(
    '/admin/agreements/:id',
    {
      preHandler: guards.authorize('agreements:read'),
      schema: {
        tags: ['admin'],
        summary: 'Ubah status kesepakatan',
        params: idParams,
        body: Type.Object({ status: Type.String({ maxLength: 32 }) }),
        ...sessionGuard,
      },
    },
    async (request) => {
      const { id } = request.params as IdParams;
      const { status } = request.body as { status: string };
      if (!AGREEEMENT_STATUSES.includes(status as AgreementStatus)) {
        throw new ValidationError('Status kesepakatan tidak dikenal.');
      }
      const agreement = await models.TransactionAgreement.findByPk(id);
      if (!agreement) {
        throw new NotFoundError('Kesepakatan tidak ditemukan.');
      }
      agreement.status = status as AgreementStatus;
      if (status === 'completed') {
        agreement.completedAt = new Date();
      }
      await agreement.save({ fields: ['status', 'completedAt'] });
      await recordAudit(ctx, request, `agreement_${status}`, 'agreement', id);
      return ok({ id, status });
    },
  );

  // ---------------------------------------------------------------- reviews
  app.get(
    '/admin/reviews',
    {
      preHandler: guards.authorize('reviews:read'),
      schema: { tags: ['admin'], summary: 'Daftar ulasan', ...sessionGuard },
    },
    async (request) => {
      const query = request.query as PageQuery;
      const { offset, limit, page } = pageOf(query);
      const { rows, count } = await models.Review.findAndCountAll({
        order: [['createdAt', 'DESC']],
        offset,
        limit,
      });
      const items = await Promise.all(
        rows.map(async (review) => {
          const [reviewer, reviewee, listing] = await Promise.all([
            models.User.findByPk(review.reviewerId),
            models.User.findByPk(review.revieweeId),
            models.Listing.findByPk(review.listingId),
          ]);
          return {
            id: review.id,
            reviewer: reviewer ? displayName(reviewer) : 'Pengguna dihapus',
            reviewer_icon: 'person',
            reviewee: reviewee ? displayName(reviewee) : 'Pengguna dihapus',
            reviewee_icon: 'person',
            rating: Number(review.rating),
            comment: review.review ?? '',
            listing_title: listing?.title ?? '-',
            created_at: requiredIso(review.createdAt),
            visible: review.hiddenAt ? 'hidden' : 'visible',
          };
        }),
      );
      return ok({ items, total: count, page, limit });
    },
  );

  app.patch(
    '/admin/reviews/:id',
    {
      preHandler: guards.authorize('reviews:moderate'),
      schema: {
        tags: ['admin'],
        summary: 'Sembunyikan atau tampilkan ulasan',
        params: idParams,
        body: Type.Object({
          visible: Type.Union([Type.Literal('visible'), Type.Literal('hidden')]),
        }),
        ...sessionGuard,
      },
    },
    async (request) => {
      const { id } = request.params as IdParams;
      const { visible } = request.body as { visible: 'visible' | 'hidden' };
      const review = await models.Review.findByPk(id);
      if (!review) {
        throw new NotFoundError('Ulasan tidak ditemukan.');
      }
      review.hiddenAt = visible === 'hidden' ? new Date() : null;
      await review.save({ fields: ['hiddenAt'] });
      await recordAudit(ctx, request, `review_${visible}`, 'review', id);
      return ok({ id, visible });
    },
  );

  // ---------------------------------------------------------- notifications
  app.get(
    '/admin/notifications',
    {
      preHandler: guards.authorize('dashboard:read'),
      schema: { tags: ['admin'], summary: 'Notifikasi terbaru', ...sessionGuard },
    },
    async () => {
      const rows = await models.Notification.findAll({
        order: [['createdAt', 'DESC']],
        limit: 100,
      });
      const userIds = [...new Set(rows.map((row) => row.userId))];
      const users = await models.User.findAll({ where: { id: { [Op.in]: userIds } } });
      const byId = new Map(users.map((user) => [user.id, user]));
      return ok({
        items: rows.map((row) => ({
          id: row.id,
          audience: byId.get(row.userId)?.username ?? 'pengguna',
          title: row.title,
          body: row.body,
          type: ['info', 'success', 'warning'].includes(row.type) ? row.type : 'info',
          sent_at: requiredIso(row.createdAt),
          read: row.readAt !== null,
          stored_locally: false,
        })),
      });
    },
  );

  app.post(
    '/admin/notifications',
    {
      preHandler: guards.authorize('admins:manage'),
      schema: {
        tags: ['admin'],
        summary: 'Kirim notifikasi',
        body: Type.Object({
          audience: Type.String({ maxLength: 120 }),
          title: Type.String({ minLength: 2, maxLength: 150 }),
          body: Type.String({ minLength: 2, maxLength: 500 }),
          type: Type.Optional(
            Type.Union([Type.Literal('info'), Type.Literal('success'), Type.Literal('warning')]),
          ),
        }),
        ...sessionGuard,
      },
    },
    async (request) => {
      const payload = request.body as {
        audience: string;
        title: string;
        body: string;
        type?: 'info' | 'success' | 'warning';
      };
      const audience = payload.audience.trim().toLowerCase();
      const broadcast = ['all', 'semua', 'seluruh'].includes(audience);
      const recipients = broadcast
        ? await models.User.findAll({ where: { accountStatus: 'active' }, attributes: ['id'] })
        : await models.User.findAll({ where: { username: payload.audience.trim() }, attributes: ['id'] });

      if (recipients.length === 0) {
        throw new ValidationError('Tidak ada penerima untuk audiens tersebut.');
      }

      await models.Notification.bulkCreate(
        recipients.map((user) => ({
          userId: user.id,
          title: payload.title,
          body: payload.body,
          type: payload.type ?? 'info',
          referenceId: null,
          readAt: null,
        })),
        {},
      );
      await recordAudit(ctx, request, 'notification_sent', 'notification', null, {
        audience: payload.audience,
        recipients: recipients.length,
      });
      return ok({ recipients: recipients.length });
    },
  );

  // ----------------------------------------------------------------- admins
  function adminDto(admin: {
    id: string;
    email: string | null;
    role: AdminRole;
    isActive: boolean;
    lastLoginAt: Date | null;
  }) {
    const email = admin.email ?? '';
    return {
      id: admin.id,
      name: email.length > 0 ? email.split('@')[0] : 'Admin',
      email,
      role: admin.role === 'super_admin' ? 'super-admin' : 'admin',
      active: admin.isActive,
      last_login: iso(admin.lastLoginAt),
    };
  }

  app.get(
    '/admin/admins',
    {
      preHandler: guards.authorize('admins:manage'),
      schema: { tags: ['admin'], summary: 'Daftar admin', ...sessionGuard },
    },
    async () => {
      const rows = await models.AdminUser.findAll({ order: [['createdAt', 'ASC']] });
      return ok({ items: rows.map(adminDto) });
    },
  );

  app.post(
    '/admin/admins',
    {
      preHandler: guards.authorize('admins:manage'),
      schema: {
        tags: ['admin'],
        summary: 'Tambah admin',
        body: Type.Object({
          email: Type.String({ format: 'email', maxLength: 190 }),
          role: Type.Optional(Type.String({ maxLength: 32 })),
          password: Type.Optional(Type.String({ minLength: 8, maxLength: 200 })),
        }),
        ...sessionGuard,
      },
    },
    async (request) => {
      const body = request.body as { email: string; role?: string; password?: string };
      const email = body.email.trim().toLowerCase();
      const existing = await models.AdminUser.findOne({ where: { email } });
      if (existing) {
        throw new ConflictError('ADMIN_EMAIL_TAKEN', 'Email admin sudah terdaftar.');
      }
      const password = body.password ?? `c2c-${Math.random().toString(36).slice(2, 14)}`;
      const role: AdminRole = body.role === 'super-admin' ? 'super_admin' : 'admin';
      const admin = await models.AdminUser.create({
        firebaseUid: `local:${Date.now()}-${Math.random().toString(36).slice(2)}`,
        email,
        passwordHash: hashAdminPassword(password),
        role,
        isActive: true,
      }, {});
      await recordAudit(ctx, request, 'admin_added', 'admin_user', admin.id, { email });
      return ok({ ...adminDto(admin), temporary_password: body.password ? null : password });
    },
  );

  app.patch(
    '/admin/admins/:id',
    {
      preHandler: guards.authorize('admins:manage'),
      schema: {
        tags: ['admin'],
        summary: 'Ubah admin',
        params: idParams,
        body: Type.Object({
          role: Type.Optional(Type.String({ maxLength: 32 })),
          active: Type.Optional(Type.Boolean()),
        }),
        ...sessionGuard,
      },
    },
    async (request) => {
      const { id } = request.params as IdParams;
      const body = request.body as { role?: string; active?: boolean };
      const admin = await models.AdminUser.findByPk(id);
      if (!admin) {
        throw new NotFoundError('Admin tidak ditemukan.');
      }
      if (body.role !== undefined) {
        admin.role = body.role === 'super-admin' ? 'super_admin' : 'admin';
      }
      if (body.active !== undefined) {
        if (!body.active && id === request.adminUser?.id) {
          throw new ValidationError('Tidak dapat menonaktifkan akun Anda sendiri.');
        }
        admin.isActive = body.active;
      }
      await admin.save();
      await recordAudit(ctx, request, 'admin_updated', 'admin_user', id, body);
      return ok(adminDto(admin));
    },
  );

  app.delete(
    '/admin/admins/:id',
    {
      preHandler: guards.authorize('admins:manage'),
      schema: {
        tags: ['admin'],
        summary: 'Hapus admin',
        params: idParams,
        ...sessionGuard,
      },
    },
    async (request) => {
      const { id } = request.params as IdParams;
      if (id === request.adminUser?.id) {
        throw new ValidationError('Tidak dapat menghapus akun Anda sendiri.');
      }
      const admin = await models.AdminUser.findByPk(id);
      if (!admin) {
        throw new NotFoundError('Admin tidak ditemukan.');
      }
      await admin.destroy();
      await recordAudit(ctx, request, 'admin_removed', 'admin_user', id);
      return ok({ id });
    },
  );

  // ------------------------------------------------------------ audit logs
  app.get(
    '/admin/audit-logs',
    {
      preHandler: guards.authorize('audit:read'),
      schema: { tags: ['admin'], summary: 'Audit log admin', ...sessionGuard },
    },
    async (request) => {
      const query = request.query as PageQuery;
      const { offset, limit, page } = pageOf(query);
      const { rows, count } = await models.AdminAuditLog.findAndCountAll({
        order: [['createdAt', 'DESC']],
        offset,
        limit,
      });
      const adminIds = [
        ...new Set(rows.map((entry) => entry.adminId).filter((id): id is string => Boolean(id))),
      ];
      const admins = await models.AdminUser.findAll({ where: { id: { [Op.in]: adminIds } } });
      const adminEmailById = new Map(admins.map((admin) => [admin.id, admin.email ?? 'admin']));
      return ok({
        items: rows.map((entry) => ({
          id: entry.id,
          admin: entry.adminId ? (adminEmailById.get(entry.adminId) ?? 'admin') : 'sistem',
          action: entry.action,
          target: entry.targetId ?? entry.targetType,
          target_icon: entry.targetType === 'listing' ? 'post' : 'person',
          ip: entry.ipAddress ?? '-',
          at: requiredIso(entry.createdAt),
        })),
        total: count,
        page,
        limit,
      });
    },
  );

  // --------------------------------------------------------------- settings
  const SETTINGS_DEFAULTS = {
    app_name: 'C2C Nearby',
    support_email: 'support@c2cnearby.id',
    radius: 4000,
    maintenance: 'inactive',
    auto_moderation: 'medium',
  } as const;

  async function readSettings(): Promise<Record<string, unknown>> {
    const rows = await models.AppSetting.findAll();
    const map = new Map(rows.map((row) => [row.settingKey, row.value]));
    return {
      app_name: settingValue(map, 'app_name', SETTINGS_DEFAULTS.app_name),
      support_email: settingValue(map, 'support_email', SETTINGS_DEFAULTS.support_email),
      radius: settingValue(map, 'radius', SETTINGS_DEFAULTS.radius),
      maintenance: settingValue(map, 'maintenance', SETTINGS_DEFAULTS.maintenance),
      auto_moderation: settingValue(map, 'auto_moderation', SETTINGS_DEFAULTS.auto_moderation),
    };
  }

  app.get(
    '/admin/settings',
    {
      preHandler: guards.authorize('settings:read'),
      schema: { tags: ['admin'], summary: 'Setelan aplikasi', ...sessionGuard },
    },
    async () => ok(await readSettings()),
  );

  app.put(
    '/admin/settings',
    {
      preHandler: guards.authorize('settings:write'),
      schema: {
        tags: ['admin'],
        summary: 'Simpan setelan aplikasi',
        body: Type.Object({
          app_name: Type.Optional(Type.String({ minLength: 2, maxLength: 120 })),
          support_email: Type.Optional(Type.String({ maxLength: 190 })),
          radius: Type.Optional(Type.Integer({ minimum: 500, maximum: 50000 })),
          maintenance: Type.Optional(Type.String({ maxLength: 32 })),
          auto_moderation: Type.Optional(Type.String({ maxLength: 32 })),
        }),
        ...sessionGuard,
      },
    },
    async (request) => {
      const body = request.body as Record<string, unknown>;
      const admin = authenticatedAdmin(request);
      for (const [key, value] of Object.entries(body)) {
        if (!(key in SETTINGS_DEFAULTS) || value === undefined) {
          continue;
        }
        const [row] = await models.AppSetting.findOrCreate({
          where: { settingKey: key },
          defaults: { settingKey: key, value, updatedByAdminId: admin.id },
        });
        if (row.value !== value) {
          row.value = value;
          row.updatedByAdminId = admin.id;
          await row.save({ fields: ['value', 'updatedByAdminId'] });
        }
      }
      await recordAudit(ctx, request, 'settings_updated', 'app_setting', null, body);
      return ok(await readSettings());
    },
  );

  app.get(
    '/admin/audit-logs/export',
    {
      preHandler: guards.authorize('audit:read'),
      schema: { tags: ['admin'], summary: 'Ekspor audit log (JSON)', ...sessionGuard },
    },
    async () => {
      const rows = await models.AdminAuditLog.findAll({
        order: [['createdAt', 'DESC']],
        limit: 1000,
      });
      return ok({
        items: rows.map((entry) => ({
          id: entry.id,
          admin_id: entry.adminId,
          action: entry.action,
          target_type: entry.targetType,
          target_id: entry.targetId,
          created_at: requiredIso(entry.createdAt),
        })),
      });
    },
  );

};
