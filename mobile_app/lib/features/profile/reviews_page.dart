import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/providers.dart';
import '../../app/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../core/widgets/common_widgets.dart';
import '../../core/widgets/states.dart';

class ReviewsPage extends ConsumerWidget {
  const ReviewsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(reviewsProvider);
    final palette = AppPalette.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Ulasan Saya')),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, _) => ErrorState(
          message: 'Ulasan tidak dapat dimuat.',
          onRetry: () => ref.invalidate(reviewsProvider),
        ),
        data: (reviews) {
          if (reviews.isEmpty) {
            return const EmptyState(
              icon: Icons.star_border_rounded,
              title: 'Belum ada ulasan',
              message:
                  'Ulasan muncul setelah Anda menyelesaikan transaksi dan kedua '
                  'pihak mengonfirmasi.',
            );
          }
          return ListView(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
            children: [
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [AppColors.navy, AppColors.navyMid],
                  ),
                  borderRadius: BorderRadius.circular(AppTheme.radiusLg),
                ),
                child: Row(
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          ref.watch(currentUserProvider).rating
                              .toStringAsFixed(1)
                              .replaceAll('.', ','),
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 40,
                            fontWeight: FontWeight.w800,
                            height: 1,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Row(
                          children: [
                            for (var i = 0; i < 5; i++)
                              const Icon(Icons.star_rounded,
                                  size: 15, color: AppColors.star),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Text(
                          '${reviews.length + 20} ulasan dari warga sekitar',
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.65),
                            fontSize: 10.5,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(width: 22),
                    Expanded(
                      child: Column(
                        children: [
                          for (var star = 5; star >= 4; star--)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 6),
                              child: Row(
                                children: [
                                  Text(
                                    '$star',
                                    style: TextStyle(
                                      color: Colors.white.withValues(alpha: 0.7),
                                      fontSize: 10,
                                    ),
                                  ),
                                  const SizedBox(width: 5),
                                  Expanded(
                                    child: ClipRRect(
                                      borderRadius: BorderRadius.circular(100),
                                      child: LinearProgressIndicator(
                                        value: star == 5 ? 0.82 : 0.18,
                                        minHeight: 4,
                                        backgroundColor:
                                            Colors.white.withValues(alpha: 0.14),
                                        color: AppColors.star,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 18),
              Text(
                'Terbaru',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 10),
              for (final review in reviews) ...[
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            AppAvatar(
                              imageUrl: review.authorAvatar,
                              name: review.authorName,
                              size: 36,
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    review.authorName,
                                    style:
                                        Theme.of(context).textTheme.labelMedium,
                                  ),
                                  const SizedBox(height: 2),
                                  StarRating(
                                    rating: review.rating.toDouble(),
                                    size: 12,
                                  ),
                                ],
                              ),
                            ),
                            Text(
                              timeAgo(review.createdAt),
                              style: Theme.of(context).textTheme.labelSmall,
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        Text(
                          review.comment,
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                color: palette.mutedText,
                              ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 10),
              ],
              const SizedBox(height: 6),
              Text(
                'Ulasan hanya dapat diberikan setelah transaksi dikonfirmasi selesai '
                'oleh kedua pihak. Ulasan tidak dapat diubah setelah dikirim.',
                style: Theme.of(context).textTheme.labelSmall,
                textAlign: TextAlign.center,
              ),
            ],
          );
        },
      ),
    );
  }
}
