import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../core/auth/auth_api.dart';
import '../core/auth/auth_controller.dart';
import '../data/models/models.dart';
import '../data/repositories/api_marketplace_repository.dart';
import '../data/repositories/marketplace_repository.dart';

final repositoryProvider = Provider<MarketplaceRepository>((ref) {
  return ApiMarketplaceRepository();
});

final apiRepositoryProvider = Provider<ApiMarketplaceRepository>((ref) {
  return ref.watch(repositoryProvider) as ApiMarketplaceRepository;
});

final categoriesProvider = FutureProvider<List<Category>>((ref) {
  return ref.watch(apiRepositoryProvider).categories();
});

final authApiProvider = Provider<AuthApi>((ref) => AuthApi());

final authProvider = StateNotifierProvider<AuthController, AuthState>((ref) {
  return AuthController(ref.watch(authApiProvider));
});

final isSignedInProvider = Provider<bool>((ref) {
  return ref.watch(authProvider).isSignedIn;
});

/// Profile shown across the shell. Browsing works without an account, so a
/// signed-out member gets an empty placeholder profile instead of demo data.
final _guestUser = CurrentUser(
  username: '',
  displayName: 'Pengunjung',
  avatarUrl: '',
  areaLabel: '',
  rating: 0,
  reviewCount: 0,
  joinedAt: DateTime(2000),
  phoneVerified: false,
  faceVerified: false,
  listingCount: 0,
  favoriteCount: 0,
);

final currentUserProvider = Provider<CurrentUser>((ref) {
  final session = ref.watch(authProvider);
  final user = session.user;
  if (user == null) {
    return _guestUser;
  }

  return CurrentUser(
    username: user.username,
    displayName: user.displayName ?? user.username,
    avatarUrl: user.avatarUrl ?? '',
    areaLabel: user.areaLabel ?? 'Area belum diatur',
    rating: 0,
    reviewCount: 0,
    joinedAt: user.joinedAt ?? DateTime.now(),
    phoneVerified: user.phoneVerified,
    faceVerified: user.faceVerified,
    listingCount: 0,
    favoriteCount: 0,
  );
});

final favoritesProvider = FutureProvider.autoDispose<List<Listing>>((ref) {
  return ref.watch(repositoryProvider).fetchFavorites();
});

final myListingsProvider = FutureProvider.autoDispose<List<Listing>>((ref) {
  return ref.watch(repositoryProvider).fetchMyListings();
});

final conversationsProvider =
    FutureProvider.autoDispose<List<Conversation>>((ref) {
  return ref.watch(repositoryProvider).fetchConversations();
});

final reviewsProvider = FutureProvider.autoDispose<List<Review>>((ref) {
  return ref.watch(repositoryProvider).fetchReviews();
});

final notificationsProvider =
    FutureProvider.autoDispose<List<AppNotification>>((ref) {
  return ref.watch(repositoryProvider).fetchNotifications();
});

final unreadNotificationCountProvider = Provider.autoDispose<int>((ref) {
  final async = ref.watch(notificationsProvider);
  return async.maybeWhen(
    data: (items) => items.where((item) => !item.read).length,
    orElse: () => 0,
  );
});

class FeedState {
  const FeedState({
    required this.type,
    this.categorySlug,
    this.query = '',
    this.items = const [],
    this.page = 1,
    this.hasMore = false,
    this.total = 0,
    this.isLoading = false,
    this.isLoadingMore = false,
    this.error,
  });

  final PostType type;
  final String? categorySlug;
  final String query;
  final List<Listing> items;
  final int page;
  final bool hasMore;
  final int total;
  final bool isLoading;
  final bool isLoadingMore;
  final String? error;

  FeedState copyWith({
    PostType? type,
    String? categorySlug,
    bool clearCategory = false,
    String? query,
    List<Listing>? items,
    int? page,
    bool? hasMore,
    int? total,
    bool? isLoading,
    bool? isLoadingMore,
    String? error,
    bool clearError = false,
  }) {
    return FeedState(
      type: type ?? this.type,
      categorySlug: clearCategory ? null : (categorySlug ?? this.categorySlug),
      query: query ?? this.query,
      items: items ?? this.items,
      page: page ?? this.page,
      hasMore: hasMore ?? this.hasMore,
      total: total ?? this.total,
      isLoading: isLoading ?? this.isLoading,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      error: clearError ? null : (error ?? this.error),
    );
  }
}

class FeedController extends StateNotifier<FeedState> {
  FeedController(this._repository) : super(const FeedState(type: PostType.sell));

  final MarketplaceRepository _repository;
  int _requestId = 0;

  Future<void> load({bool reset = true}) async {
    final requestId = ++_requestId;
    state = state.copyWith(
      isLoading: reset,
      isLoadingMore: !reset,
      clearError: true,
      items: reset ? const [] : state.items,
    );
    try {
      final page = await _repository.fetchFeed(
        type: state.type,
        categorySlug: state.categorySlug,
        query: state.query,
        page: reset ? 1 : state.page + 1,
        pageSize: 8,
      );
      if (requestId != _requestId || !mounted) return;
      state = state.copyWith(
        items: reset ? page.items : [...state.items, ...page.items],
        page: reset ? 1 : state.page + 1,
        hasMore: page.hasMore,
        total: page.total,
        isLoading: false,
        isLoadingMore: false,
        clearError: true,
      );
    } catch (_) {
      if (requestId != _requestId || !mounted) return;
      state = state.copyWith(
        isLoading: false,
        isLoadingMore: false,
        error: 'Tidak dapat memuat posting di sekitar Anda. Periksa koneksi lalu coba lagi.',
      );
    }
  }

  Future<void> setType(PostType type) async {
    if (state.type == type) return;
    state = state.copyWith(type: type, clearCategory: true, items: const []);
    await load();
  }

  Future<void> setCategory(String? slug) async {
    if (state.categorySlug == slug) return;
    state = state.copyWith(
      categorySlug: slug,
      clearCategory: slug == null,
      items: const [],
    );
    await load();
  }

  Future<void> search(String query) async {
    state = state.copyWith(query: query, items: const []);
    await load();
  }

  Future<void> refresh() => load();

  Future<void> loadMore() async {
    if (state.isLoading || state.isLoadingMore || !state.hasMore) return;
    await load(reset: false);
  }
}

final feedProvider = StateNotifierProvider<FeedController, FeedState>((ref) {
  final controller = FeedController(ref.watch(repositoryProvider));
  controller.load();
  return controller;
});

class ThemeModeController extends StateNotifier<ThemeMode> {
  ThemeModeController() : super(ThemeMode.system) {
    _restore();
  }

  static const _key = 'theme_mode';

  Future<void> _restore() async {
    final prefs = await SharedPreferences.getInstance();
    final stored = prefs.getString(_key);
    final mode = switch (stored) {
      'light' => ThemeMode.light,
      'dark' => ThemeMode.dark,
      _ => ThemeMode.system,
    };
    if (mounted) state = mode;
  }

  Future<void> setMode(ThemeMode mode) async {
    state = mode;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      _key,
      switch (mode) {
        ThemeMode.light => 'light',
        ThemeMode.dark => 'dark',
        ThemeMode.system => 'system',
      },
    );
  }

  Future<void> toggle(bool dark) => setMode(dark ? ThemeMode.dark : ThemeMode.light);
}

final themeModeProvider =
    StateNotifierProvider<ThemeModeController, ThemeMode>((ref) {
  return ThemeModeController();
});
