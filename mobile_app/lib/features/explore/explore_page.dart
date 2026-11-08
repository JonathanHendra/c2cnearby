import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/providers.dart';
import '../../app/theme/app_theme.dart';
import '../../core/widgets/common_widgets.dart';
import '../../core/widgets/listing_card.dart';
import '../../core/widgets/states.dart';
import '../../data/models/models.dart';

class ExplorePage extends ConsumerStatefulWidget {
  const ExplorePage({super.key});

  @override
  ConsumerState<ExplorePage> createState() => _ExplorePageState();
}

class _ExplorePageState extends ConsumerState<ExplorePage> {
  final _scrollController = ScrollController();
  final _searchController = TextEditingController();
  Timer? _debounce;
  int _lastCategoryType = -1;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _scrollController
      ..removeListener(_onScroll)
      ..dispose();
    _searchController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!_scrollController.hasClients) return;
    final position = _scrollController.position;
    if (position.pixels >= position.maxScrollExtent - 320) {
      ref.read(feedProvider.notifier).loadMore();
    }
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 380), () {
      ref.read(feedProvider.notifier).search(value.trim());
    });
  }

  Future<void> _toggleFavorite(Listing listing) async {
    final favorites = ref.read(favoritesProvider).valueOrNull ?? const [];
    final isFavorite = favorites.any((item) => item.id == listing.id);
    await ref.read(repositoryProvider).setFavorite(listing.id, !isFavorite);
    ref.invalidate(favoritesProvider);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          isFavorite
              ? 'Dihapus dari favorit.'
              : 'Disimpan ke favorit. Hanya Anda yang bisa melihatnya.',
        ),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  Future<void> _showLocationSheet() async {
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) => Padding(
        padding: const EdgeInsets.fromLTRB(24, 0, 24, 28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Area jelajah Anda',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 6),
            Text(
              'Posting yang tampil selalu berada dalam radius 4 km dari lokasi Anda. '
              'Radius ditetapkan server dan tidak bisa diperbesar.',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppPalette.of(context).chipBackground,
                borderRadius: BorderRadius.circular(AppTheme.radiusMd),
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.my_location_rounded,
                    color: Theme.of(context).colorScheme.primary,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Kemang, Jakarta Selatan',
                          style: Theme.of(context).textTheme.titleSmall,
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Area perkiraan · lokasi presisi tidak dibagikan',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () {
                  Navigator.of(context).pop();
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text(
                        'Izin lokasi perangkat diaktifkan pada Fase 3 (autentikasi & onboarding).',
                      ),
                    ),
                  );
                },
                child: const Text('Gunakan lokasi saat ini'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _showRadiusInfo() async {
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) => Padding(
        padding: const EdgeInsets.fromLTRB(24, 0, 24, 28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppPalette.of(context).chipBackground,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Icon(
                    Icons.near_me_outlined,
                    color: Theme.of(context).colorScheme.primary,
                  ),
                ),
                const SizedBox(width: 12),
                Text(
                  'Radius 4 km',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
              ],
            ),
            const SizedBox(height: 14),
            Text(
              'C2C Nearby mempertemukan Anda dengan warga di sekitar. Semua posting '
              'dalam radius 4 km dihitung di server menggunakan koordinat yang '
              'disamarkan — pembeli hanya melihat jarak dan area umum.',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 10),
            Text(
              'Radius tidak dapat diubah dari aplikasi. Ini menjaga relevansi dan '
              'privasi lingkungan Anda.',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 18),
            SizedBox(
              width: double.infinity,
              child: FilledButton.tonal(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('Mengerti'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(feedProvider);
    final notifications = ref.watch(unreadNotificationCountProvider);
    final favorites = ref.watch(favoritesProvider).valueOrNull ?? const [];
    final favoriteIds = favorites.map((item) => item.id).toSet();
    final palette = AppPalette.of(context);
    final isWide = MediaQuery.sizeOf(context).width >= 700;

    if (_lastCategoryType != state.type.index) {
      _lastCategoryType = state.type.index;
      if (_scrollController.hasClients) {
        _scrollController.jumpTo(0);
      }
    }

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          onRefresh: ref.read(feedProvider.notifier).refresh,
          edgeOffset: 40,
          child: CustomScrollView(
            controller: _scrollController,
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _Header(
                        areaLabel: 'Kemang, Jakarta Selatan',
                        unreadNotifications: notifications,
                        onAreaTap: _showLocationSheet,
                        onNotificationsTap: () => context.push('/notifikasi'),
                      ),
                      const SizedBox(height: 16),
                      _SearchField(
                        controller: _searchController,
                        onChanged: _onSearchChanged,
                        onClear: () {
                          _searchController.clear();
                          ref.read(feedProvider.notifier).search('');
                        },
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          InkWell(
                            onTap: _showRadiusInfo,
                            borderRadius: BorderRadius.circular(100),
                            child: SoftPill(
                              label: 'Radius 4 km',
                              icon: Icons.near_me_outlined,
                              color: Theme.of(context).colorScheme.primary,
                              background: Color.alphaBlend(
                                Theme.of(context)
                                    .colorScheme
                                    .primary
                                    .withValues(alpha: 0.10),
                                Theme.of(context).colorScheme.surface,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              '${state.total} posting di sekitar',
                              style: Theme.of(context).textTheme.labelSmall,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          IconButton(
                            tooltip: 'Urutkan',
                            visualDensity: VisualDensity.compact,
                            onPressed: () {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text(
                                    'Posting selalu diurutkan dari yang terdekat.',
                                  ),
                                ),
                              );
                            },
                            icon: const Icon(Icons.tune_rounded, size: 20),
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),
                      _TypeTabs(
                        selected: state.type,
                        onChanged: (type) {
                          _searchController.clear();
                          ref.read(feedProvider.notifier).setType(type);
                        },
                      ),
                      const SizedBox(height: 12),
                      _CategoryRow(
                        type: state.type,
                        selected: state.categorySlug,
                        onSelected: (slug) {
                          _scrollController.jumpTo(0);
                          ref.read(feedProvider.notifier).setCategory(slug);
                        },
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Text(
                            switch (state.type) {
                              PostType.sell => 'Jual di sekitar Anda',
                              PostType.event => 'Event mendatang',
                              PostType.information => 'Informasi lingkungan',
                            },
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                          const Spacer(),
                          if (state.categorySlug != null)
                            TextButton(
                              onPressed: () =>
                                  ref.read(feedProvider.notifier).setCategory(null),
                              style: TextButton.styleFrom(
                                visualDensity: VisualDensity.compact,
                              ),
                              child: const Text('Reset'),
                            ),
                        ],
                      ),
                      const SizedBox(height: 4),
                    ],
                  ),
                ),
              ),
              if (state.isLoading)
                SliverToBoxAdapter(
                  child: ListingGridSkeleton(
                    count: isWide ? 8 : 6,
                  ),
                )
              else if (state.error != null)
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: ErrorState(
                    message: state.error!,
                    onRetry: () => ref.read(feedProvider.notifier).refresh(),
                  ),
                )
              else if (state.items.isEmpty)
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: EmptyState(
                    icon: Icons.search_off_rounded,
                    title: 'Belum ada yang cocok',
                    message: state.query.isNotEmpty
                        ? 'Tidak ada posting untuk “${state.query}” dalam radius 4 km. Coba kata kunci lain.'
                        : 'Belum ada posting pada kategori ini di sekitar Anda. Coba kategori lain atau kembali lagi nanti.',
                    actionLabel: state.categorySlug != null || state.query.isNotEmpty
                        ? 'Hapus filter'
                        : 'Muat ulang',
                    onAction: () {
                      _searchController.clear();
                      ref.read(feedProvider.notifier).search('');
                      ref.read(feedProvider.notifier).setCategory(null);
                    },
                  ),
                )
              else
                SliverPadding(
                  padding: EdgeInsets.fromLTRB(20, 4, 20, 8),
                  sliver: SliverGrid.builder(
                    itemCount: state.items.length,
                    gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: isWide ? 3 : 2,
                      mainAxisSpacing: 12,
                      crossAxisSpacing: 12,
                      childAspectRatio: 0.60,
                    ),
                    itemBuilder: (context, index) {
                      final listing = state.items[index];
                      return ListingCard(
                        listing: listing,
                        isFavorite: favoriteIds.contains(listing.id),
                        onFavorite: () => _toggleFavorite(listing),
                        onTap: () => context.push('/posting/${listing.id}'),
                      );
                    },
                  ),
                ),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 4, 20, 28),
                  child: state.isLoadingMore
                      ? const InlineLoader()
                      : (state.items.isNotEmpty && !state.hasMore)
                          ? Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(
                                  Icons.check_circle_outline_rounded,
                                  size: 15,
                                  color: palette.subtleText,
                                ),
                                const SizedBox(width: 6),
                                Flexible(
                                  child: Text(
                                    'Semua posting dalam radius 4 km sudah ditampilkan',
                                    style: Theme.of(context).textTheme.labelSmall,
                                    textAlign: TextAlign.center,
                                  ),
                                ),
                              ],
                            )
                          : const SizedBox(height: 12),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({
    required this.areaLabel,
    required this.unreadNotifications,
    required this.onAreaTap,
    required this.onNotificationsTap,
  });

  final String areaLabel;
  final int unreadNotifications;
  final VoidCallback onAreaTap;
  final VoidCallback onNotificationsTap;

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    final textTheme = Theme.of(context).textTheme;
    final palette = AppPalette.of(context);
    return Row(
      children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [AppColors.electric, AppColors.electricDark],
            ),
            borderRadius: BorderRadius.circular(12),
          ),
          child: const Icon(Icons.near_me_rounded, color: Colors.white, size: 19),
        ),
        const SizedBox(width: 9),
        Text(
          'nearby',
          style: textTheme.headlineSmall?.copyWith(
            fontWeight: FontWeight.w800,
            letterSpacing: -0.8,
          ),
        ),
        Text(
          '.',
          style: textTheme.headlineSmall?.copyWith(
            color: primary,
            fontWeight: FontWeight.w800,
          ),
        ),
        const Spacer(),
        InkWell(
          onTap: onAreaTap,
          borderRadius: BorderRadius.circular(12),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.place_outlined, size: 16, color: primary),
                const SizedBox(width: 3),
                ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 118),
                  child: Text(
                    areaLabel,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: textTheme.labelSmall?.copyWith(
                      color: palette.mutedText,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                Icon(Icons.keyboard_arrow_down_rounded,
                    size: 16, color: palette.mutedText),
              ],
            ),
          ),
        ),
        const SizedBox(width: 4),
        IconButton(
          onPressed: onNotificationsTap,
          tooltip: 'Notifikasi',
          visualDensity: VisualDensity.compact,
          icon: Stack(
            clipBehavior: Clip.none,
            children: [
              const Icon(Icons.notifications_none_rounded, size: 23),
              if (unreadNotifications > 0)
                Positioned(
                  right: -1,
                  top: -1,
                  child: Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: palette.favorite,
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: Theme.of(context).scaffoldBackgroundColor,
                        width: 1.5,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class _SearchField extends StatelessWidget {
  const _SearchField({
    required this.controller,
    required this.onChanged,
    required this.onClear,
  });

  final TextEditingController controller;
  final ValueChanged<String> onChanged;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    final palette = AppPalette.of(context);
    return TextField(
      controller: controller,
      onChanged: onChanged,
      textInputAction: TextInputAction.search,
      style: Theme.of(context).textTheme.bodyMedium,
      decoration: InputDecoration(
        hintText: 'Cari barang, event, atau info di sekitar',
        hintMaxLines: 1,
        prefixIcon: Icon(Icons.search_rounded, color: palette.subtleText),
        suffixIcon: ValueListenableBuilder<TextEditingValue>(
          valueListenable: controller,
          builder: (context, value, _) {
            if (value.text.isEmpty) return const SizedBox.shrink();
            return IconButton(
              onPressed: onClear,
              tooltip: 'Hapus pencarian',
              icon: const Icon(Icons.close_rounded, size: 18),
            );
          },
        ),
        isDense: true,
        contentPadding: const EdgeInsets.symmetric(vertical: 14),
      ),
    );
  }
}

class _TypeTabs extends StatelessWidget {
  const _TypeTabs({required this.selected, required this.onChanged});

  final PostType selected;
  final ValueChanged<PostType> onChanged;

  @override
  Widget build(BuildContext context) {
    final palette = AppPalette.of(context);
    final primary = Theme.of(context).colorScheme.primary;
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: palette.chipBackground,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          for (final type in PostType.values)
            Expanded(
              child: GestureDetector(
                onTap: () => onChanged(type),
                behavior: HitTestBehavior.opaque,
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  padding: const EdgeInsets.symmetric(vertical: 9),
                  decoration: BoxDecoration(
                    color: selected == type
                        ? Theme.of(context).colorScheme.surface
                        : Colors.transparent,
                    borderRadius: BorderRadius.circular(11),
                    boxShadow: selected == type
                        ? [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.06),
                              blurRadius: 8,
                              offset: const Offset(0, 2),
                            ),
                          ]
                        : null,
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        postTypeIcon(type),
                        size: 15,
                        color: selected == type ? primary : palette.mutedText,
                      ),
                      const SizedBox(width: 5),
                      Text(
                        type.label,
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                              color: selected == type
                                  ? primary
                                  : palette.mutedText,
                              fontWeight: selected == type
                                  ? FontWeight.w700
                                  : FontWeight.w500,
                            ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _CategoryRow extends ConsumerWidget {
  const _CategoryRow({
    required this.type,
    required this.selected,
    required this.onSelected,
  });

  final PostType type;
  final String? selected;
  final ValueChanged<String?> onSelected;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = AppPalette.of(context);
    final primary = Theme.of(context).colorScheme.primary;
    final categories = (ref.watch(categoriesProvider).valueOrNull ??
            const <Category>[])
        .where((item) => item.type == type)
        .toList(growable: false);
    return SizedBox(
      height: 36,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: categories.length + 1,
        separatorBuilder: (_, _) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          final isAll = index == 0;
          final category = isAll ? null : categories[index - 1];
          final isSelected = isAll ? selected == null : selected == category!.slug;
          return GestureDetector(
            onTap: () => onSelected(isAll ? null : category!.slug),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 160),
              padding: const EdgeInsets.symmetric(horizontal: 13),
              decoration: BoxDecoration(
                color: isSelected
                    ? primary
                    : Theme.of(context).colorScheme.surface,
                borderRadius: BorderRadius.circular(100),
                border: Border.all(
                  color: isSelected ? primary : palette.border,
                ),
              ),
              child: Row(
                children: [
                  Icon(
                    isAll ? Icons.apps_rounded : categoryIcon(category!.slug),
                    size: 14,
                    color: isSelected ? Colors.white : palette.mutedText,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    isAll ? 'Semua' : category!.name,
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: isSelected ? Colors.white : palette.mutedText,
                          fontWeight:
                              isSelected ? FontWeight.w700 : FontWeight.w500,
                        ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
