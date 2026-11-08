import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/providers.dart';
import '../../app/theme/app_theme.dart';
import '../../core/widgets/common_widgets.dart';

class ProfilePage extends ConsumerWidget {
  const ProfilePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    final session = ref.watch(authProvider);
    final signedIn = session.isSignedIn;
    final needsOnboarding = signedIn && !session.onboardingComplete;
    final palette = AppPalette.of(context);
    return Scaffold(
      body: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: Container(
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [AppColors.navy, AppColors.navyMid],
                ),
                borderRadius: BorderRadius.vertical(
                  bottom: Radius.circular(28),
                ),
              ),
              padding: EdgeInsets.fromLTRB(
                20,
                MediaQuery.paddingOf(context).top + 10,
                20,
                34,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Text(
                        'Profil',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 20,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const Spacer(),
                      _HeaderAction(
                        icon: Icons.settings_outlined,
                        onTap: () => context.push('/profil/pengaturan'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 18),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      AppAvatar(
                        imageUrl: user.avatarUrl,
                        name: user.displayName,
                        size: 72,
                        showRing: true,
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              user.displayName,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 19,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              signedIn
                                  ? '@${user.username} · ${user.areaLabel}'
                                  : 'Masuk untuk mulai berjualan di sekitar Anda',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                color: Colors.white.withValues(alpha: 0.7),
                                fontSize: 11.5,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Wrap(
                              spacing: 6,
                              runSpacing: 6,
                              children: [
                                _StatusChip(
                                  label: signedIn ? 'Google' : 'Belum masuk',
                                  icon: Icons.g_mobiledata_rounded,
                                  active: signedIn,
                                ),
                                _StatusChip(
                                  label: 'Telepon',
                                  icon: Icons.phone_android_rounded,
                                  active: user.phoneVerified,
                                ),
                                _StatusChip(
                                  label: 'Wajah',
                                  icon: Icons.face_retouching_natural_rounded,
                                  active: user.faceVerified,
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 18),
                  Row(
                    children: [
                      const Icon(Icons.star_rounded,
                          color: AppColors.star, size: 18),
                      const SizedBox(width: 4),
                      Text(
                        user.rating.toStringAsFixed(1).replaceAll('.', ','),
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                          fontSize: 13,
                        ),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        signedIn
                            ? '· ${user.reviewCount} ulasan · bergabung ${user.joinedAt.year}'
                            : '· ${user.reviewCount} ulasan',
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.65),
                          fontSize: 11,
                        ),
                      ),
                      const Spacer(),
                      OutlinedButton(
                        onPressed: () => context.push(
                          signedIn ? '/profil/edit' : '/masuk',
                        ),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: Colors.white,
                          side: BorderSide(
                            color: Colors.white.withValues(alpha: 0.35),
                          ),
                          minimumSize: const Size(0, 36),
                          padding: const EdgeInsets.symmetric(horizontal: 14),
                          textStyle: const TextStyle(
                            fontSize: 11.5,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        child: Text(signedIn ? 'Edit profil' : 'Masuk'),
                      ),
                    ],
                  ),
                  if (needsOnboarding) ...[
                    const SizedBox(height: 12),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton.tonalIcon(
                        onPressed: () => context.push('/onboarding'),
                        icon: const Icon(Icons.verified_user_outlined, size: 18),
                        label: const Text('Lengkapi profil & verifikasi'),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: Transform.translate(
              offset: const Offset(0, -18),
              child: Container(
                margin: const EdgeInsets.symmetric(horizontal: 20),
                padding: const EdgeInsets.symmetric(vertical: 16),
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.surface,
                  borderRadius: BorderRadius.circular(AppTheme.radiusLg),
                  border: Border.all(color: palette.border),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.05),
                      blurRadius: 18,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    _Stat(label: 'Posting', value: '${user.listingCount}'),
                    _StatDivider(),
                    _Stat(label: 'Favorit', value: '${user.favoriteCount}'),
                    _StatDivider(),
                    _Stat(
                      label: 'Rating',
                      value: user.rating.toStringAsFixed(1).replaceAll('.', ','),
                    ),
                  ],
                ),
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 28),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _MenuSection(
                    title: 'Aktivitas',
                    items: [
                      _MenuItem(
                        icon: Icons.sell_outlined,
                        title: 'Posting Saya',
                        subtitle: 'Kelola posting aktif, draft, dan terjual',
                        onTap: () => context.push('/profil/postingan'),
                      ),
                      _MenuItem(
                        icon: Icons.favorite_border_rounded,
                        title: 'Favorit',
                        onTap: () => context.go('/favorit'),
                      ),
                      _MenuItem(
                        icon: Icons.chat_bubble_outline_rounded,
                        title: 'Riwayat Chat',
                        onTap: () => context.go('/chat'),
                      ),
                      _MenuItem(
                        icon: Icons.handshake_outlined,
                        title: 'Riwayat Kesepakatan',
                        onTap: () => context.push('/profil/kesepakatan'),
                      ),
                      _MenuItem(
                        icon: Icons.star_border_rounded,
                        title: 'Ulasan Saya',
                        trailing: '${user.reviewCount}',
                        onTap: () => context.push('/profil/ulasan'),
                      ),
                    ],
                  ),
                  _MenuSection(
                    title: 'Akun & keamanan',
                    items: [
                      _MenuItem(
                        icon: Icons.verified_user_outlined,
                        title: 'Verifikasi Akun',
                        subtitle: user.faceVerified
                            ? 'Akun terverifikasi penuh'
                            : 'Lengkapi verifikasi wajah',
                        onTap: () => context.push('/profil/verifikasi'),
                      ),
                      _MenuItem(
                        icon: Icons.manage_accounts_outlined,
                        title: 'Pengaturan Akun',
                        onTap: () => context.push('/profil/pengaturan'),
                      ),
                      _MenuItem(
                        icon: Icons.privacy_tip_outlined,
                        title: 'Privasi dan Keamanan',
                        onTap: () => context.push('/profil/privasi'),
                      ),
                    ],
                  ),
                  _MenuSection(
                    title: 'Bantuan',
                    items: [
                      _MenuItem(
                        icon: Icons.help_outline_rounded,
                        title: 'Bantuan',
                        onTap: () => context.push('/profil/bantuan'),
                      ),
                      _MenuItem(
                        icon: Icons.description_outlined,
                        title: 'Syarat dan Ketentuan',
                        onTap: () => context.push('/profil/syarat'),
                      ),
                      _MenuItem(
                        icon: Icons.policy_outlined,
                        title: 'Kebijakan Privasi',
                        onTap: () => context.push('/profil/privasi'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: () => _confirmLogout(context),
                      icon: const Icon(Icons.logout_rounded, size: 18),
                      label: const Text('Keluar'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.danger,
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),
                  Center(
                    child: Text(
                      'C2C Nearby v0.1.0 · Fase 1 (UI dengan data mock)',
                      style: Theme.of(context).textTheme.labelSmall,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _confirmLogout(BuildContext context) async {
    await showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Keluar dari akun?'),
        content: const Text(
          'Autentikasi Firebase aktif pada Fase 3. Pada versi UI ini keluar '
          'belum memengaruhi sesi nyata.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Batal'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Mengerti'),
          ),
        ],
      ),
    );
  }
}

class _HeaderAction extends StatelessWidget {
  const _HeaderAction({required this.icon, required this.onTap});

  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      onPressed: onTap,
      icon: Icon(icon, color: Colors.white, size: 21),
      style: IconButton.styleFrom(
        backgroundColor: Colors.white.withValues(alpha: 0.1),
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({
    required this.label,
    required this.icon,
    required this.active,
  });

  final String label;
  final IconData icon;
  final bool active;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: active ? 0.16 : 0.07),
        borderRadius: BorderRadius.circular(100),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            active ? Icons.check_circle_rounded : icon,
            size: 12,
            color: active ? const Color(0xFF7EE2A8) : Colors.white54,
          ),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              color: active ? Colors.white : Colors.white54,
              fontSize: 9.5,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Text(value, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 2),
          Text(label, style: Theme.of(context).textTheme.labelSmall),
        ],
      ),
    );
  }
}

class _StatDivider extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      width: 1,
      height: 28,
      color: AppPalette.of(context).border,
    );
  }
}

