import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/providers.dart';
import '../../app/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../core/widgets/common_widgets.dart';
import '../../core/widgets/smart_image.dart';
import '../../core/widgets/states.dart';
import '../../data/models/models.dart';

class MyListingsPage extends ConsumerWidget {
  const MyListingsPage({super.key});

  static const _statuses = [
    ListingStatus.active,
    ListingStatus.draft,
    ListingStatus.sold,
    ListingStatus.completed,
    ListingStatus.expired,
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(myListingsProvider);
    return DefaultTabController(
      length: _statuses.length,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Posting Saya'),
          bottom: TabBar(
            isScrollable: true,
            tabAlignment: TabAlignment.start,
            labelStyle: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
            unselectedLabelStyle: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w500,
            ),
            tabs: [
              for (final status in _statuses) Tab(text: status.label),
            ],
          ),
        ),
        body: async.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (_, _) => ErrorState(
            message: 'Posting Anda tidak dapat dimuat.',
            onRetry: () => ref.invalidate(myListingsProvider),
          ),
          data: (items) {
            return TabBarView(
              children: [
                for (final status in _statuses)
                  _ListingsTab(
                    status: status,
                    items: items.where((item) => item.status == status).toList(),
                  ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _ListingsTab extends ConsumerWidget {
  const _ListingsTab({required this.status, required this.items});

  final ListingStatus status;
  final List<Listing> items;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (items.isEmpty) {
      return EmptyState(
        icon: Icons.inventory_2_outlined,
        title: 'Belum ada posting ${status.label.toLowerCase()}',
        message: status == ListingStatus.active
            ? 'Posting aktif Anda akan tampil di sini dan dapat ditemukan warga dalam radius 4 km.'
            : 'Posting dengan status ${status.label.toLowerCase()} akan muncul di tab ini.',
        actionLabel: status == ListingStatus.active ? 'Buat posting' : null,
        onAction: status == ListingStatus.active
            ? () => context.go('/jual')
            : null,
      );
    }
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
      itemCount: items.length,
      separatorBuilder: (_, _) => const SizedBox(height: 10),
      itemBuilder: (context, index) {
        final listing = items[index];
        return _MyListingRow(
          listing: listing,
          onAction: (action) => _handle(context, ref, listing, action),
        );
      },
    );
  }

  Future<void> _handle(
    BuildContext context,
    WidgetRef ref,
    Listing listing,
    String action,
  ) async {
    final repository = ref.read(repositoryProvider);
    switch (action) {
      case 'publish':
        await repository.updateListingStatus(listing.id, ListingStatus.active);
        ref.invalidate(myListingsProvider);
        if (!context.mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Posting dipublikasikan.')),
        );
      case 'hide':
        await repository.updateListingStatus(listing.id, ListingStatus.hidden);
        ref.invalidate(myListingsProvider);
        if (!context.mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Posting disembunyikan dari pencarian.')),
        );
      case 'sold':
        await repository.updateListingStatus(listing.id, ListingStatus.sold);
        ref.invalidate(myListingsProvider);
        if (!context.mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Ditandai terjual.')),
        );
      case 'complete':
        await repository.updateListingStatus(listing.id, ListingStatus.completed);
        ref.invalidate(myListingsProvider);
        if (!context.mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Transaksi ditandai selesai.')),
        );
      case 'renew':
        await repository.updateListingStatus(listing.id, ListingStatus.active);
        ref.invalidate(myListingsProvider);
        if (!context.mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Posting diaktifkan kembali. Masa tayang diperbarui di server pada Fase 4.',
            ),
          ),
        );
      case 'edit':
        if (!context.mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Editor posting lengkap terhubung pada Fase 4 bersama API listings.',
            ),
          ),
        );
      case 'delete':
        final confirmed = await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('Hapus posting?'),
            content: Text(
              '“${listing.title}” akan dihapus dari daftar Anda. '
              'Penghapusan di server menggunakan soft delete pada Fase 4.',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(context).pop(false),
                child: const Text('Batal'),
              ),
              FilledButton(
                onPressed: () => Navigator.of(context).pop(true),
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.danger,
                ),
                child: const Text('Hapus'),
              ),
            ],
          ),
        );
        if (confirmed != true) return;
        await repository.deleteListing(listing.id);
        ref.invalidate(myListingsProvider);
        if (!context.mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Posting dihapus dari daftar lokal.')),
        );
    }
  }
}

class _MyListingRow extends StatelessWidget {
  const _MyListingRow({required this.listing, required this.onAction});

  final Listing listing;
  final ValueChanged<String> onAction;

  @override
  Widget build(BuildContext context) {
    final palette = AppPalette.of(context);
    final primary = Theme.of(context).colorScheme.primary;
    final actions = switch (listing.status) {
      ListingStatus.active => const [
          ('edit', 'Edit posting'),
          ('hide', 'Sembunyikan'),
          ('sold', 'Tandai terjual'),
          ('delete', 'Hapus'),
        ],
      ListingStatus.draft => const [
          ('publish', 'Publikasikan'),
          ('edit', 'Edit draft'),
          ('delete', 'Hapus draft'),
        ],
      ListingStatus.sold => const [
          ('complete', 'Tandai transaksi selesai'),
          ('edit', 'Edit posting'),
        ],
      ListingStatus.expired => const [
          ('renew', 'Perpanjang masa tayang'),
          ('delete', 'Hapus'),
        ],
      _ => const [('edit', 'Edit posting')],
    };
    final statusColor = switch (listing.status) {
      ListingStatus.active => AppColors.success,
      ListingStatus.sold || ListingStatus.completed => primary,
      ListingStatus.expired => AppColors.warning,
      ListingStatus.rejected => AppColors.danger,
      _ => palette.mutedText,
    };
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(10),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: SmartImage(
                url: listing.images.isEmpty ? null : listing.images.first.thumbUrl,
                width: 86,
                height: 86,
                icon: categoryIcon(listing.categorySlug),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Text(
                          listing.title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.titleSmall,
                        ),
                      ),
                      SizedBox(
                        height: 28,
                        width: 28,
                        child: PopupMenuButton<String>(
                          padding: EdgeInsets.zero,
                          iconSize: 18,
                          tooltip: 'Kelola posting',
                          onSelected: onAction,
                          itemBuilder: (context) => [
                            for (final action in actions)
                              PopupMenuItem(
                                value: action.$1,
                                child: Text(action.$2),
                              ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    formatRupiah(listing.price),
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          color: primary,
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 7,
                          vertical: 3,
                        ),
                        decoration: BoxDecoration(
                          color: statusColor.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(100),
                        ),
                        child: Text(
                          listing.status.label,
                          style: TextStyle(
                            fontSize: 9.5,
                            fontWeight: FontWeight.w700,
                            color: statusColor,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Icon(Icons.visibility_outlined,
                          size: 12, color: palette.subtleText),
                      const SizedBox(width: 3),
                      Text(
                        '${listing.viewCount}',
                        style: Theme.of(context).textTheme.labelSmall,
                      ),
                      const SizedBox(width: 8),
                      Icon(Icons.favorite_border_rounded,
                          size: 12, color: palette.subtleText),
                      const SizedBox(width: 3),
                      Text(
                        '${listing.favoriteCount}',
                        style: Theme.of(context).textTheme.labelSmall,
                      ),
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
