import '../models/models.dart';

class FeedPage {
  const FeedPage({required this.items, required this.hasMore, required this.total});

  final List<Listing> items;
  final bool hasMore;
  final int total;
}

class PostDraft {
  const PostDraft({
    required this.type,
    required this.title,
    required this.description,
    required this.categoryName,
    required this.categorySlug,
    this.price,
    this.priceType,
    this.condition,
    this.imageUrls = const [],
    this.eventStart,
    this.eventEnd,
    this.eventLocation,
    this.eventIsFree = true,
    this.informationLink,
    this.brand,
  });

  final PostType type;
  final String title;
  final String description;
  final String categoryName;
  final String categorySlug;
  final int? price;
  final PriceType? priceType;
  final ItemCondition? condition;
  final List<String> imageUrls;
  final DateTime? eventStart;
  final DateTime? eventEnd;
  final String? eventLocation;
  final bool eventIsFree;
  final String? informationLink;
  final String? brand;
}

/// Contract the Phase-2 API client will implement. UI code depends only on
/// this interface so mock data can be removed without touching screens.
abstract class MarketplaceRepository {
  Future<FeedPage> fetchFeed({
    required PostType type,
    String? categorySlug,
    String query = '',
    int page = 1,
    int pageSize = 8,
  });

  Future<Listing?> fetchListing(String id);
  Future<List<Listing>> fetchSellerListings(String sellerId);
  Future<Conversation> openConversation(String listingId);
  Future<void> appendMessage(
    String conversationId,
    ChatMessage message, {
    String? preview,
  });
  Future<List<Listing>> fetchFavorites();
  Future<void> setFavorite(String listingId, bool favorite);
  Future<List<Listing>> fetchMyListings();
  Future<List<Conversation>> fetchConversations();
  Future<List<Review>> fetchReviews();
  Future<List<AppNotification>> fetchNotifications();
  Future<Listing> createListing(PostDraft draft, {bool asDraft = false});
  Future<void> markNotificationsRead();
  Future<void> markNotificationRead(String id);
  Future<void> updateListingStatus(String listingId, ListingStatus status);
  Future<void> deleteListing(String listingId);

  /// The discovery radius is a server constant; it is exposed for display only.
  int get discoveryRadiusMeters;
}
