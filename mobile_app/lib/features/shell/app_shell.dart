import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/providers.dart';
import '../../app/theme/app_theme.dart';

class AppShell extends ConsumerWidget {
  const AppShell({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  void _go(int index) {
    navigationShell.goBranch(
      index,
      initialLocation: index == navigationShell.currentIndex,
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final unreadChat = ref.watch(conversationsProvider).maybeWhen(
          data: (items) =>
              items.fold<int>(0, (sum, item) => sum + item.unread),
          orElse: () => 0,
        );
    final palette = AppPalette.of(context);
    final surface = Theme.of(context).colorScheme.surface;
    return Scaffold(
      body: navigationShell,
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: surface,
          border: Border(top: BorderSide(color: palette.border)),
        ),
        padding: EdgeInsets.only(
          top: 7,
          bottom: 6 + MediaQuery.paddingOf(context).bottom,
        ),
        child: Row(
          children: [
            _NavItem(
              icon: Icons.explore_outlined,
              activeIcon: Icons.explore,
              label: 'Jelajah',
              selected: navigationShell.currentIndex == 0,
              onTap: () => _go(0),
            ),
            _NavItem(
              icon: Icons.favorite_border_rounded,
              activeIcon: Icons.favorite_rounded,
              label: 'Favorit',
              selected: navigationShell.currentIndex == 1,
              onTap: () => _go(1),
            ),
            _SellItem(
              selected: navigationShell.currentIndex == 2,
              onTap: () => _go(2),
            ),
            _NavItem(
              icon: Icons.chat_bubble_outline_rounded,
              activeIcon: Icons.chat_bubble_rounded,
              label: 'Chat',
              selected: navigationShell.currentIndex == 3,
              onTap: () => _go(3),
              badge: unreadChat,
            ),
            _NavItem(
              icon: Icons.person_outline_rounded,
              activeIcon: Icons.person_rounded,
              label: 'Profil',
              selected: navigationShell.currentIndex == 4,
              onTap: () => _go(4),
            ),
          ],
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  const _NavItem({
    required this.icon,
    required this.activeIcon,
    required this.label,
    required this.selected,
    required this.onTap,
    this.badge = 0,
  });

  final IconData icon;
  final IconData activeIcon;
  final String label;
  final bool selected;
  final VoidCallback onTap;
  final int badge;

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    final palette = AppPalette.of(context);
    return Expanded(
      child: InkResponse(
        onTap: onTap,
        containedInkWell: true,
        highlightShape: BoxShape.rectangle,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                Icon(
                  selected ? activeIcon : icon,
                  size: 23,
                  color: selected ? primary : palette.mutedText,
                ),
                if (badge > 0)
                  Positioned(
                    right: -7,
                    top: -4,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 4.5,
                        vertical: 1,
                      ),
                      decoration: BoxDecoration(
                        color: primary,
                        borderRadius: BorderRadius.circular(100),
                      ),
                      constraints: const BoxConstraints(minWidth: 15),
                      child: Text(
                        badge > 9 ? '9+' : '$badge',
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 9,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 3),
            Text(
              label,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: selected ? primary : palette.mutedText,
                    fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                    fontSize: 10.5,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SellItem extends StatelessWidget {
  const _SellItem({required this.selected, required this.onTap});

  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 44,
              height: 44,
              margin: const EdgeInsets.only(top: 1),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: selected
                      ? [primary, AppColors.electricDark]
                      : [primary, primary.withValues(alpha: 0.82)],
                ),
                borderRadius: BorderRadius.circular(15),
                boxShadow: [
                  BoxShadow(
                    color: primary.withValues(alpha: 0.32),
                    blurRadius: 14,
                    offset: const Offset(0, 5),
                  ),
                ],
              ),
              child: const Icon(Icons.add_rounded, color: Colors.white, size: 26),
            ),
            const SizedBox(height: 2),
            Text(
              'Jual',
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: primary,
                    fontWeight: FontWeight.w700,
                    fontSize: 10.5,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}
