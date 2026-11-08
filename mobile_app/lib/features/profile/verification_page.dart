import 'package:flutter/material.dart';

import '../../app/theme/app_theme.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/providers.dart';

class VerificationPage extends ConsumerStatefulWidget {
  const VerificationPage({super.key});

  @override
  ConsumerState<VerificationPage> createState() => _VerificationPageState();
}

class _VerificationPageState extends ConsumerState<VerificationPage> {
  bool _faceConsent = false;
  bool _sessionPending = false;
  bool _cancelled = false;

  Future<void> _startFaceSession() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Persetujuan verifikasi wajah'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Verifikasi wajah membantu mencegah akun palsu dan penipuan. '
                  'Provider belum dipilih pada fase ini, sehingga sesi berjalan '
                  'sebagai simulasi pengembangan dan TIDAK menghasilkan '
                  'verifikasi resmi.',
                ),
                const SizedBox(height: 12),
                Text(
                  'Data biometrik diperlakukan sebagai data pribadi sangat '
                  'sensitif: selfie mentah tidak disimpan permanen oleh platform, '
                  'hanya referensi sesi dan status yang disimpan, dan akses '
                  'diaudit.',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                const SizedBox(height: 8),
                CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  value: _faceConsent,
                  onChanged: (value) =>
                      setDialogState(() => _faceConsent = value ?? false),
                  title: const Text(
                    'Saya memahami tujuan, retensi, dan sifat simulasi ini.',
                    style: TextStyle(fontSize: 12),
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text('Batal'),
            ),
            FilledButton(
              onPressed: _faceConsent
                  ? () => Navigator.of(context).pop(true)
                  : null,
              child: const Text('Mulai simulasi'),
            ),
          ],
        ),
      ),
    );
    if (confirmed != true || !mounted) return;
    setState(() {
      _sessionPending = true;
      _cancelled = false;
    });
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text(
          'Sesi simulasi dimulai. Status tidak akan pernah menjadi terverifikasi '
          'tanpa provider nyata.',
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(currentUserProvider);
    final palette = AppPalette.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Verifikasi Akun')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
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
                Container(
                  width: 46,
                  height: 46,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: const Icon(Icons.verified_user_outlined,
                      color: Colors.white, size: 24),
                ),
                const SizedBox(width: 14),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Tingkatkan kepercayaan',
                        style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                          fontSize: 15,
                        ),
                      ),
                      SizedBox(height: 3),
                      Text(
                        'Akun terverifikasi lebih dipercaya saat bertransaksi '
                        'dengan warga sekitar.',
                        style: TextStyle(
                          color: Colors.white70,
                          fontSize: 11,
                          height: 1.4,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          _VerificationStep(
            icon: Icons.g_mobiledata_rounded,
            title: 'Akun Google',
            description: 'Login menggunakan Google',
            status: 'Terhubung',
            statusColor: AppColors.success,
            trailing: const Icon(Icons.check_circle_rounded,
                color: AppColors.success, size: 20),
          ),
          const SizedBox(height: 10),
          _VerificationStep(
            icon: Icons.phone_android_rounded,
            title: 'Nomor telepon',
            description: '+62 812•••••789 · nomor tidak ditampilkan ke publik',
            status: user.phoneVerified ? 'Terverifikasi' : 'Belum',
            statusColor: user.phoneVerified
                ? AppColors.success
                : AppColors.warning,
            trailing: user.phoneVerified
                ? const Icon(Icons.check_circle_rounded,
                    color: AppColors.success, size: 20)
                : null,
          ),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.surface,
              borderRadius: BorderRadius.circular(AppTheme.radiusMd),
              border: Border.all(
                color: _sessionPending ? AppColors.warning : palette.border,
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color: palette.chipBackground,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(Icons.face_outlined,
                          size: 19, color: palette.mutedText),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Verifikasi wajah',
                            style: Theme.of(context).textTheme.titleSmall,
                          ),
                          Text(
                            _sessionPending
                                ? _cancelled
                                    ? 'Sesi dibatalkan'
                                    : 'Simulasi berjalan — bukan verifikasi resmi'
                                : 'Belum dimulai',
                            style:
                                Theme.of(context).textTheme.labelSmall?.copyWith(
                                      color: _sessionPending
                                          ? AppColors.warning
                                          : palette.mutedText,
                                    ),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: palette.warningBackground,
                        borderRadius: BorderRadius.circular(100),
                      ),
                      child: const Text(
                        'Simulasi',
                        style: TextStyle(
                          color: AppColors.warning,
                          fontSize: 9.5,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  'Provider verifikasi wajah belum dipilih. Modul ini menggunakan '
                  'adapter mock yang jujur: tidak ada hasil verifikasi palsu yang '
                  'diklaim berhasil.',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                const SizedBox(height: 12),
                if (!_sessionPending)
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton(
                      onPressed: _startFaceSession,
                      child: const Text('Mulai sesi simulasi'),
                    ),
                  )
                else
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () => setState(() {
                            _sessionPending = false;
                            _cancelled = true;
                          }),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: AppColors.danger,
                          ),
                          child: const Text('Batalkan sesi'),
                        ),
                      ),
                    ],
                  ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          Container(
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
                  child: Text(
                    'Nomor telepon dan data biometrik tidak pernah ditampilkan di '
                    'profil publik maupun posting. Admin biasa hanya melihat nomor '
                    'yang dimasking.',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _VerificationStep extends StatelessWidget {
  const _VerificationStep({
    required this.icon,
    required this.title,
    required this.description,
    required this.status,
    required this.statusColor,
    this.trailing,
  });

  final IconData icon;
  final String title;
  final String description;
  final String status;
  final Color statusColor;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final palette = AppPalette.of(context);
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
        border: Border.all(color: palette.border),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: palette.chipBackground,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, size: 19, color: palette.mutedText),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: Theme.of(context).textTheme.titleSmall),
                Text(description, style: Theme.of(context).textTheme.labelSmall),
              ],
            ),
          ),
          if (trailing != null)
            trailing!
          else
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: statusColor.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(100),
              ),
              child: Text(
                status,
                style: TextStyle(
                  color: statusColor,
                  fontSize: 9.5,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
        ],
      ),
    );
  }
}
