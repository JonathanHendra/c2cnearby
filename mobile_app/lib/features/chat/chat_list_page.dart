import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/providers.dart';
import '../../app/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../core/widgets/common_widgets.dart';
import '../../core/widgets/states.dart';
import '../../data/models/models.dart';

class ChatListPage extends ConsumerStatefulWidget {
  const ChatListPage({super.key});

  @override
  ConsumerState<ChatListPage> createState() => _ChatListPageState();
}

class _ChatListPageState extends ConsumerState<ChatListPage> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(conversationsProvider);
    final palette = AppPalette.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Chat'),
            Text(
              'Negosiasi tetap di dalam platform',
              style: Theme.of(context).textTheme.labelSmall,
            ),
          ],
        ),
        toolbarHeight: 68,
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 10),
            child: TextField(
              onChanged: (value) => setState(() => _query = value.toLowerCase()),
              decoration: const InputDecoration(
                hintText: 'Cari percakapan atau barang',
                prefixIcon: Icon(Icons.search_rounded),
                isDense: true,
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 10),
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: palette.chipBackground,
                borderRadius: BorderRadius.circular(AppTheme.radiusMd),
              ),
              child: Row(
                children: [
                  Icon(Icons.lock_outline_rounded,
                      size: 17, color: palette.mutedText),
                  const SizedBox(width: 9),
                  Expanded(
                    child: Text(
                      'Jangan bagikan nomor telepon atau alamat rumah. '
                      'Sepakati pertemuan di tempat publik.',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ),
                ],
              ),
            ),
          ),
          Expanded(
            child: async.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (_, _) => ErrorState(
                message: 'Percakapan tidak dapat dimuat.',
                onRetry: () => ref.invalidate(conversationsProvider),
              ),
              data: (items) {
                final filtered = items.where((item) {
                  if (_query.isEmpty) return true;
                  return item.otherName.toLowerCase().contains(_query) ||
                      item.listingTitle.toLowerCase().contains(_query);
                }).toList();
                if (filtered.isEmpty) {
                  return EmptyState(
                    icon: Icons.chat_bubble_outline_rounded,
                    title: items.isEmpty ? 'Belum ada percakapan' : 'Tidak ditemukan',
                    message: items.isEmpty
                        ? 'Mulai chat dari halaman detail posting untuk bertanya '
                            'atau menegosiasikan harga.'
                        : 'Coba kata kunci lain.',
                    actionLabel: items.isEmpty ? 'Jelajah posting' : null,
                    onAction:
                        items.isEmpty ? () => context.go('/jelajah') : null,
                  );
                }
                return RefreshIndicator(
                  onRefresh: () async {
                    ref.invalidate(conversationsProvider);
                    await ref.read(conversationsProvider.future);
                  },
                  child: ListView.separated(
                    padding: const EdgeInsets.fromLTRB(8, 0, 8, 24),
                    itemCount: filtered.length,
                    separatorBuilder: (_, _) => Divider(
                      indent: 78,
                      endIndent: 16,
                      color: palette.border,
                    ),
                    itemBuilder: (context, index) {
                      final conversation = filtered[index];
                      return _ConversationTile(conversation: conversation);
                    },
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _ConversationTile extends StatelessWidget {
  const _ConversationTile({required this.conversation});

  final Conversation conversation;

  @override
  Widget build(BuildContext context) {
    final palette = AppPalette.of(context);
    final primary = Theme.of(context).colorScheme.primary;
    final hasUnread = conversation.unread > 0;
    return InkWell(
      onTap: () => context.push('/chat/${conversation.id}'),
      borderRadius: BorderRadius.circular(16),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                AppAvatar(
                  imageUrl: conversation.otherAvatar,
                  name: conversation.otherName,
                  size: 52,
                ),
                if (conversation.iAmSeller)
                  Positioned(
                    bottom: -2,
                    right: -2,
                    child: Container(
                      padding: const EdgeInsets.all(3),
                      decoration: BoxDecoration(
                        color: primary,
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: Theme.of(context).colorScheme.surface,
                          width: 2,
                        ),
                      ),
                      child: const Icon(Icons.storefront_rounded,
                          size: 10, color: Colors.white),
                    ),
                  ),
              ],
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          conversation.otherName,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.titleSmall?.copyWith(
                                fontWeight:
                                    hasUnread ? FontWeight.w800 : FontWeight.w600,
                              ),
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        formatChatTime(conversation.updatedAt),
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                              color:
                                  hasUnread ? primary : palette.subtleText,
                              fontWeight:
                                  hasUnread ? FontWeight.w700 : FontWeight.w500,
                            ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    conversation.listingTitle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: primary,
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          conversation.lastMessage.isEmpty
                              ? 'Mulai percakapan'
                              : conversation.lastMessage,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                color: hasUnread
                                    ? Theme.of(context).colorScheme.onSurface
                                    : palette.mutedText,
                                fontWeight: hasUnread
                                    ? FontWeight.w600
                                    : FontWeight.w400,
                              ),
                        ),
                      ),
                      if (hasUnread) ...[
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 6,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: primary,
                            borderRadius: BorderRadius.circular(100),
                          ),
                          child: Text(
                            '${conversation.unread}',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
