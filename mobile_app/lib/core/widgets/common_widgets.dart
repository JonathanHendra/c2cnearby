import 'package:flutter/material.dart';

import '../../app/theme/app_theme.dart';
import '../../data/models/models.dart';
import 'smart_image.dart';

IconData categoryIcon(String slug) {
  return switch (slug) {
    'elektronik' => Icons.devices_other_outlined,
    'handphone' => Icons.smartphone_outlined,
    'kendaraan' => Icons.two_wheeler_outlined,
    'fashion' => Icons.checkroom_outlined,
    'furnitur' => Icons.chair_outlined,
    'rumah-tangga' => Icons.blender_outlined,
    'hobi-olahraga' => Icons.sports_tennis_outlined,
    'perlengkapan-bayi' => Icons.child_friendly_outlined,
    'buku-pendidikan' => Icons.menu_book_outlined,
    'komunitas' => Icons.groups_outlined,
    'pasar-bazaar' => Icons.storefront_outlined,
    'workshop' => Icons.workspace_premium_outlined,
    'info-lingkungan' => Icons.eco_outlined,
    'keamanan' => Icons.shield_outlined,
    'info-komunitas' => Icons.campaign_outlined,
    _ => Icons.grid_view_outlined,
  };
}

IconData postTypeIcon(PostType type) => switch (type) {
      PostType.sell => Icons.sell_outlined,
      PostType.event => Icons.event_outlined,
      PostType.information => Icons.info_outline,
    };

class AppAvatar extends StatelessWidget {
  const AppAvatar({
    super.key,
    required this.imageUrl,
    required this.name,
    this.size = 44,
    this.showRing = false,
  });

  final String imageUrl;
  final String name;
  final double size;
  final bool showRing;

  @override
  Widget build(BuildContext context) {
    final avatar = ClipOval(
      child: SmartImage(
        url: imageUrl,
        width: size,
        height: size,
        icon: Icons.person_outline,
      ),
    );
    return Container(
      padding: EdgeInsets.all(showRing ? 2.5 : 0),
      decoration: showRing
          ? BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(
                color: Theme.of(context).colorScheme.primary,
                width: 1.5,
              ),
            )
          : null,
      child: avatar,
    );
  }
}

class VerifiedBadge extends StatelessWidget {
  const VerifiedBadge({super.key, this.compact = false});

  final bool compact;

  @override
  Widget build(BuildContext context) {
    final color = Theme.of(context).colorScheme.primary;
    if (compact) {
      return Icon(Icons.verified, size: 16, color: color);
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: Color.alphaBlend(
          color.withValues(alpha: 0.12),
          Theme.of(context).colorScheme.surface,
        ),
        borderRadius: BorderRadius.circular(100),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.verified, size: 13, color: color),
          const SizedBox(width: 4),
          Text(
            'Terverifikasi',
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: color,
                  fontWeight: FontWeight.w700,
                ),
          ),
        ],
      ),
    );
  }
}

class SectionHeader extends StatelessWidget {
  const SectionHeader({
    super.key,
    required this.title,
    this.subtitle,
    this.actionLabel,
    this.onAction,
  });

  final String title;
  final String? subtitle;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: textTheme.titleLarge),
              if (subtitle != null) ...[
                const SizedBox(height: 2),
                Text(subtitle!, style: textTheme.bodySmall),
              ],
            ],
          ),
        ),
        if (actionLabel != null)
          TextButton(
            onPressed: onAction,
            child: Text(actionLabel!),
          ),
      ],
    );
  }
}

class SoftPill extends StatelessWidget {
  const SoftPill({
    super.key,
    required this.label,
    this.icon,
    this.color,
    this.background,
    this.padding = const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
  });

  final String label;
  final IconData? icon;
  final Color? color;
  final Color? background;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    final palette = AppPalette.of(context);
    final fg = color ?? palette.mutedText;
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: background ?? palette.chipBackground,
        borderRadius: BorderRadius.circular(100),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 13, color: fg),
            const SizedBox(width: 5),
          ],
          Text(
            label,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: fg,
                  fontWeight: FontWeight.w600,
                ),
          ),
        ],
      ),
    );
  }
}

class DistancePill extends StatelessWidget {
  const DistancePill({super.key, required this.meters});

  final int meters;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.62),
        borderRadius: BorderRadius.circular(100),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.near_me_outlined, size: 11, color: Colors.white),
          const SizedBox(width: 3),
          Text(
            _label(meters),
            style: const TextStyle(
              color: Colors.white,
              fontSize: 10.5,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  String _label(int meters) {
    if (meters <= 0) return 'Dekat';
    if (meters < 1000) return '$meters m';
    return '${(meters / 1000).toStringAsFixed(meters >= 10000 ? 0 : 1).replaceAll('.', ',')} km';
  }
}

class StarRating extends StatelessWidget {
  const StarRating({
    super.key,
    required this.rating,
    this.count,
    this.size = 14,
  });

  final double rating;
  final int? count;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(Icons.star_rounded, size: size, color: AppColors.star),
        const SizedBox(width: 3),
        Text(
          rating.toStringAsFixed(1).replaceAll('.', ','),
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                fontWeight: FontWeight.w700,
              ),
        ),
        if (count != null) ...[
          const SizedBox(width: 2),
          Text(
            '($count)',
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: AppPalette.of(context).subtleText,
                ),
          ),
        ],
      ],
    );
  }
}

class InfoRow extends StatelessWidget {
  const InfoRow({
    super.key,
    required this.icon,
    required this.label,
    this.value,
  });

  final IconData icon;
  final String label;
  final String? value;

  @override
  Widget build(BuildContext context) {
    final palette = AppPalette.of(context);
    final textTheme = Theme.of(context).textTheme;
    return Row(
      children: [
        Icon(icon, size: 18, color: palette.subtleText),
        const SizedBox(width: 10),
        Text(label, style: textTheme.bodySmall),
        const Spacer(),
        if (value != null)
          Flexible(
            child: Text(
              value!,
              textAlign: TextAlign.right,
              style: textTheme.bodySmall?.copyWith(
                color: Theme.of(context).colorScheme.onSurface,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
      ],
    );
  }
}