class _MenuSection extends StatelessWidget {
  const _MenuSection({required this.title, required this.items});

  final String title;
  final List<_MenuItem> items;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(left: 4, bottom: 8),
            child: Text(title, style: Theme.of(context).textTheme.labelMedium),
          ),
          Card(
            clipBehavior: Clip.antiAlias,
            child: Column(
              children: [
                for (var index = 0; index < items.length; index++) ...[
                  if (index > 0)
                    Divider(
                      height: 1,
                      indent: 58,
                      color: AppPalette.of(context).border,
                    ),
                  items[index],
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _MenuItem extends StatelessWidget {
  const _MenuItem({
    required this.icon,
    required this.title,
    required this.onTap,
    this.subtitle,
    this.trailing,
  });

  final IconData icon;
  final String title;
  final String? subtitle;
  final String? trailing;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final palette = AppPalette.of(context);
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        child: Row(
          children: [
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: palette.chipBackground,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, size: 17, color: palette.mutedText),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: Theme.of(context).textTheme.labelMedium),
                  if (subtitle != null) ...[
                    const SizedBox(height: 1),
                    Text(subtitle!,
                        style: Theme.of(context).textTheme.labelSmall),
                  ],
                ],
              ),
            ),
            if (trailing != null)
              Padding(
                padding: const EdgeInsets.only(right: 4),
                child: Text(trailing!,
                    style: Theme.of(context).textTheme.labelSmall),
              ),
            Icon(Icons.chevron_right_rounded, size: 18, color: palette.subtleText),
          ],
        ),
      ),
    );
  }
}
