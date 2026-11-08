import 'package:flutter/material.dart';

import '../../app/theme/app_theme.dart';

class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.icon,
    required this.title,
    required this.message,
    this.actionLabel,
    this.onAction,
  });

  final IconData icon;
  final String title;
  final String message;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final palette = AppPalette.of(context);
    final textTheme = Theme.of(context).textTheme;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                color: palette.chipBackground,
                borderRadius: BorderRadius.circular(22),
              ),
              child: Icon(icon, size: 30, color: palette.mutedText),
            ),
            const SizedBox(height: 18),
            Text(title, textAlign: TextAlign.center, style: textTheme.titleMedium),
            const SizedBox(height: 6),
            Text(
              message,
              textAlign: TextAlign.center,
              style: textTheme.bodySmall,
            ),
            if (actionLabel != null) ...[
              const SizedBox(height: 18),
              FilledButton.tonal(
                onPressed: onAction,
                child: Text(actionLabel!),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class ErrorState extends StatelessWidget {
  const ErrorState({super.key, required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return EmptyState(
      icon: Icons.wifi_off_rounded,
      title: 'Koneksi terputus',
      message: message,
      actionLabel: 'Coba lagi',
      onAction: onRetry,
    );
  }
}

class SkeletonBox extends StatefulWidget {
  const SkeletonBox({
    super.key,
    this.width,
    this.height,
    this.radius = 10,
    this.shape = BoxShape.rectangle,
  });

  final double? width;
  final double? height;
  final double radius;
  final BoxShape shape;

  @override
  State<SkeletonBox> createState() => _SkeletonBoxState();
}

class _SkeletonBoxState extends State<SkeletonBox>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final base = AppPalette.of(context).chipBackground;
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        return Container(
          width: widget.width,
          height: widget.height,
          decoration: BoxDecoration(
            color: Color.lerp(base, AppPalette.of(context).border, _controller.value),
            shape: widget.shape,
            borderRadius: widget.shape == BoxShape.rectangle
                ? BorderRadius.circular(widget.radius)
                : null,
          ),
        );
      },
    );
  }
}

class ListingGridSkeleton extends StatelessWidget {
  const ListingGridSkeleton({super.key, this.count = 6});

  final int count;

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
      physics: const NeverScrollableScrollPhysics(),
      shrinkWrap: true,
      itemCount: count,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        mainAxisSpacing: 12,
        crossAxisSpacing: 12,
        childAspectRatio: 0.60,
      ),
      itemBuilder: (_, _) => const _CardSkeleton(),
    );
  }
}

class _CardSkeleton extends StatelessWidget {
  const _CardSkeleton();

  @override
  Widget build(BuildContext context) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const AspectRatio(aspectRatio: 1, child: SkeletonBox(radius: 0)),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SkeletonBox(height: 12),
                const SizedBox(height: 8),
                const SkeletonBox(height: 12, width: 100),
                const SizedBox(height: 10),
                SkeletonBox(height: 14, width: 80, radius: 6),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class InlineLoader extends StatelessWidget {
  const InlineLoader({super.key});

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.symmetric(vertical: 22),
      child: Center(
        child: SizedBox(
          width: 22,
          height: 22,
          child: CircularProgressIndicator(strokeWidth: 2.2),
        ),
      ),
    );
  }
}
