import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/providers.dart';
import '../../app/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../core/widgets/common_widgets.dart';
import '../../core/widgets/smart_image.dart';
import '../../core/widgets/states.dart';
import '../../data/models/models.dart';

final listingDetailProvider =
    FutureProvider.autoDispose.family<Listing?, String>((ref, id) {
  return ref.watch(repositoryProvider).fetchListing(id);
});

final sellerListingsProvider =
    FutureProvider.autoDispose.family<List<Listing>, String>((ref, sellerId) {
  return ref.watch(repositoryProvider).fetchSellerListings(sellerId);
});

class ListingDetailPage extends ConsumerStatefulWidget {
  const ListingDetailPage({super.key, required this.listingId});

  final String listingId;

  @override
  ConsumerState<ListingDetailPage> createState() => _ListingDetailPageState();
}

class _ListingDetailPageState extends ConsumerState<ListingDetailPage> {
  bool _interested = false;
  bool _openingChat = false;

  Future<void> _toggleFavorite(Listing listing) async {
    final favorites = ref.read(favoritesProvider).valueOrNull ?? const [];
    final isFavorite = favorites.any((item) => item.id == listing.id);
    await ref.read(repositoryProvider).setFavorite(listing.id, !isFavorite);
    ref.invalidate(favoritesProvider);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          isFavorite ? 'Dihapus dari favorit.' : 'Disimpan ke favorit.',
        ),
      ),
    );
  }

  Future<void> _openChat(Listing listing) async {
    if (_openingChat) return;
    setState(() => _openingChat = true);
    try {
      final conversation =
          await ref.read(repositoryProvider).openConversation(listing.id);
      ref.invalidate(conversationsProvider);
      if (!mounted) return;
      context.push('/chat/${conversation.id}');
    } finally {
      if (mounted) setState(() => _openingChat = false);
    }
  }

  Future<void> _copyLink(Listing listing) async {
    await Clipboard.setData(
      ClipboardData(text: 'https://c2cnearby.id/posting/${listing.id}'),
    );
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Tautan posting disalin.')),
    );
  }

  @override
  Widget build(BuildContext context) {
    final asyncListing = ref.watch(listingDetailProvider(widget.listingId));
    return asyncListing.when(
      loading: () => Scaffold(
        appBar: AppBar(),
        body: const Center(child: CircularProgressIndicator()),
      ),
      error: (_, _) => Scaffold(
        appBar: AppBar(),
        body: ErrorState(
          message: 'Tidak dapat memuat detail posting.',
          onRetry: () =>
              ref.invalidate(listingDetailProvider(widget.listingId)),
        ),
      ),
      data: (listing) {
        if (listing == null) {
          return Scaffold(
            appBar: AppBar(),
            body: const EmptyState(
              icon: Icons.search_off_rounded,
              title: 'Posting tidak ditemukan',
              message: 'Posting mungkin sudah dihapus atau kedaluwarsa.',
            ),
          );
        }
        final favorites = ref.watch(favoritesProvider).valueOrNull ?? const [];
        final isFavorite = favorites.any((item) => item.id == listing.id);
        return Scaffold(
          body: CustomScrollView(
            slivers: [
              _GalleryAppBar(
                listing: listing,
                isFavorite: isFavorite,
                onFavorite: () => _toggleFavorite(listing),
                onShare: () => _copyLink(listing),
              ),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 18, 20, 32),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          SoftPill(
                            label: listing.type.label,
                            icon: postTypeIcon(listing.type),
                            color: Theme.of(context).colorScheme.primary,
                            background: Color.alphaBlend(
                              Theme.of(context)
                                  .colorScheme
                                  .primary
                                  .withValues(alpha: 0.10),
                              Theme.of(context).colorScheme.surface,
                            ),
                          ),
                          const SizedBox(width: 8),
                          SoftPill(
                            label: listing.categoryName,
                            icon: categoryIcon(listing.categorySlug),
                          ),
                          const Spacer(),
                          Text(
                            timeAgo(listing.publishedAt),
                            style: Theme.of(context).textTheme.labelSmall,
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Text(
                        listing.title,
                        style: Theme.of(context).textTheme.headlineSmall,
                      ),
                      const SizedBox(height: 12),
                      if (listing.type == PostType.sell) ...[
                        _PriceRow(listing: listing),
                        const SizedBox(height: 14),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            if (listing.condition != null)
                              SoftPill(
                                label: 'Kondisi ${listing.condition!.label}',
                                icon: Icons.inventory_2_outlined,
                              ),
                            if (listing.brand != null)
                              SoftPill(
                                label: listing.brand!,
                                icon: Icons.sell_outlined,
                              ),
                            SoftPill(
                              label: formatDistance(listing.distanceMeters),
                              icon: Icons.near_me_outlined,
                            ),
                            SoftPill(
                              label: listing.areaLabel,
                              icon: Icons.place_outlined,
                            ),
                          ],
                        ),
                        const SizedBox(height: 22),
                        _SellerCard(seller: listing.seller),
                      ] else if (listing.type == PostType.event) ...[
                        _EventInfoCard(
                          listing: listing,
                          interested: _interested,
                          onToggle: () {
                            setState(() => _interested = !_interested);
                            if (_interested) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text(
                                    'Anda akan mendapat pengingat event ini.',
                                  ),
                                ),
                              );
                            }
                          },
                        ),
                        const SizedBox(height: 18),
                        _SellerCard(seller: listing.seller),
                      ] else ...[
                        _InformationMeta(listing: listing),
                        const SizedBox(height: 18),
                        _SellerCard(seller: listing.seller),
                      ],
                      const SizedBox(height: 24),
                      Text(
                        listing.type == PostType.information
                            ? 'Isi informasi'
                            : 'Deskripsi',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        listing.description,
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                      if (listing.informationLink != null) ...[
                        const SizedBox(height: 12),
                        InkWell(
                          onTap: () {
                            Clipboard.setData(
                              ClipboardData(text: listing.informationLink!),
                            );
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text('Tautan referensi disalin.'),
                              ),
                            );
                          },
                          borderRadius: BorderRadius.circular(10),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(vertical: 6),
                            child: Row(
                              children: [
                                Icon(
                                  Icons.link_rounded,
                                  size: 18,
                                  color: Theme.of(context).colorScheme.primary,
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    listing.informationLink!,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      color:
                                          Theme.of(context).colorScheme.primary,
                                      fontWeight: FontWeight.w600,
                                      fontSize: 12.5,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                      if (listing.type != PostType.information) ...[
                        const SizedBox(height: 26),
                        _SafetyNote(type: listing.type),
                      ],
                      const SizedBox(height: 26),
                      _OtherListings(
                        sellerId: listing.seller.id,
                        sellerName: listing.seller.displayName,
                        excludeId: listing.id,
                      ),
                      const SizedBox(height: 12),
                    ],
                  ),
                ),
              ),
            ],
          ),
          bottomNavigationBar: _DetailActionBar(
            listing: listing,
            isFavorite: isFavorite,
            joining: _openingChat,
            interested: _interested,
            onFavorite: () => _toggleFavorite(listing),
            onChat: () => _openChat(listing),
            onShare: () => _copyLink(listing),
            onInterested: () {
              setState(() => _interested = !_interested);
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(
                    _interested
                        ? 'Ditandai tertarik. Kami ingatkan sebelum event dimulai.'
                        : 'Minat pada event dibatalkan.',
                  ),
                ),
              );
            },
          ),
        );
      },
    );
  }
}

