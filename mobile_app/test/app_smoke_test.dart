import 'package:c2c_nearby/app/app.dart';
import 'package:c2c_nearby/app/providers.dart';
import 'package:c2c_nearby/data/models/models.dart';
import 'package:c2c_nearby/data/repositories/marketplace_repository.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Phase-1 smoke test uses an empty repository so the shell can be verified
/// without network image loading or mock delays.
class _EmptyRepository implements MarketplaceRepository {
  @override
  int get discoveryRadiusMeters => 4000;

  @override
  Future<FeedPage> fetchFeed({
    required PostType type,
    String? categorySlug,
    String query = '',
    int page = 1,
    int pageSize = 8,
  }) async =>
      const FeedPage(items: [], hasMore: false, total: 0);

  @override
  Future<Listing?> fetchListing(String id) async => null;

  @override
  Future<List<Listing>> fetchSellerListings(String sellerId) async => const [];

  @override
  Future<Conversation> openConversation(String listingId) =>
      throw UnimplementedError();

  @override
  Future<void> appendMessage(
    String conversationId,
    ChatMessage message, {
    String? preview,
  }) async {}

  @override
  Future<List<Listing>> fetchFavorites() async => const [];

  @override
  Future<void> setFavorite(String listingId, bool favorite) async {}

  @override
  Future<List<Listing>> fetchMyListings() async => const [];

  @override
  Future<List<Conversation>> fetchConversations() async => const [];

  @override
  Future<List<Review>> fetchReviews() async => const [];

  @override
  Future<List<AppNotification>> fetchNotifications() async => const [];

  @override
  Future<Listing> createListing(PostDraft draft, {bool asDraft = false}) =>
      throw UnimplementedError();

  @override
  Future<void> markNotificationsRead() async {}

  @override
  Future<void> markNotificationRead(String id) async {}

  @override
  Future<void> updateListingStatus(
    String listingId,
    ListingStatus status,
  ) async {}

  @override
  Future<void> deleteListing(String listingId) async {}
}

void main() {
  testWidgets('app boots to the explore shell with five destinations',
      (tester) async {
    SharedPreferences.setMockInitialValues({});
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          repositoryProvider.overrideWithValue(_EmptyRepository()),
        ],
        child: const C2CNearbyApp(),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 350));

    expect(find.text('nearby'), findsOneWidget);
    expect(find.text('Jelajah'), findsOneWidget);
    expect(find.text('Favorit'), findsOneWidget);
    expect(find.text('Jual'), findsWidgets);
    expect(find.text('Chat'), findsOneWidget);
    expect(find.text('Profil'), findsOneWidget);
    expect(find.text('Belum ada yang cocok'), findsOneWidget);
    expect(find.text('Radius 4 km'), findsOneWidget);
  });
}
