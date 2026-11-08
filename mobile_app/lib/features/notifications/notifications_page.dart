import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/providers.dart';
import '../../app/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../core/widgets/states.dart';
import '../../data/models/models.dart';

class NotificationsPage extends ConsumerWidget {
  const NotificationsPage({super.key});

  IconData _icon(String type) => switch (type) {
        'offer' => Icons.local_offer_outlined,
        'chat' => Icons.chat_bubble_outline_rounded,
        'event' => Icons.event_outlined,
        'expiry' => Icons.schedule_outlined,
        'review' => Icons.star_border_rounded,
        'security' => Icons.shield_outlined,
        _ => Icons.notifications_none_rounded,
      };

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(notificationsProvider);
    final palette = AppPalette.of(context);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifikasi'),
        actions: [
          TextButton(
            onPressed: () async {
              await ref.read(repositoryProvider).markNotificationsRead();
              ref.invalidate(notificationsProvider);
              if (!context.mounted) return;
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Semua notifikasi ditandai dibaca.')),
              );
            },
            child: const Text('Tandai dibaca'),
          ),
        ],
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, _) => ErrorState(
          message: 'Notifikasi tidak dapat dimuat.',
          onRetry: () => ref.invalidate(notificationsProvider),
        ),
        data: (items) {
          if (items.isEmpty) {
            return const EmptyState(
              icon: Icons.notifications_off_outlined,
              title: 'Belum ada notifikasi',
              message:
                  'Pesan baru, penawaran, event, dan pengingat posting akan muncul di sini.',
            );
          }
          final today = items
              .where((item) =>
                  DateTime.now().difference(item.createdAt).inHours < 24)
              .toList();
          final earlier = items.where((item) => !today.contains(item)).toList();
          return ListView(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
            children: [
              if (today.isNotEmpty) ...[
                Text('Hari ini', style: Theme.of(context).textTheme.labelMedium),
                const SizedBox(height: 8),
                for (final item in today) ...[
                  _NotificationTile(
                    item: item,
                    icon: _icon(item.type),
                    onTap: () => _open(context, ref, item),
                  ),
                  const SizedBox(height: 8),
                ],
                const SizedBox(height: 8),
              ],
              if (earlier.isNotEmpty) ...[
                Text('Sebelumnya',
                    style: Theme.of(context).textTheme.labelMedium),
                const SizedBox(height: 8),
                for (final item in earlier) ...[
                  _NotificationTile(
                    item: item,
                    icon: _icon(item.type),
                    onTap: () => _open(context, ref, item),
                  ),
                  const SizedBox(height: 8),
                ],
              ],
              const SizedBox(height: 8),
              Text(
                'Notifikasi tidak pernah memuat nomor telepon, koordinat rumah, '
                'atau data sensitif lain.',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: palette.subtleText,
                    ),
              ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _open(
    BuildContext context,
    WidgetRef ref,
    AppNotification item,
  ) async {
    await ref.read(repositoryProvider).markNotificationRead(item.id);
    ref.invalidate(notificationsProvider);
    if (!context.mounted) return;
    await showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(item.title),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(item.body),
            const SizedBox(height: 10),
            Text(
              timeAgo(item.createdAt),
              style: Theme.of(context).textTheme.labelSmall,
            ),
          ],
        ),
        actions: [
          FilledButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Tutup'),
          ),
        ],
      ),
    );
  }
}

class _NotificationTile extends StatelessWidget {
  const _NotificationTile({
    required this.item,
    required this.icon,
    required this.onTap,
  });

  final AppNotification item;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final palette = AppPalette.of(context);
    final primary = Theme.of(context).colorScheme.primary;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppTheme.radiusMd),
      child: Container(
        padding: const EdgeInsets.all(13),
        decoration: BoxDecoration(
          color: item.read
              ? Theme.of(context).colorScheme.surface
              : Color.alphaBlend(
                  primary.withValues(alpha: 0.05),
                  Theme.of(context).colorScheme.surface,
                ),
          borderRadius: BorderRadius.circular(AppTheme.radiusMd),
          border: Border.all(
            color: item.read ? palette.border : primary.withValues(alpha: 0.3),
          ),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: primary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(11),
              ),
              child: Icon(icon, size: 18, color: primary),
            ),
            const SizedBox(width: 11),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          item.title,
                          style: Theme.of(context).textTheme.titleSmall?.copyWith(
                                fontWeight:
                                    item.read ? FontWeight.w600 : FontWeight.w800,
                              ),
                        ),
                      ),
                      if (!item.read)
                        Container(
                          width: 7,
                          height: 7,
                          decoration: BoxDecoration(
                            color: primary,
                            shape: BoxShape.circle,
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 3),
                  Text(item.body, style: Theme.of(context).textTheme.bodySmall),
                  const SizedBox(height: 4),
                  Text(
                    timeAgo(item.createdAt),
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: palette.subtleText,
                        ),
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
