import { randomUUID } from 'node:crypto';

import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsync } from 'fastify';
import { Op } from 'sequelize';

import {
  authenticatedUser,
  type AuthContext,
  type AuthGuards,
} from '../auth/index.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../common/errors.js';
import { ok } from '../common/response.js';
import type { DatabaseModels } from '../database/models/index.js';
import type { Listing } from '../database/models/listing.model.js';
import type { User } from '../database/models/user.model.js';

export interface InboxRoutesOptions {
  readonly ctx: AuthContext;
  readonly guards: AuthGuards;
}

interface IdParams {
  id: string;
}

function requiredIso(value: Date): string {
  return new Date(value).toISOString();
}

function nameOf(user: User | null): string {
  if (!user) {
    return 'Pengguna';
  }
  return user.displayName ?? user.fullName ?? user.username;
}

const sessionGuard = { security: [{ bearerAuth: [] }] } as const;
const idParams = Type.Object({ id: Type.String({ minLength: 1, maxLength: 36 }) });

export const inboxRoutes: FastifyPluginAsync<InboxRoutesOptions> = async (app, options) => {
  const { guards } = options;
  const models: DatabaseModels = options.ctx.models;

  async function listingOf(listingId: string): Promise<Listing | null> {
    return models.Listing.findByPk(listingId);
  }

  async function participants(conversationId: string) {
    const conversation = await models.Conversation.findByPk(conversationId);
    if (!conversation) {
      throw new NotFoundError('Percakapan');
    }
    return conversation;
  }

  async function toConversationDto(
    conversation: Awaited<ReturnType<typeof participants>>,
    viewerId: string,
    withMessages: boolean,
  ) {
    const listing = await listingOf(conversation.listingId);
    const otherId = conversation.buyerId === viewerId ? conversation.sellerId : conversation.buyerId;
    const other = await models.User.findByPk(otherId);
    const image = listing
      ? await models.ListingImage.findOne({
          where: { listingId: listing.id },
          order: [['sortOrder', 'ASC']],
        })
      : null;
    const unread = await models.Message.count({
      where: {
        conversationId: conversation.id,
        senderId: { [Op.ne]: viewerId },
        readAt: null,
      },
    });
    const messages = withMessages
      ? await models.Message.findAll({
          where: { conversationId: conversation.id },
          order: [['createdAt', 'ASC']],
          limit: 200,
        })
      : [];

    return {
      id: conversation.id,
      listing_id: conversation.listingId,
      listing_title: listing?.title ?? 'Posting dihapus',
      listing_image: image?.thumbnailUrl ?? '',
      other_name: nameOf(other),
      other_avatar: other?.avatarUrl ?? '',
      other_username: other?.username ?? 'pengguna',
      last_message: conversation.lastMessagePreview ?? '',
      updated_at: requiredIso(conversation.lastMessageAt ?? conversation.createdAt),
      unread,
      i_am_seller: conversation.sellerId === viewerId,
      listing_price: listing?.price === null || listing?.price === undefined
        ? null
        : Number(listing.price),
      messages: messages.map((message) => ({
        id: message.id,
        sender_is_me: message.senderId === viewerId,
        type: message.messageType,
        text: message.content,
        image_url: message.mediaUrl,
        created_at: requiredIso(message.createdAt),
        read: message.readAt !== null,
      })),
    };
  }

  // ---------------------------------------------------------- conversations
  app.get(
    '/me/conversations',
    {
      preHandler: guards.authenticate,
      schema: { tags: ['chat'], summary: 'Daftar percakapan saya', ...sessionGuard },
    },
    async (request) => {
      const user = authenticatedUser(request);
      const rows = await models.Conversation.findAll({
        where: { [Op.or]: [{ buyerId: user.id }, { sellerId: user.id }] },
        order: [['lastMessageAt', 'DESC']],
        limit: 100,
      });
      const items = await Promise.all(
        rows.map((conversation) => toConversationDto(conversation, user.id, false)),
      );
      return ok({ items });
    },
  );

  app.post(
    '/me/conversations',
    {
      preHandler: guards.authenticate,
      schema: {
        tags: ['chat'],
        summary: 'Buka percakapan untuk sebuah posting',
        body: Type.Object({ listing_id: Type.String({ minLength: 1, maxLength: 36 }) }),
        ...sessionGuard,
      },
    },
    async (request) => {
      const user = authenticatedUser(request);
      const { listing_id } = request.body as { listing_id: string };
      const listing = await listingOf(listing_id);
      if (!listing) {
        throw new NotFoundError('Posting');
      }
      if (listing.userId === user.id) {
        throw new ValidationError('Anda tidak dapat mengirim pesan ke posting milik sendiri.');
      }

      const [conversation] = await models.Conversation.findOrCreate({
        where: { listingId: listing.id, buyerId: user.id, sellerId: listing.userId },
        defaults: {
          id: randomUUID(),
          listingId: listing.id,
          buyerId: user.id,
          sellerId: listing.userId,
          lastMessageAt: null,
          lastMessagePreview: null,
        },
      });
      return ok(await toConversationDto(conversation, user.id, true));
    },
  );

  app.get(
    '/me/conversations/:id',
    {
      preHandler: guards.authenticate,
      schema: {
        tags: ['chat'],
        summary: 'Detail percakapan',
        params: idParams,
        ...sessionGuard,
      },
    },
    async (request) => {
      const user = authenticatedUser(request);
      const { id } = request.params as IdParams;
      const conversation = await participants(id);
      if (conversation.buyerId !== user.id && conversation.sellerId !== user.id) {
        throw new ForbiddenError('Anda bukan bagian dari percakapan ini.');
      }
      return ok(await toConversationDto(conversation, user.id, true));
    },
  );

  app.post(
    '/me/conversations/:id/messages',
    {
      preHandler: guards.authenticate,
      schema: {
        tags: ['chat'],
        summary: 'Kirim pesan',
        params: idParams,
        body: Type.Object({
          text: Type.String({ minLength: 1, maxLength: 2000 }),
        }),
        ...sessionGuard,
      },
    },
    async (request) => {
      const user = authenticatedUser(request);
      const { id } = request.params as IdParams;
      const { text } = request.body as { text: string };
      const conversation = await participants(id);
      if (conversation.buyerId !== user.id && conversation.sellerId !== user.id) {
        throw new ForbiddenError('Anda bukan bagian dari percakapan ini.');
      }
      const message = await models.Message.create(
        {
          conversationId: conversation.id,
          senderId: user.id,
          messageType: 'text',
          content: text.trim(),
          mediaUrl: null,
          readAt: null,
        },
        {},
      );
      conversation.lastMessageAt = message.createdAt;
      conversation.lastMessagePreview = text.trim().slice(0, 200);
      await conversation.save({ fields: ['lastMessageAt', 'lastMessagePreview'] });
      return ok({
        id: message.id,
        sender_is_me: true,
        type: 'text',
        text: message.content,
        image_url: null,
        created_at: requiredIso(message.createdAt),
        read: false,
      });
    },
  );

  app.post(
    '/me/conversations/:id/read',
    {
      preHandler: guards.authenticate,
      schema: {
        tags: ['chat'],
        summary: 'Tandai pesan percakapan sudah dibaca',
        params: idParams,
        ...sessionGuard,
      },
    },
    async (request) => {
      const user = authenticatedUser(request);
      const { id } = request.params as IdParams;
      const conversation = await participants(id);
      if (conversation.buyerId !== user.id && conversation.sellerId !== user.id) {
        throw new ForbiddenError('Anda bukan bagian dari percakapan ini.');
      }
      const [updated] = await models.Message.update(
        { readAt: new Date() },
        {
          where: {
            conversationId: conversation.id,
            senderId: { [Op.ne]: user.id },
            readAt: null,
          },
        },
      );
      return ok({ marked: updated });
    },
  );

  // ---------------------------------------------------------- notifications
  app.get(
    '/me/notifications',
    {
      preHandler: guards.authenticate,
      schema: { tags: ['notifications'], summary: 'Notifikasi saya', ...sessionGuard },
    },
    async (request) => {
      const user = authenticatedUser(request);
      const rows = await models.Notification.findAll({
        where: { userId: user.id },
        order: [['createdAt', 'DESC']],
        limit: 100,
      });
      return ok({
        items: rows.map((row) => ({
          id: row.id,
          title: row.title,
          body: row.body,
          type: row.type,
          created_at: requiredIso(row.createdAt),
          read: row.readAt !== null,
        })),
      });
    },
  );

  app.post(
    '/me/notifications/read-all',
    {
      preHandler: guards.authenticate,
      schema: { tags: ['notifications'], summary: 'Tandai semua notifikasi dibaca', ...sessionGuard },
    },
    async (request) => {
      const user = authenticatedUser(request);
      const [updated] = await models.Notification.update(
        { readAt: new Date() },
        { where: { userId: user.id, readAt: null } },
      );
      return ok({ marked: updated });
    },
  );

  app.post(
    '/me/notifications/:id/read',
    {
      preHandler: guards.authenticate,
      schema: {
        tags: ['notifications'],
        summary: 'Tandai satu notifikasi dibaca',
        params: idParams,
        ...sessionGuard,
      },
    },
    async (request) => {
      const user = authenticatedUser(request);
      const { id } = request.params as IdParams;
      const notification = await models.Notification.findByPk(id);
      if (!notification || notification.userId !== user.id) {
        throw new NotFoundError('Notifikasi');
      }
      if (!notification.readAt) {
        notification.readAt = new Date();
        await notification.save({ fields: ['readAt'] });
      }
      return ok({ id });
    },
  );

  // ---------------------------------------------------------------- reviews
  app.get(
    '/me/reviews',
    {
      preHandler: guards.authenticate,
      schema: { tags: ['reviews'], summary: 'Ulasan yang saya terima', ...sessionGuard },
    },
    async (request) => {
      const user = authenticatedUser(request);
      const rows = await models.Review.findAll({
        where: { revieweeId: user.id, hiddenAt: null },
        order: [['createdAt', 'DESC']],
        limit: 100,
      });
      const reviewerIds = [...new Set(rows.map((row) => row.reviewerId))];
      const reviewers = await models.User.findAll({ where: { id: { [Op.in]: reviewerIds } } });
      const byId = new Map(reviewers.map((reviewer) => [reviewer.id, reviewer]));
      const total = rows.length;
      const average =
        total === 0 ? 0 : rows.reduce((sum, row) => sum + Number(row.rating), 0) / total;

      return ok({
        rating: Number(average.toFixed(1)),
        count: total,
        items: rows.map((row) => ({
          id: row.id,
          author_name: nameOf(byId.get(row.reviewerId) ?? null),
          author_avatar: byId.get(row.reviewerId)?.avatarUrl ?? '',
          rating: Number(row.rating),
          comment: row.review ?? '',
          created_at: requiredIso(row.createdAt),
        })),
      });
    },
  );
};
