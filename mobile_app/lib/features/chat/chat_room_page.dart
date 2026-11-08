import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../app/providers.dart';
import '../../app/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../core/widgets/common_widgets.dart';
import '../../core/widgets/smart_image.dart';
import '../../core/widgets/states.dart';
import '../../data/models/models.dart';

class ChatRoomPage extends ConsumerStatefulWidget {
  const ChatRoomPage({super.key, required this.conversationId});

  final String conversationId;

  @override
  ConsumerState<ChatRoomPage> createState() => _ChatRoomPageState();
}

class _ChatRoomPageState extends ConsumerState<ChatRoomPage> {
  final _text = TextEditingController();
  final _scroll = ScrollController();
  final List<ChatMessage> _messages = [];
  bool _initialized = false;
  bool _blocked = false;

  @override
  void dispose() {
    _text.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Conversation? _find(AsyncValue<List<Conversation>> async) {
    for (final conversation in async.valueOrNull ?? const <Conversation>[]) {
      if (conversation.id == widget.conversationId) return conversation;
    }
    return null;
  }

  void _append(Conversation conversation, ChatMessage message, String preview) {
    setState(() => _messages.add(message));
    ref.read(repositoryProvider).appendMessage(
          conversation.id,
          message,
          preview: preview,
        );
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scroll.hasClients) return;
      _scroll.animateTo(
        0,
        duration: const Duration(milliseconds: 220),
        curve: Curves.easeOut,
      );
    });
  }

  void _sendText(Conversation conversation) {
    final value = _text.text.trim();
    if (value.isEmpty) return;
    _text.clear();
    _append(
      conversation,
      ChatMessage(
        id: 'm-${DateTime.now().microsecondsSinceEpoch}',
        senderIsMe: true,
        type: MessageType.text,
        text: value,
        createdAt: DateTime.now(),
      ),
      value,
    );
  }

  Future<void> _sendImage(Conversation conversation) async {
    try {
      final file = await ImagePicker().pickImage(
        source: ImageSource.gallery,
        maxWidth: 1280,
        imageQuality: 70,
      );
      if (file == null) return;
      final bytes = await file.readAsBytes();
      if (bytes.length > 4 * 1024 * 1024) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Ukuran gambar maksimal 4 MB.')),
        );
        return;
      }
      final url = 'data:${file.mimeType ?? "image/jpeg"};base64,'
          '${base64Encode(bytes)}';
      if (!mounted) return;
      _append(
        conversation,
        ChatMessage(
          id: 'm-${DateTime.now().microsecondsSinceEpoch}',
          senderIsMe: true,
          type: MessageType.image,
          imageUrl: url,
          createdAt: DateTime.now(),
        ),
        '[Foto]',
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Tidak dapat membuka galeri.')),
      );
    }
  }

  Future<void> _makeOffer(Conversation conversation) async {
    final value = await showModalBottomSheet<int>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) => _OfferSheet(
        listingTitle: conversation.listingTitle,
        listingPrice: conversation.listingPrice,
      ),
    );
    if (value == null) return;
    _append(
      conversation,
      ChatMessage(
        id: 'm-${DateTime.now().microsecondsSinceEpoch}',
        senderIsMe: true,
        type: MessageType.offer,
        createdAt: DateTime.now(),
        offer: PriceOffer(
          id: 'o-${DateTime.now().microsecondsSinceEpoch}',
          amount: value,
          status: OfferStatus.pending,
          senderIsMe: true,
          createdAt: DateTime.now(),
        ),
      ),
      'Penawaran ${formatRupiah(value)}',
    );
  }

  Future<void> _shareMeetup(Conversation conversation) async {
    final place = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (context) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Bagikan lokasi pertemuan',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 4),
            Text(
              'Pilih tempat publik. Lokasi rumah atau alamat presisi tidak boleh dibagikan.',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 10),
            for (final place in const [
              'Lobby Senopati City',
              'Taman Kemang, pintu barat',
              'Stasiun MRT Cipete Raya',
              'Area parkir Cilandak Town Square',
            ])
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.place_outlined),
                title: Text(place),
                trailing: const Icon(Icons.chevron_right_rounded),
                onTap: () => Navigator.of(context).pop(place),
              ),
          ],
        ),
      ),
    );
    if (place == null) return;
    _append(
      conversation,
      ChatMessage(
        id: 'm-${DateTime.now().microsecondsSinceEpoch}',
        senderIsMe: true,
        type: MessageType.meetup,
        text: place,
        createdAt: DateTime.now(),
      ),
      'Lokasi pertemuan: $place',
    );
  }

  void _updateOffer(
    Conversation conversation,
    ChatMessage message,
    OfferStatus status,
    String systemText,
  ) {
    final index = _messages.indexWhere((item) => item.id == message.id);
    if (index == -1) return;
    setState(() {
      _messages[index] = _messages[index].copyWith(
        offer: _messages[index].offer?.copyWith(status: status),
      );
      _messages.add(
        ChatMessage(
          id: 'm-${DateTime.now().microsecondsSinceEpoch}',
          senderIsMe: true,
          type: MessageType.system,
          text: systemText,
          createdAt: DateTime.now(),
        ),
      );
    });
    ref.read(repositoryProvider).appendMessage(
          conversation.id,
          ChatMessage(
            id: 'sys-${DateTime.now().microsecondsSinceEpoch}',
            senderIsMe: true,
            type: MessageType.system,
            text: systemText,
            createdAt: DateTime.now(),
          ),
          preview: systemText,
        );
    _text.clear();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(systemText)),
    );
  }

  Future<void> _showReportDialog(Conversation conversation) async {
    await showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Laporkan percakapan'),
        content: const Text(
          'Pelaporan akan dikirim ke tim moderasi pada Fase 5 saat endpoint '
          'reports tersedia. Tidak ada data yang dikirim sekarang.\n\n'
          'Untuk keadaan darurat, hubungi pihak berwenang.',
        ),
        actions: [
          FilledButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Mengerti'),
          ),
        ],
      ),
    );
  }

  Future<void> _toggleBlock(Conversation conversation) async {
    if (_blocked) {
      setState(() => _blocked = false);
      return;
    }
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Blokir ${conversation.otherName}?'),
        content: const Text(
          'Anda tidak akan bisa saling mengirim pesan atau melihat posting '
          'satu sama lain. Blokir dapat dibuka kembali kapan saja.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Batal'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Blokir'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    setState(() => _blocked = true);
    _append(
      conversation,
      ChatMessage(
        id: 'm-${DateTime.now().microsecondsSinceEpoch}',
        senderIsMe: true,
        type: MessageType.system,
        text: 'Anda memblokir ${conversation.otherName}.',
        createdAt: DateTime.now(),
      ),
      'Pengguna diblokir',
    );
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(conversationsProvider);
    final conversation = _find(async);
    if (conversation != null && !_initialized) {
      _initialized = true;
      _messages
        ..clear()
        ..addAll(conversation.messages);
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_scroll.hasClients) _scroll.jumpTo(0);
      });
    }
    if (conversation == null && async.isLoading) {
      return Scaffold(
        appBar: AppBar(),
        body: const Center(child: CircularProgressIndicator()),
      );
    }
    if (conversation == null) {
      return Scaffold(
        appBar: AppBar(),
        body: const EmptyState(
          icon: Icons.chat_bubble_outline_rounded,
          title: 'Percakapan tidak ditemukan',
          message: 'Percakapan ini tidak tersedia atau bukan milik Anda.',
        ),
      );
    }
    final palette = AppPalette.of(context);
    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: Row(
          children: [
            AppAvatar(
              imageUrl: conversation.otherAvatar,
              name: conversation.otherName,
              size: 38,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    conversation.otherName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                  Text(
                    'Terakhir aktif baru saja',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: AppColors.success,
                        ),
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert_rounded),
            onSelected: (value) {
              switch (value) {
                case 'meetup':
                  _shareMeetup(conversation);
                case 'report':
                  _showReportDialog(conversation);
                case 'block':
                  _toggleBlock(conversation);
              }
            },
            itemBuilder: (context) => [
              const PopupMenuItem(
                value: 'meetup',
                child: Text('Bagikan lokasi pertemuan'),
              ),
              const PopupMenuItem(
                value: 'report',
                child: Text('Laporkan'),
              ),
              PopupMenuItem(
                value: 'block',
                child: Text(_blocked ? 'Buka blokir' : 'Blokir pengguna'),
              ),
            ],
          ),
        ],
      ),
      body: Column(
        children: [
          InkWell(
            onTap: () => context.push('/posting/${conversation.listingId}'),
            child: Container(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surface,
                border: Border(
                  bottom: BorderSide(color: palette.border),
                ),
              ),
              child: Row(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(10),
                    child: SmartImage(
                      url: conversation.listingImage,
                      width: 46,
                      height: 46,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          conversation.listingTitle,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.labelMedium,
                        ),
                        const SizedBox(height: 2),
                        Text(
                          conversation.listingPrice == null
                              ? 'Lihat detail'
                              : '${formatRupiah(conversation.listingPrice)} · Lihat detail',
                          style:
                              Theme.of(context).textTheme.labelSmall?.copyWith(
                                    color: Theme.of(context).colorScheme.primary,
                                  ),
                        ),
                      ],
                    ),
                  ),
                  const Icon(Icons.chevron_right_rounded, size: 20),
                ],
              ),
            ),
          ),
          Expanded(
            child: ListView.builder(
              controller: _scroll,
              reverse: true,
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
              itemCount: _messages.length,
              itemBuilder: (context, index) {
                final message = _messages[_messages.length - 1 - index];
                return _MessageView(
                  message: message,
                  onAccept: () => _updateOffer(
                    conversation,
                    message,
                    OfferStatus.accepted,
                    'Penawaran diterima. Ayo sepakati lokasi pertemuan di tempat publik.',
                  ),
                  onReject: () => _updateOffer(
                    conversation,
                    message,
                    OfferStatus.rejected,
                    'Penawaran ditolak.',
                  ),
                  onCounter: () => _makeOffer(conversation),
                  onOpenMap: () async {
                    await Clipboard.setData(
                      ClipboardData(text: message.text ?? ''),
                    );
                    if (!context.mounted) return;
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text(
                          'Lokasi disalin. Peta akan terhubung pada Fase 4.',
                        ),
                      ),
                    );
                  },
                );
              },
            ),
          ),
          if (_blocked)
            Container(
              width: double.infinity,
              padding: EdgeInsets.fromLTRB(
                20,
                12,
                20,
                12 + MediaQuery.paddingOf(context).bottom,
              ),
              color: palette.dangerBackground,
              child: Row(
                children: [
                  const Icon(Icons.block_outlined,
                      color: AppColors.danger, size: 18),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Anda memblokir pengguna ini.',
                      style: Theme.of(context)
                          .textTheme
                          .bodySmall
                          ?.copyWith(color: AppColors.danger),
                    ),
                  ),
                  TextButton(
                    onPressed: () => setState(() => _blocked = false),
                    child: const Text('Buka blokir'),
                  ),
                ],
              ),
            )
          else
            Container(
              padding: EdgeInsets.fromLTRB(
                12,
                10,
                12,
                10 + MediaQuery.paddingOf(context).bottom,
              ),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surface,
                border: Border(top: BorderSide(color: palette.border)),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  IconButton(
                    onPressed: () => _sendImage(conversation),
                    tooltip: 'Kirim foto',
                    icon: const Icon(Icons.image_outlined),
                  ),
                  if (conversation.listingPrice != null)
                    IconButton(
                      onPressed: () => _makeOffer(conversation),
                      tooltip: 'Ajukan penawaran',
                      icon: const Icon(Icons.local_offer_outlined),
                    ),
                  Expanded(
                    child: TextField(
                      controller: _text,
                      minLines: 1,
                      maxLines: 4,
                      textCapitalization: TextCapitalization.sentences,
                      onSubmitted: (_) => _sendText(conversation),
                      decoration: const InputDecoration(
                        hintText: 'Tulis pesan…',
                        isDense: true,
                        contentPadding:
                            EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton.filled(
                    onPressed: () => _sendText(conversation),
                    tooltip: 'Kirim',
                    icon: const Icon(Icons.send_rounded, size: 19),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _MessageView extends StatelessWidget {
  const _MessageView({
    required this.message,
    required this.onAccept,
    required this.onReject,
    required this.onCounter,
    required this.onOpenMap,
  });

  final ChatMessage message;
  final VoidCallback onAccept;
  final VoidCallback onReject;
  final VoidCallback onCounter;
  final VoidCallback onOpenMap;

  @override
  Widget build(BuildContext context) {
    if (message.type == MessageType.system) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 10),
        child: Center(
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: AppPalette.of(context).chipBackground,
              borderRadius: BorderRadius.circular(100),
            ),
            child: Text(
              message.text ?? '',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.labelSmall,
            ),
          ),
        ),
      );
    }
    final mine = message.senderIsMe;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment:
            mine ? CrossAxisAlignment.end : CrossAxisAlignment.start,
        children: [
          if (message.type == MessageType.offer)
            _OfferBubble(
              message: message,
              onAccept: onAccept,
              onReject: onReject,
              onCounter: onCounter,
            )
          else if (message.type == MessageType.meetup)
            _BubbleContainer(
              mine: mine,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.place_rounded,
                          color: Colors.white, size: 17),
                      const SizedBox(width: 5),
                      Text(
                        'Lokasi pertemuan',
                        style: Theme.of(context).textTheme.labelMedium?.copyWith(
                              color: Colors.white,
                              fontWeight: FontWeight.w700,
                            ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    message.text ?? '',
                    style: const TextStyle(color: Colors.white, fontSize: 13),
                  ),
                  const SizedBox(height: 8),
                  InkWell(
                    onTap: onOpenMap,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.16),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Text(
                        'Salin lokasi',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            )
          else
            _BubbleContainer(
              mine: mine,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (message.type == MessageType.image)
                    ClipRRect(
                      borderRadius: BorderRadius.circular(10),
                      child: SmartImage(
                        url: message.imageUrl,
                        width: 210,
                        height: 210,
                      ),
                    ),
                  if (message.text != null && message.text!.isNotEmpty) ...[
                    if (message.type == MessageType.image)
                      const SizedBox(height: 6),
                    Text(
                      message.text!,
                      style: TextStyle(
                        color: mine
                            ? Colors.white
                            : Theme.of(context).colorScheme.onSurface,
                        fontSize: 13.5,
                        height: 1.45,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          const SizedBox(height: 3),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                formatTime(message.createdAt),
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      fontSize: 9.5,
                      color: AppPalette.of(context).subtleText,
                    ),
              ),
              if (mine) ...[
                const SizedBox(width: 3),
                Icon(
                  Icons.done_all_rounded,
                  size: 13,
                  color: AppPalette.of(context).subtleText,
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

class _BubbleContainer extends StatelessWidget {
  const _BubbleContainer({required this.mine, required this.child});

  final bool mine;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final palette = AppPalette.of(context);
    return ConstrainedBox(
      constraints: BoxConstraints(
        maxWidth: MediaQuery.sizeOf(context).width * 0.76,
      ),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 9),
        decoration: BoxDecoration(
          color: mine
              ? Theme.of(context).colorScheme.primary
              : Theme.of(context).colorScheme.surface,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(16),
            topRight: const Radius.circular(16),
            bottomLeft: Radius.circular(mine ? 16 : 4),
            bottomRight: Radius.circular(mine ? 4 : 16),
          ),
          border: mine ? null : Border.all(color: palette.border),
        ),
        child: child,
      ),
    );
  }
}

class _OfferBubble extends StatelessWidget {
  const _OfferBubble({
    required this.message,
    required this.onAccept,
    required this.onReject,
    required this.onCounter,
  });

  final ChatMessage message;
  final VoidCallback onAccept;
  final VoidCallback onReject;
  final VoidCallback onCounter;

  @override
  Widget build(BuildContext context) {
    final offer = message.offer!;
    final status = switch (offer.status) {
      OfferStatus.pending => ('Menunggu jawaban', AppColors.warning,
          AppPalette.of(context).warningBackground),
      OfferStatus.accepted => ('Diterima', AppColors.success,
          AppPalette.of(context).successBackground),
      OfferStatus.rejected => ('Ditolak', AppColors.danger,
          AppPalette.of(context).dangerBackground),
      OfferStatus.withdrawn => ('Ditarik', AppPalette.of(context).mutedText,
          AppPalette.of(context).chipBackground),
    };
    return Container(
      width: MediaQuery.sizeOf(context).width * 0.76,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
        border: Border.all(
          color: offer.status == OfferStatus.accepted
              ? AppColors.success
              : AppPalette.of(context).border,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Icons.local_offer_outlined,
                size: 16,
                color: Theme.of(context).colorScheme.primary,
              ),
              const SizedBox(width: 6),
              Text(
                'Penawaran harga',
                style: Theme.of(context).textTheme.labelMedium,
              ),
              const Spacer(),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                decoration: BoxDecoration(
                  color: status.$3,
                  borderRadius: BorderRadius.circular(100),
                ),
                child: Text(
                  status.$1,
                  style: TextStyle(
                    fontSize: 9.5,
                    fontWeight: FontWeight.w700,
                    color: status.$2,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            formatRupiah(offer.amount),
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  color: Theme.of(context).colorScheme.primary,
                ),
          ),
          const SizedBox(height: 4),
          Text(
            offer.senderIsMe
                ? 'Penawaran Anda. Bukan bukti pembayaran.'
                : 'Penawaran pembeli. Bukan bukti pembayaran.',
            style: Theme.of(context).textTheme.labelSmall,
          ),
          if (!offer.senderIsMe && offer.status == OfferStatus.pending) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: FilledButton(
                    onPressed: onAccept,
                    style: FilledButton.styleFrom(
                      minimumSize: const Size(0, 38),
                      padding: const EdgeInsets.symmetric(horizontal: 8),
                    ),
                    child: const Text('Terima'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton(
                    onPressed: onCounter,
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size(0, 38),
                      padding: const EdgeInsets.symmetric(horizontal: 8),
                    ),
                    child: const Text('Tawar'),
                  ),
                ),
                const SizedBox(width: 4),
                IconButton(
                  onPressed: onReject,
                  tooltip: 'Tolak',
                  icon: const Icon(Icons.close_rounded, size: 18),
                  color: AppColors.danger,
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _OfferSheet extends StatefulWidget {
  const _OfferSheet({required this.listingTitle, required this.listingPrice});

  final String listingTitle;
  final int? listingPrice;

  @override
  State<_OfferSheet> createState() => _OfferSheetState();
}

class _OfferSheetState extends State<_OfferSheet> {
  late final TextEditingController _controller = TextEditingController(
    text: widget.listingPrice == null
        ? ''
        : (widget.listingPrice! * 0.9).round().toString(),
  );
  String? _error;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(
        24,
        0,
        24,
        24 + MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Ajukan penawaran', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 4),
          Text(
            widget.listingTitle,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodySmall,
          ),
          if (widget.listingPrice != null)
            Text(
              'Harga penjual ${formatRupiah(widget.listingPrice)}',
              style: Theme.of(context).textTheme.labelSmall,
            ),
          const SizedBox(height: 16),
          TextField(
            controller: _controller,
            autofocus: true,
            keyboardType: TextInputType.number,
            decoration: InputDecoration(
              labelText: 'Harga penawaran',
              prefixText: 'Rp ',
              errorText: _error,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Penawaran disimpan sebagai data terstruktur dan berlaku 24 jam. '
            'Menerima penawaran bukan berarti transaksi sudah dibayar.',
            style: Theme.of(context).textTheme.labelSmall,
          ),
          const SizedBox(height: 18),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: () {
                final value = int.tryParse(_controller.text.trim());
                if (value == null || value <= 0) {
                  setState(() => _error = 'Masukkan nominal yang valid.');
                  return;
                }
                Navigator.of(context).pop(value);
              },
              child: const Text('Kirim penawaran'),
            ),
          ),
        ],
      ),
    );
  }
}
