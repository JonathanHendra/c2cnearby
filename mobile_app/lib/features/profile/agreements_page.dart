import 'package:flutter/material.dart';

import '../../app/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../core/widgets/common_widgets.dart';
import '../../core/widgets/smart_image.dart';

class AgreementsPage extends StatefulWidget {
  const AgreementsPage({super.key});

  @override
  State<AgreementsPage> createState() => _AgreementsPageState();
}

class _AgreementItem {
  _AgreementItem({
    required this.id,
    required this.listingTitle,
    required this.imageUrl,
    required this.otherName,
    required this.otherAvatar,
    required this.price,
    required this.meetup,
    required this.meetupAt,
    required this.status,
    required this.myConfirmed,
    required this.otherConfirmed,
  });

  final String id;
  final String listingTitle;
  final String imageUrl;
  final String otherName;
  final String otherAvatar;
  final int price;
  final String meetup;
  final DateTime meetupAt;
  String status;
  bool myConfirmed;
  bool otherConfirmed;
}

class _AgreementsPageState extends State<AgreementsPage> {
  final List<_AgreementItem> _items = [
    _AgreementItem(
      id: 'a1',
      listingTitle: 'iPhone 13 Pro 128GB Pacific Blue',
      imageUrl:
          'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=200&q=70',
      otherName: 'Budi Santoso',
      otherAvatar: 'https://i.pravatar.cc/120?img=13',
      price: 7000000,
      meetup: 'Lobby Senopati City',
      meetupAt: DateTime.now().add(const Duration(days: 1, hours: 3)),
      status: 'meetup_scheduled',
      myConfirmed: false,
      otherConfirmed: false,
    ),
    _AgreementItem(
      id: 'a2',
      listingTitle: 'Sony WH-1000XM4 Hitam',
      imageUrl:
          'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=200&q=70',
      otherName: 'Maya Lestari',
      otherAvatar: 'https://i.pravatar.cc/120?img=32',
      price: 3000000,
      meetup: 'Taman Kemang, pintu barat',
      meetupAt: DateTime.now().subtract(const Duration(days: 2)),
      status: 'completed',
      myConfirmed: true,
      otherConfirmed: true,
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Riwayat Kesepakatan')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
        children: [
          Container(
            padding: const EdgeInsets.all(13),
            decoration: BoxDecoration(
              color: AppPalette.of(context).chipBackground,
              borderRadius: BorderRadius.circular(AppTheme.radiusMd),
            ),
            child: Row(
              children: [
                Icon(Icons.handshake_outlined,
                    size: 19, color: AppPalette.of(context).mutedText),
                const SizedBox(width: 9),
                Expanded(
                  child: Text(
                    'Transaksi selesai hanya jika kedua pihak mengonfirmasi. '
                    'Satu konfirmasi tidak cukup.',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          for (final item in _items) ...[
            _AgreementCard(
              item: item,
              onToggleConfirmation: () {
                setState(() {
                  item.myConfirmed = !item.myConfirmed;
                  if (item.myConfirmed && item.otherConfirmed) {
                    item.status = 'completed';
                  } else if (item.myConfirmed) {
                    item.status = 'meetup_scheduled';
                  } else {
                    item.status = 'agreed';
                  }
                });
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(
                      item.myConfirmed
                          ? item.otherConfirmed
                              ? 'Kedua pihak mengonfirmasi. Transaksi selesai.'
                              : 'Konfirmasi Anda tersimpan. Menunggu konfirmasi pihak lain.'
                          : 'Konfirmasi dibatalkan.',
                    ),
                  ),
                );
              },
            ),
            const SizedBox(height: 10),
          ],
          const SizedBox(height: 6),
          Text(
            'Data kesepakatan pada layar ini adalah contoh Fase 1. Persetujuan '
            'terstruktur, meetup, dan konfirmasi dua pihak dihubungkan ke API pada Fase 5.',
            style: Theme.of(context).textTheme.labelSmall,
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

class _AgreementCard extends StatelessWidget {
  const _AgreementCard({required this.item, required this.onToggleConfirmation});

  final _AgreementItem item;
  final VoidCallback onToggleConfirmation;

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    final palette = AppPalette.of(context);
    final completed = item.status == 'completed';
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: SmartImage(url: item.imageUrl, width: 56, height: 56),
                ),
                const SizedBox(width: 11),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item.listingTitle,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.titleSmall,
                      ),
                      const SizedBox(height: 3),
                      Text(
                        formatRupiah(item.price),
                        style: Theme.of(context).textTheme.labelMedium?.copyWith(
                              color: primary,
                            ),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: (completed ? AppColors.success : AppColors.warning)
                        .withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(100),
                  ),
                  child: Text(
                    completed ? 'Selesai' : 'Menunggu konfirmasi',
                    style: TextStyle(
                      color: completed ? AppColors.success : AppColors.warning,
                      fontSize: 9,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                AppAvatar(
                  imageUrl: item.otherAvatar,
                  name: item.otherName,
                  size: 26,
                ),
                const SizedBox(width: 7),
                Expanded(
                  child: Text(
                    item.otherName,
                    style: Theme.of(context).textTheme.labelSmall,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            InfoRow(
              icon: Icons.place_outlined,
              label: 'Pertemuan',
              value: item.meetup,
            ),
            const SizedBox(height: 7),
            InfoRow(
              icon: Icons.schedule_outlined,
              label: 'Waktu',
              value: formatEventRange(item.meetupAt, null),
            ),
            const SizedBox(height: 7),
            InfoRow(
              icon: Icons.verified_outlined,
              label: 'Konfirmasi',
              value: '${item.myConfirmed ? "Anda ✓" : "Anda —"} · '
                  '${item.otherConfirmed ? "${item.otherName.split(" ").first} ✓" : "${item.otherName.split(" ").first} —"}',
            ),
            if (!completed) ...[
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: item.myConfirmed
                    ? OutlinedButton(
                        onPressed: onToggleConfirmation,
                        child: const Text('Batalkan konfirmasi'),
                      )
                    : FilledButton(
                        onPressed: onToggleConfirmation,
                        child: const Text('Konfirmasi transaksi selesai'),
                      ),
              ),
            ],
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(
                'Pembayaran dilakukan langsung. Platform tidak menahan dana.',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: palette.subtleText,
                    ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