class _GalleryAppBar extends StatefulWidget {
  const _GalleryAppBar({
    required this.listing,
    required this.isFavorite,
    required this.onFavorite,
    required this.onShare,
  });

  final Listing listing;
  final bool isFavorite;
  final VoidCallback onFavorite;
  final VoidCallback onShare;

  @override
  State<_GalleryAppBar> createState() => _GalleryAppBarState();
}

class _GalleryAppBarState extends State<_GalleryAppBar> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final images = widget.listing.images;
    final height = (MediaQuery.sizeOf(context).width * 0.92).clamp(280.0, 430.0);
    final surface = Theme.of(context).colorScheme.surface;
    return SliverAppBar(
      expandedHeight: height,
      pinned: true,
      stretch: true,
      backgroundColor: surface,
      surfaceTintColor: Colors.transparent,
      leadingWidth: 64,
      leading: Padding(
        padding: const EdgeInsets.only(left: 14),
        child: _CircleAction(
          icon: Icons.arrow_back_rounded,
          onTap: () => context.pop(),
        ),
      ),
      actions: [
        _CircleAction(
          icon: widget.isFavorite
              ? Icons.favorite_rounded
              : Icons.favorite_border_rounded,
          color: widget.isFavorite ? AppPalette.of(context).favorite : null,
          onTap: widget.onFavorite,
        ),
        const SizedBox(width: 8),
        _CircleAction(icon: Icons.share_outlined, onTap: widget.onShare),
        const SizedBox(width: 14),
      ],
      flexibleSpace: FlexibleSpaceBar(
        background: Stack(
          fit: StackFit.expand,
          children: [
            if (images.isEmpty)
              Container(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [AppColors.navy, AppColors.electric],
                  ),
                ),
                child: Center(
                  child: Icon(
                    postTypeIcon(widget.listing.type),
                    color: Colors.white.withValues(alpha: 0.7),
                    size: 64,
                  ),
                ),
              )
            else
              PageView.builder(
                itemCount: images.length,
                onPageChanged: (value) => setState(() => _index = value),
                itemBuilder: (context, index) => SmartImage(
                  url: images[index].url,
                  icon: categoryIcon(widget.listing.categorySlug),
                ),
              ),
            if (images.length > 1)
              Positioned(
                bottom: 16,
                left: 0,
                right: 0,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    for (var i = 0; i < images.length; i++)
                      AnimatedContainer(
                        duration: const Duration(milliseconds: 160),
                        margin: const EdgeInsets.symmetric(horizontal: 3),
                        width: i == _index ? 18 : 6,
                        height: 6,
                        decoration: BoxDecoration(
                          color: i == _index
                              ? Colors.white
                              : Colors.white.withValues(alpha: 0.45),
                          borderRadius: BorderRadius.circular(100),
                        ),
                      ),
                  ],
                ),
              ),
            if (images.length > 1)
              Positioned(
                right: 14,
                bottom: 14,
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.5),
                    borderRadius: BorderRadius.circular(100),
                  ),
                  child: Text(
                    '${_index + 1}/${images.length}',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _CircleAction extends StatelessWidget {
  const _CircleAction({required this.icon, required this.onTap, this.color});

  final IconData icon;
  final VoidCallback onTap;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Material(
        color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.94),
        shape: const CircleBorder(),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(9),
            child: Icon(
              icon,
              size: 20,
              color: color ?? Theme.of(context).colorScheme.onSurface,
            ),
          ),
        ),
      ),
    );
  }
}

