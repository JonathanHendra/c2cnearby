import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../features/auth/login_page.dart';
import '../features/auth/onboarding_page.dart';
import '../features/chat/chat_list_page.dart';
import '../features/chat/chat_room_page.dart';
import '../features/create/create_post_page.dart';
import '../features/detail/listing_detail_page.dart';
import '../features/explore/explore_page.dart';
import '../features/favorites/favorites_page.dart';
import '../features/notifications/notifications_page.dart';
import '../features/profile/agreements_page.dart';
import '../features/profile/edit_profile_page.dart';
import '../features/profile/info_page.dart';
import '../features/profile/my_listings_page.dart';
import '../features/profile/profile_page.dart';
import '../features/profile/reviews_page.dart';
import '../features/profile/settings_page.dart';
import '../features/profile/verification_page.dart';
import '../features/shell/app_shell.dart';

final rootNavigatorKey = GlobalKey<NavigatorState>(debugLabel: 'root');

final routerProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    navigatorKey: rootNavigatorKey,
    initialLocation: '/jelajah',
    routes: [
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) =>
            AppShell(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/jelajah',
                pageBuilder: (context, state) =>
                    const NoTransitionPage(child: ExplorePage()),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/favorit',
                pageBuilder: (context, state) =>
                    const NoTransitionPage(child: FavoritesPage()),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/jual',
                pageBuilder: (context, state) =>
                    const NoTransitionPage(child: CreatePostPage()),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/chat',
                pageBuilder: (context, state) =>
                    const NoTransitionPage(child: ChatListPage()),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/profil',
                pageBuilder: (context, state) =>
                    const NoTransitionPage(child: ProfilePage()),
              ),
            ],
          ),
        ],
      ),
      GoRoute(
        path: '/masuk',
        parentNavigatorKey: rootNavigatorKey,
        builder: (context, state) => const LoginPage(),
      ),
      GoRoute(
        path: '/onboarding',
        parentNavigatorKey: rootNavigatorKey,
        builder: (context, state) => const OnboardingPage(),
      ),
      GoRoute(
        path: '/posting/:id',
        parentNavigatorKey: rootNavigatorKey,
        builder: (context, state) =>
            ListingDetailPage(listingId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/chat/:id',
        parentNavigatorKey: rootNavigatorKey,
        builder: (context, state) =>
            ChatRoomPage(conversationId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/notifikasi',
        parentNavigatorKey: rootNavigatorKey,
        builder: (context, state) => const NotificationsPage(),
      ),
      GoRoute(
        path: '/profil/postingan',
        parentNavigatorKey: rootNavigatorKey,
        builder: (context, state) => const MyListingsPage(),
      ),
      GoRoute(
        path: '/profil/kesepakatan',
        parentNavigatorKey: rootNavigatorKey,
        builder: (context, state) => const AgreementsPage(),
      ),
      GoRoute(
        path: '/profil/ulasan',
        parentNavigatorKey: rootNavigatorKey,
        builder: (context, state) => const ReviewsPage(),
      ),
      GoRoute(
        path: '/profil/verifikasi',
        parentNavigatorKey: rootNavigatorKey,
        builder: (context, state) => const VerificationPage(),
      ),
      GoRoute(
        path: '/profil/pengaturan',
        parentNavigatorKey: rootNavigatorKey,
        builder: (context, state) => const SettingsPage(),
      ),
      GoRoute(
        path: '/profil/edit',
        parentNavigatorKey: rootNavigatorKey,
        builder: (context, state) => const EditProfilePage(),
      ),
      GoRoute(
        path: '/profil/bantuan',
        parentNavigatorKey: rootNavigatorKey,
        builder: (context, state) => const InfoPage(kind: InfoPageKind.help),
      ),
      GoRoute(
        path: '/profil/syarat',
        parentNavigatorKey: rootNavigatorKey,
        builder: (context, state) => const InfoPage(kind: InfoPageKind.terms),
      ),
      GoRoute(
        path: '/profil/privasi',
        parentNavigatorKey: rootNavigatorKey,
        builder: (context, state) => const InfoPage(kind: InfoPageKind.privacy),
      ),
    ],
  );
});
