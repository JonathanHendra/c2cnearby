import 'package:flutter/material.dart';

import '../../app/theme/app_theme.dart';

enum InfoPageKind { help, terms, privacy }

class InfoPage extends StatelessWidget {
  const InfoPage({super.key, required this.kind});

  final InfoPageKind kind;

  @override
  Widget build(BuildContext context) {
    final (title, subtitle, icon) = switch (kind) {
      InfoPageKind.help => (
          'Bantuan',
          'Panduan singkat menggunakan C2C Nearby',
          Icons.help_outline_rounded,
        ),
      InfoPageKind.terms => (
          'Syarat dan Ketentuan',
          'Aturan komunitas dan penggunaan platform',
          Icons.description_outlined,
        ),
      InfoPageKind.privacy => (
          'Kebijakan Privasi',
          'Data yang kami kumpulkan dan cara kami melindunginya',
          Icons.policy_outlined,
        ),
    };
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
        children: [
          Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: AppPalette.of(context).chipBackground,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(
                  icon,
                  size: 22,
                  color: Theme.of(context).colorScheme.primary,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  subtitle,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          ...switch (kind) {
            InfoPageKind.help => _help,
            InfoPageKind.terms => _terms,
            InfoPageKind.privacy => _privacy,
          },
          const SizedBox(height: 18),
          Text(
            'Dokumen ini bagian dari dokumentasi produk dan akan diperbarui saat '
            'fitur backend, autentikasi, dan operasional selesai. Versi final wajib '
            'ditinjau sebelum rilis Google Play.',
            style: Theme.of(context).textTheme.labelSmall,
          ),
        ],
      ),
    );
  }

  List<Widget> get _help => const [
        _Section(
          title: 'Cara membeli',
          body:
              'Buka Jelajah, telusuri posting dalam radius 4 km, lalu buka detail '
              'barang. Tekan Chat Penjual untuk bertanya atau mengajukan penawaran. '
              'Sepakati harga dan lokasi pertemuan di tempat publik. Periksa barang, '
              'lalu bayar langsung kepada penjual.',
        ),
        _Section(
          title: 'Cara menjual',
          body:
              'Tekan tombol Jual di tengah navigasi. Pilih Jual Barang, lengkapi '
              'foto, judul, kategori, harga, kondisi, dan deskripsi. Posting aktif '
              'selama masa tayang dan dapat diperpanjang dari Posting Saya.',
        ),
        _Section(
          title: 'Event dan informasi',
          body:
              'Event dapat ditandai tertarik untuk mendapat pengingat. Platform tidak '
              'memproses pembayaran tiket; biaya dibayar langsung di lokasi. '
              'Informasi lokal dapat disimpan dan dibagikan.',
        ),
        _Section(
          title: 'Keamanan transaksi',
          body:
              'Selalu bertemu di tempat ramai, jangan mengirim uang muka, dan periksa '
              'barang sebelum membayar. Laporkan pengguna yang mencurigakan melalui '
              'menu percakapan. Nomor telepon dan alamat rumah tidak boleh dibagikan.',
        ),
        _Faq(
          question: 'Mengapa hanya posting dalam radius 4 km?',
          answer:
              'Radius 4 km menjaga relevansi dan memudahkan pertemuan tatap muka. '
              'Radius ditetapkan server dan tidak dapat diubah dari aplikasi.',
        ),
        _Faq(
          question: 'Apakah nomor telepon saya terlihat?',
          answer:
              'Tidak. Nomor hanya dipakai untuk verifikasi. Pengguna lain dan posting '
              'tidak pernah menampilkan nomor, dan admin biasa melihat versi masking.',
        ),
        _Faq(
          question: 'Apakah platform menahan pembayaran?',
          answer:
              'Tidak. Pembayaran dilakukan langsung antara pembeli dan penjual. '
              'Penawaran yang diterima bukan bukti pembayaran atau penyerahan barang.',
        ),
      ];

  List<Widget> get _terms => const [
        _Section(
          title: '1. Layanan',
          body:
              'C2C Nearby mempertemukan warga dalam radius 4 km untuk jual beli barang, '
              'event, dan informasi lokal. Platform bukan pihak dalam transaksi, tidak '
              'memproses pembayaran, dan tidak menjamin kualitas barang.',
        ),
        _Section(
          title: '2. Akun',
          body:
              'Satu akun digunakan untuk membeli, menjual, membuat event, dan berbagi '
              'informasi. Anda bertanggung jawab menjaga akses akun dan mematuhi '
              'verifikasi yang diminta.',
        ),
        _Section(
          title: '3. Konten dan barang terlarang',
          body:
              'Dilarang memposting barang ilegal, senjata, obat terlarang, konten '
              'dewasa, hewan dilindungi, dokumen palsu, jasa penipuan, dan barang yang '
              'melanggar hak cipta. Moderator dapat menyembunyikan atau menghapus '
              'posting dengan alasan yang tercatat.',
        ),
        _Section(
          title: '4. Transaksi dan pertemuan',
          body:
              'Pembeli dan penjual menyepakati harga serta lokasi pertemuan secara '
              'langsung. Gunakan tempat publik. Konfirmasi penyelesaian transaksi '
              'dilakukan kedua pihak; satu konfirmasi tidak cukup.',
        ),
        _Section(
          title: '5. Ulasan dan laporan',
          body:
              'Ulasan hanya setelah transaksi selesai dan tidak dapat diubah. Laporan '
              'diselesaikan tim moderasi; penyalahgunaan pelaporan dapat dikenai '
              'pembatasan akun.',
        ),
        _Section(
          title: '6. Penangguhan',
          body:
              'Akun yang melanggar dapat ditangguhkan atau dinonaktifkan. Anda dapat '
              'mengajukan banding melalui kanal bantuan. Data ditangani sesuai '
              'Kebijakan Privasi dan UU Perlindungan Data Pribadi.',
        ),
      ];

  List<Widget> get _privacy => const [
        _Section(
          title: 'Data yang kami kumpulkan',
          body:
              'Identitas akun dari Firebase (nama, email, foto profil), profil publik '
              '(username, nama tampilan, bio, area umum), nomor telepon terverifikasi, '
              'lokasi perkiraan untuk radius 4 km, konten posting, pesan, penawaran, '
              'kesepakatan, ulasan, laporan, dan token perangkat untuk notifikasi.',
        ),
        _Section(
          title: 'Data yang tidak pernah ditampilkan',
          body:
              'Nomor telepon lengkap, email pribadi, koordinat rumah, alamat presisi, '
              'data verifikasi, dan riwayat keamanan. Pembeli hanya melihat jarak '
              'perkiraan dan area umum. Admin biasa menerima nomor yang dimasking.',
        ),
        _Section(
          title: 'Penggunaan data',
          body:
              'Menampilkan posting dalam radius 4 km, memfasilitasi chat dan negosiasi, '
              'mengirim notifikasi yang relevan, mencegah penipuan, menegakkan aturan, '
              'dan memenuhi kewajiban hukum. Kami tidak menjual data pribadi.',
        ),
        _Section(
          title: 'Lokasi dan biometrik',
          body:
              'Izin lokasi diminta dengan penjelasan. Koordinat disimpan privat di '
              'server dan dipakai untuk perhitungan jarak. Verifikasi wajah memerlukan '
              'persetujuan eksplisit; selfie mentah tidak disimpan permanen, hanya '
              'referensi sesi dan status. Provider verifikasi wajah belum dipilih.',
        ),
        _Section(
          title: 'Retensi dan penghapusan',
          body:
              'Profil dihapus 30 hari setelah permintaan (login membatalkan). Chat '
              'disimpan maksimal 24 bulan setelah aktivitas terakhir. Penawaran dan '
              'kesepakatan 24 bulan untuk sengketa. Laporan dan audit 5 tahun. Token '
              'perangkat dihapus saat logout atau setelah 180 hari tidak aktif.',
        ),
        _Section(
          title: 'Hak Anda',
          body:
              'Anda dapat mengakses, memperbaiki, mengekspor, dan menghapus data, serta '
              'menarik persetujuan lokasi/biometrik. Hubungi support@c2cnearby.id. '
              'Permintaan diverifikasi untuk melindungi akun.',
        ),
        _Section(
          title: 'Keamanan',
          body:
              'Token Firebase diverifikasi di server, akses berbasis peran dan '
              'kepemilikan, data sensitif dienkripsi saat transit, unggahan divalidasi '
              'dan diubah ke WebP tanpa metadata, dan akses admin diaudit.',
        ),
      ];
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.body});

  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 5),
          Text(body, style: Theme.of(context).textTheme.bodySmall?.copyWith(height: 1.6)),
        ],
      ),
    );
  }
}

class _Faq extends StatelessWidget {
  const _Faq({required this.question, required this.answer});

  final String question;
  final String answer;

  @override
  Widget build(BuildContext context) {
    final palette = AppPalette.of(context);
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        border: Border.all(color: palette.border),
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
      ),
      child: ExpansionTile(
        tilePadding: const EdgeInsets.symmetric(horizontal: 14),
        shape: const Border(),
        collapsedShape: const Border(),
        title: Text(question, style: Theme.of(context).textTheme.labelMedium),
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text(
                answer,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(height: 1.55),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
