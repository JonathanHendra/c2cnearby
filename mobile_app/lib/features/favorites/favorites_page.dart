import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/providers.dart';
import '../../app/theme/app_theme.dart';
import '../../core/widgets/listing_card.dart';
import '../../core/widgets/states.dart';
import '../../data/models/models.dart';

class FavoritesPage extends ConsumerStatefulWidget {
  const FavoritesPage({super.key});

  @override
  ConsumerState<FavoritesPage> createState() => _FavoritesPageState();
}

class _FavoritesPageState extends ConsumerState<FavoritesPage> {
  PostType? _filter;

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(favoritesProvider);
    final all = async.valueOrNull ?? const <Listing>[];
    final items = _filter == null
        ? all
        : all.where((item) => item.type == _filter).toList();

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Favorit'),
            Text(
              '${all.length} posting tersimpan',
              style: Theme.of(context).textTheme.labelSmall,
            ),
          ],
        ),
        toolbarHeight: 68,
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 12),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  _FilterChip(
                    label: 'Semua',
                    selected: _filter == null,
                    onTap: () => setState(() => _filter = null),
                  ),
                  for (final type in PostType.values) ...[
                    const SizedBox(width: 8),
                    _FilterChip(
                      label: type.label,
                      selected: _filter == type,
                      onTap: () => setState(() => _filter = type),
                    ),
                  ],
                ],
              ),
            ),
          ),
          Expanded(
            child: async.when(
              loading: () => const ListingGridSkeleton(count: 4),
              error: (_, _) => ErrorState(
                message: 'Daftar favorit tidak dapat dimuat.',
                onRetry: () => ref.invalidate(favoritesProvider),
              ),
              data: (_) {
                if (items.isEmpty) {
                  return EmptyState(
                    icon: Icons.favorite_border_rounded,
                    title: all.isEmpty
                        ? 'Belum ada favorit'
                        : 'Tidak ada favorit ${_filter?.label.toLowerCase()}',
                    message: all.isEmpty
                        ? 'Tekan ikon hati pada posting untuk menyimpannya di sini. '
                            'Favorit bersifat privat.'
                        : 'Coba filter jenis posting lain.',
                    actionLabel: all.isEmpty ? 'Jelajah sekarang' : 'Lihat semua',
                    onAction: () {
                      if (all.isEmpty) {
                        context.go('/jelajah');
                      } else {
                        setState(() => _filter = null);
                      }
                    },
                  );
                }
                return GridView.builder(
                  padding: const EdgeInsets.fromLTRB(20, 4, 20, 28),
                  itemCount: items.length,
                  gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: MediaQuery.sizeOf(context).width >= 700 ? 3 : 2,
                    mainAxisSpacing: 12,
                    crossAxisSpacing: 12,
                    childAspectRatio: 0.60,
                  ),
                  itemBuilder: (context, index) {
                    final listing = items[index];
                    return ListingCard(
                      listing: listing,
                      isFavorite: true,
                      onFavorite: () async {
                        await ref
                            .read(repositoryProvider)
                            .setFavorite(listing.id, false);
                        ref.invalidate(favoritesProvider);
                        if (!context.mounted) return;
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Dihapus dari favorit.')),
                        );
                      },
                      onTap: () => context.push('/posting/${listing.id}'),
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final palette = AppPalette.of(context);
    final primary = Theme.of(context).colorScheme.primary;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? primary : Theme.of(context).colorScheme.surface,
          borderRadius: BorderRadius.circular(100),
          border: Border.all(color: selected ? primary : palette.border),
        ),
        child: Text(
          label,
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: selected ? Colors.white : palette.mutedText,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
              ),
        ),
      ),
    );
  }
}