class _PriceRow extends StatelessWidget {
  const _PriceRow({required this.listing});

  final Listing listing;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Flexible(
          child: Text(
            formatRupiah(listing.price),
            style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                  color: Theme.of(context).colorScheme.primary,
                ),
          ),
        ),
        const SizedBox(width: 10),
        Padding(
          padding: const EdgeInsets.only(bottom: 4),
          child: Text(
            listing.priceType?.label ?? '',
            style: Theme.of(context).textTheme.labelSmall,
          ),
        ),
      ],
    );
  }
}

class _SellerCard extends StatelessWidget {
  const _SellerCard({required this.seller});

  final Seller seller;

  @override
  Widget build(BuildContext context) {
    final palette = AppPalette.of(context);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            AppAvatar(
              imageUrl: seller.avatarUrl,
              name: seller.displayName,
              size: 48,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          seller.displayName,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.titleSmall,
                        ),
                      ),
                      if (seller.isVerified) ...[
                        const SizedBox(width: 5),
                        const VerifiedBadge(compact: true),
                      ],
                    ],
                  ),
                  const SizedBox(height: 3),
                  Row(
                    children: [
                      StarRating(
                        rating: seller.rating,
                        count: seller.reviewCount,
                      ),
                      const SizedBox(width: 8),
                      Flexible(
                        child: Text(
                          '· ${seller.areaLabel}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                                color: palette.subtleText,
                              ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  '${seller.listingCount}',
                  style: Theme.of(context).textTheme.titleSmall,
                ),
                Text(
                  'posting',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: palette.subtleText,
                      ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _EventInfoCard extends StatelessWidget {
  const _EventInfoCard({
    required this.listing,
    required this.interested,
    required this.onToggle,
  });

  final Listing listing;
  final bool interested;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    final palette = AppPalette.of(context);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Color.alphaBlend(
          primary.withValues(alpha: 0.06),
          Theme.of(context).colorScheme.surface,
        ),
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
        border: Border.all(color: palette.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(9),
                decoration: BoxDecoration(
                  color: primary.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(Icons.event_available_outlined,
                    color: primary, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      listing.eventIsFree
                          ? 'Gratis'
                          : formatRupiah(listing.price),
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            color: primary,
                          ),
                    ),
                    Text(
                      'Biaya dibayar langsung di lokasi',
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: palette.subtleText,
                          ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          InfoRow(
            icon: Icons.calendar_today_outlined,
            label: 'Tanggal',
            value: listing.eventStart == null
                ? 'Menyusul'
                : formatEventRange(listing.eventStart!, listing.eventEnd),
          ),
          const SizedBox(height: 10),
          InfoRow(
            icon: Icons.place_outlined,
            label: 'Lokasi',
            value: listing.eventLocation ?? listing.areaLabel,
          ),
          const SizedBox(height: 10),
          InfoRow(
            icon: Icons.groups_outlined,
            label: 'Peserta',
            value: '${listing.participantCount + (interested ? 1 : 0)} tertarik',
          ),
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: interested
                ? FilledButton.tonalIcon(
                    onPressed: onToggle,
                    icon: const Icon(Icons.check_rounded, size: 18),
                    label: const Text('Anda tertarik'),
                  )
                : OutlinedButton.icon(
                    onPressed: onToggle,
                    icon: const Icon(Icons.star_border_rounded, size: 18),
                    label: const Text('Tandai tertarik'),
                  ),
          ),
        ],
      ),
    );
  }
}

class _InformationMeta extends StatelessWidget {
  const _InformationMeta({required this.listing});

  final Listing listing;

  @override
  Widget build(BuildContext context) {
    final palette = AppPalette.of(context);
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: palette.chipBackground,
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
      ),
      child: Column(
        children: [
          InfoRow(
            icon: Icons.place_outlined,
            label: 'Area terkait',
            value: listing.areaLabel,
          ),
          const SizedBox(height: 10),
          InfoRow(
            icon: Icons.schedule_outlined,
            label: 'Dipublikasikan',
            value: formatShortDate(listing.publishedAt),
          ),
          const SizedBox(height: 10),
          InfoRow(
            icon: Icons.visibility_outlined,
            label: 'Dilihat',
            value: '${listing.viewCount + 42} kali',
          ),
        ],
      ),
    );
  }
}

