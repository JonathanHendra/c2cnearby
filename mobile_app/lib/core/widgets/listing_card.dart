import 'package:flutter/material.dart';

import '../../app/theme/app_theme.dart';
import '../../data/models/models.dart';
import '../utils/format.dart';
import 'common_widgets.dart';
import 'smart_image.dart';

class ListingCard extends StatelessWidget {
  const ListingCard({
    super.key,
    required this.listing,
    required this.onTap,
    required this.isFavorite,
    required this.onFavorite,
  });

  final Listing listing;
  final VoidCallback onTap;
  final bool isFavorite;
  final VoidCallback onFavorite;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final palette = AppPalette.of(context);
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AspectRatio(
              aspectRatio: 1,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  SmartImage(
                    url: listing.images.isNotEmpty
                        ? listing.images.first.thumbUrl
                        : null,
                    icon: categoryIcon(listing.categorySlug),
                  ),
                  Positioned(
                    left: 8,
                    bottom: 8,
                    child: listing.type == PostType.sell
                        ? DistancePill(meters: listing.distanceMeters)
                        : SoftPill(
                            label: listing.type.label,
                            icon: postTypeIcon(listing.type),
                            color: Colors.white,
                            background: Colors.black.withValues(alpha: 0.6),
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 5,
                            ),
                          ),
                  ),
                  Positioned(
                    top: 6,
                    right: 6,
                    child: _FavoriteButton(
                      active: isFavorite,
                      onTap: onFavorite,
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    listing.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: textTheme.titleSmall?.copyWith(height: 1.3),
                  ),
                  const SizedBox(height: 6),
                  if (listing.type == PostType.sell) ...[
                    Text(
                      formatRupiah(listing.price),
                      style: textTheme.titleMedium?.copyWith(
                        color: Theme.of(context).colorScheme.primary,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      [
                        if (listing.condition != null) listing.condition!.label,
                        timeAgo(listing.publishedAt),
                      ].join(' · '),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: textTheme.labelSmall?.copyWith(
                        color: palette.subtleText,
                      ),
                    ),
                  ] else if (listing.type == PostType.event) ...[
                    Row(
                      children: [
                        Icon(
                          Icons.calendar_today_outlined,
                          size: 12,
                          color: Theme.of(context).colorScheme.primary,
                        ),
                        const SizedBox(width: 5),
                        Expanded(
                          child: Text(
                            listing.eventStart == null
                                ? 'Jadwal menyusul'
                                : formatShortDate(listing.eventStart!),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: textTheme.labelSmall?.copyWith(
                              color: Theme.of(context).colorScheme.primary,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 3),
                    Text(
                      listing.eventIsFree
                          ? 'Gratis · ${listing.participantCount} tertarik'
                          : '${formatRupiah(listing.price)} · ${listing.participantCount} tertarik',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: textTheme.labelSmall?.copyWith(
                        color: palette.subtleText,
                      ),
                    ),
                  ] else ...[
                    SoftPill(
                      label: listing.categoryName,
                      icon: Icons.sell_outlined,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                    ),
                    const SizedBox(height: 5),
                    Text(
                      '${timeAgo(listing.publishedAt)} · ${listing.areaLabel}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: textTheme.labelSmall?.copyWith(
                        color: palette.subtleText,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FavoriteButton extends StatelessWidget {
  const _FavoriteButton({required this.active, required this.onTap});

  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.92),
      shape: const CircleBorder(),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(6),
          child: Icon(
            active ? Icons.favorite_rounded : Icons.favorite_border_rounded,
            size: 17,
            color: active
                ? AppPalette.of(context).favorite
                : AppPalette.of(context).mutedText,
          ),
        ),
      ),
    );
  }
}