class _SafetyNote extends StatelessWidget {
  const _SafetyNote({required this.type});

  final PostType type;

  @override
  Widget build(BuildContext context) {
    final palette = AppPalette.of(context);
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: palette.chipBackground,
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.shield_outlined, size: 20, color: palette.mutedText),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Transaksi aman',
                  style: Theme.of(context).textTheme.titleSmall,
                ),
                const SizedBox(height: 3),
                Text(
                  type == PostType.event
                      ? 'Bertemu di lokasi publik yang ramai. Platform tidak memproses pembayaran tiket.'
                      : 'Bertemu di tempat publik, periksa barang sebelum membayar, dan bayar langsung kepada penjual. Platform tidak memproses pembayaran.',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _OtherListings extends ConsumerWidget {
  const _OtherListings({
    required this.sellerId,
    required this.sellerName,
    required this.excludeId,
  });

  final String sellerId;
  final String sellerName;
  final String excludeId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(sellerListingsProvider(sellerId));
    return async.maybeWhen(
      data: (items) {
        final others =
            items.where((item) => item.id != excludeId).take(6).toList();
        if (others.isEmpty) return const SizedBox.shrink();
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SectionHeader(
              title: 'Posting lain dari $sellerName',
              subtitle: 'Barang lain di sekitar Anda',
            ),
            const SizedBox(height: 10),
            SizedBox(
              height: 214,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: others.length,
                separatorBuilder: (_, _) => const SizedBox(width: 10),
                itemBuilder: (context, index) {
                  final listing = others[index];
                  return SizedBox(
                    width: 148,
                    child: Card(
                      clipBehavior: Clip.antiAlias,
                      child: InkWell(
                        onTap: () => context.push('/posting/${listing.id}'),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            AspectRatio(
                              aspectRatio: 1,
                              child: SmartImage(
                                url: listing.images.isEmpty
                                    ? null
                                    : listing.images.first.thumbUrl,
                                icon: categoryIcon(listing.categorySlug),
                              ),
                            ),
                            Padding(
                              padding: const EdgeInsets.all(9),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    listing.title,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: Theme.of(context)
                                        .textTheme
                                        .labelMedium
                                        ?.copyWith(height: 1.25),
                                  ),
                                  const SizedBox(height: 3),
                                  Text(
                                    formatRupiah(listing.price),
                                    maxLines: 1,
                                    style: Theme.of(context)
                                        .textTheme
                                        .labelSmall
                                        ?.copyWith(
                                          color: Theme.of(context)
                                              .colorScheme
                                              .primary,
                                          fontWeight: FontWeight.w700,
                                        ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        );
      },
      orElse: () => const SizedBox.shrink(),
    );
  }
}

class _DetailActionBar extends StatelessWidget {
  const _DetailActionBar({
    required this.listing,
    required this.isFavorite,
    required this.joining,
    required this.interested,
    required this.onFavorite,
    required this.onChat,
    required this.onShare,
    required this.onInterested,
  });

  final Listing listing;
  final bool isFavorite;
  final bool joining;
  final bool interested;
  final VoidCallback onFavorite;
  final VoidCallback onChat;
  final VoidCallback onShare;
  final VoidCallback onInterested;

  @override
  Widget build(BuildContext context) {
    final palette = AppPalette.of(context);
    return Container(
      padding: EdgeInsets.fromLTRB(
        18,
        12,
        18,
        12 + MediaQuery.paddingOf(context).bottom,
      ),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        border: Border(top: BorderSide(color: palette.border)),
      ),
      child: Row(
        children: [
          if (listing.type == PostType.sell)
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    formatRupiah(listing.price),
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          color: Theme.of(context).colorScheme.primary,
                        ),
                  ),
                  Text(
                    listing.priceType?.label ?? '',
                    style: Theme.of(context).textTheme.labelSmall,
                  ),
                ],
              ),
            )
          else
            Expanded(
              child: Text(
                listing.type == PostType.event
                    ? 'Tertarik dengan event ini?'
                    : 'Simpan informasi ini',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ),
          if (listing.type == PostType.information) ...[
            OutlinedButton.icon(
              onPressed: onShare,
              icon: const Icon(Icons.share_outlined, size: 17),
              label: const Text('Bagikan'),
            ),
            const SizedBox(width: 8),
            FilledButton.icon(
              onPressed: onFavorite,
              icon: Icon(
                isFavorite
                    ? Icons.bookmark_rounded
                    : Icons.bookmark_border_rounded,
                size: 18,
              ),
              label: Text(isFavorite ? 'Tersimpan' : 'Simpan'),
            ),
          ] else if (listing.type == PostType.event)
            FilledButton.icon(
              onPressed: onInterested,
              icon: Icon(
                interested ? Icons.check_rounded : Icons.star_border_rounded,
                size: 18,
              ),
              label: Text(interested ? 'Tertarik' : 'Tandai tertarik'),
            )
          else
            FilledButton.icon(
              onPressed: joining ? null : onChat,
              icon: joining
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Icon(Icons.chat_bubble_outline_rounded, size: 18),
              label: Text(joining ? 'Membuka…' : 'Chat Penjual'),
            ),
        ],
      ),
    );
  }
}
