import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../../core/config/app_config.dart';
import '../models/models.dart';
import 'marketplace_repository.dart';

/// Raised when an action needs a signed-in member. The UI turns this into a
/// "masuk dulu" prompt instead of inventing local data.
class AuthRequiredException implements Exception {
  const AuthRequiredException(this.message);

  final String message;

  @override
  String toString() => message;
}

/// Raised for any other backend rejection, carrying the server message.
class RepositoryException implements Exception {
  const RepositoryException(this.message, {this.statusCode});

  final String message;
  final int? statusCode;

  @override
  String toString() => message;
}

/// Real marketplace repository: every method talks to the Fastify backend.
/// Nothing is cached, so screens always reflect the database.
class ApiMarketplaceRepository implements MarketplaceRepository {
  ApiMarketplaceRepository({Dio? dio})
      : _dio = dio ??
            Dio(
              BaseOptions(
                baseUrl: AppConfig.apiBaseUrl,
                connectTimeout: const Duration(seconds: 15),
                receiveTimeout: const Duration(seconds: 30),
                headers: const {'Accept': 'application/json'},
              ),
            );

  final Dio _dio;

  /// slug -> category id, filled from `GET /categories`.
  final Map<String, String> _categoryIds = {};
  List<Category>? _categories;

  @override
  int get discoveryRadiusMeters => 4000;

  Future<Options> _options({bool required = false}) async {
    final headers = <String, String>{};
    try {
      if (FirebaseAuth.instance.currentUser != null) {
        final token = await FirebaseAuth.instance.currentUser?.getIdToken();
        if (token != null) {
          headers['Authorization'] = 'Bearer $token';
        }
      }
    } catch (_) {
      // Firebase is not configured in this build; public endpoints still work.
    }

    if (required && !headers.containsKey('Authorization')) {
      throw const AuthRequiredException('Masuk dulu untuk memakai fitur ini.');
    }
    return Options(headers: headers);
  }

  Map<String, dynamic> _data(Response<dynamic> response) {
    final body = response.data;
    if (body is Map<String, dynamic>) {
      final data = body['data'];
      if (data is Map<String, dynamic>) {
        return data;
      }
      return body;
    }
    return const <String, dynamic>{};
  }

  RepositoryException _error(DioException error) {
    final body = error.response?.data;
    if (body is Map<String, dynamic>) {
      final envelope = body['error'];
      if (envelope is Map<String, dynamic>) {
        return RepositoryException(
          envelope['message'] as String? ?? 'Permintaan gagal.',
          statusCode: error.response?.statusCode,
        );
      }
    }
    return RepositoryException(
      'Tidak dapat menghubungi server. Periksa koneksi Anda.',
      statusCode: error.response?.statusCode,
    );
  }

  Future<Map<String, dynamic>> _request(
    Future<Response<dynamic>> Function(Options options) send, {
    bool required = false,
  }) async {
    final options = await _options(required: required);
    try {
      return _data(await send(options));
    } on DioException catch (error) {
      throw _error(error);
    }
  }

  Future<Options> _authOptions() => _options(required: true);

  // ------------------------------------------------------------------ feed
  @override
  Future<FeedPage> fetchFeed({
    required PostType type,
    String? categorySlug,
    String query = '',
    int page = 1,
    int pageSize = 8,
  }) async {
    final categoryId = categorySlug == null ? null : await _categoryId(categorySlug);
    final response = await _request(
      (options) => _dio.get<dynamic>(
        '/listings',
        queryParameters: {
          'post_type': type.value,
          'page': page,
          'limit': pageSize,
          'lat': AppConfig.defaultSearchLat,
          'lng': AppConfig.defaultSearchLng,
          'category_id': ?categoryId,
          if (query.trim().isNotEmpty) 'q': query.trim(),
        },
        options: options,
      ),
    );

    final raw = (response['listings'] as List<dynamic>? ?? const []);
    final items = raw
        .whereType<Map<String, dynamic>>()
        .map(_listing)
        .toList(growable: false);

    return FeedPage(
      items: items,
      hasMore: items.length >= pageSize,
      total: items.length + (page - 1) * pageSize,
    );
  }

  @override
  Future<Listing?> fetchListing(String id) async {
    try {
      final response = await _request(
        (options) => _dio.get<dynamic>(
          '/listings/$id',
          queryParameters: {
            'lat': AppConfig.defaultSearchLat,
            'lng': AppConfig.defaultSearchLng,
          },
          options: options,
        ),
      );
      final listing = response['listing'];
      if (listing is Map<String, dynamic>) {
        return _listing(listing);
      }
      return null;
    } on RepositoryException catch (error) {
      if (error.statusCode == 404) {
        return null;
      }
      rethrow;
    }
  }

  @override
  Future<List<Listing>> fetchSellerListings(String sellerId) async {
    final response = await _request(
      (options) => _dio.get<dynamic>(
        '/listings',
        queryParameters: {
          'seller_id': sellerId,
          'post_type': 'sell',
          'limit': 20,
          'lat': AppConfig.defaultSearchLat,
          'lng': AppConfig.defaultSearchLng,
        },
        options: options,
      ),
    );
    return (response['listings'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(_listing)
        .toList(growable: false);
  }

  // ------------------------------------------------------------ categories
  Future<List<Category>> categories() async {
    if (_categories != null) {
      return _categories!;
    }
    final response = await _request(
      (options) => _dio.get<dynamic>('/categories', options: options),
    );
    final items = (response['categories'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(
          (json) => Category(
            id: json['id'] as String,
            name: json['name'] as String? ?? '',
            slug: json['slug'] as String? ?? '',
            type: PostType.fromValue(json['post_type'] as String? ?? 'sell'),
          ),
        )
        .toList(growable: false);
    _categories = items;
    for (final category in items) {
      _categoryIds[category.slug] = category.id;
    }
    return items;
  }

  Future<String?> _categoryId(String slug) async {
    if (!_categoryIds.containsKey(slug)) {
      await categories();
    }
    return _categoryIds[slug];
  }

  // ------------------------------------------------------------------ chat
  @override
  Future<Conversation> openConversation(String listingId) async {
    final response = await _request(
      (options) => _dio.post<dynamic>(
        '/me/conversations',
        data: {'listing_id': listingId},
        options: options,
      ),
      required: true,
    );
    return _conversation(response);
  }

  @override
  Future<void> appendMessage(
    String conversationId,
    ChatMessage message, {
    String? preview,
  }) async {
    if (message.type != MessageType.text || (message.text ?? '').isEmpty) {
      return;
    }
    final options = await _authOptions();
    try {
      await _dio.post<dynamic>(
        '/me/conversations/$conversationId/messages',
        data: {'text': message.text},
        options: options,
      );
    } on DioException catch (error) {
      throw _error(error);
    }
  }

  @override
  Future<List<Conversation>> fetchConversations() async {
    final options = await _options();
    List<Map<String, dynamic>> rows;
    try {
      final response = await _dio.get<dynamic>('/me/conversations', options: options);
      rows = (_data(response)['items'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .toList(growable: false);
    } on DioException catch (error) {
      if (error.response?.statusCode == 401) {
        return const [];
      }
      throw _error(error);
    }

    final detailed = await Future.wait(
      rows.take(30).map((row) async {
        if ((row['messages'] as List<dynamic>? ?? const []).isNotEmpty) {
          return row;
        }
        try {
          final response = await _dio.get<dynamic>(
            '/me/conversations/${row['id']}',
            options: options,
          );
          return _data(response);
        } on DioException {
          return row;
        }
      }),
    );

    return detailed.map(_conversation).toList(growable: false);
  }

  // ------------------------------------------------------------- favorites
  @override
  Future<List<Listing>> fetchFavorites() async {
    final options = await _options();
    try {
      final response = await _dio.get<dynamic>(
        '/me/favorites',
        queryParameters: {
          'lat': AppConfig.defaultSearchLat,
          'lng': AppConfig.defaultSearchLng,
          'limit': 50,
        },
        options: options,
      );
      return (_data(response)['listings'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(_listing)
          .toList(growable: false);
    } on DioException catch (error) {
      if (error.response?.statusCode == 401) {
        return const [];
      }
      throw _error(error);
    }
  }

  @override
  Future<void> setFavorite(String listingId, bool favorite) async {
    final options = await _authOptions();
    try {
      if (favorite) {
        await _dio.post<dynamic>('/listings/$listingId/favorite', options: options);
      } else {
        await _dio.delete<dynamic>('/listings/$listingId/favorite', options: options);
      }
    } on DioException catch (error) {
      throw _error(error);
    }
  }

  // ------------------------------------------------------------ my listings
  @override
  Future<List<Listing>> fetchMyListings() async {
    final options = await _options();
    try {
      final response = await _dio.get<dynamic>(
        '/me/listings',
        queryParameters: {'limit': 50},
        options: options,
      );
      return (_data(response)['listings'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(_listing)
          .toList(growable: false);
    } on DioException catch (error) {
      if (error.response?.statusCode == 401) {
        return const [];
      }
      throw _error(error);
    }
  }

  @override
  Future<Listing> createListing(PostDraft draft, {bool asDraft = false}) async {
    final options = await _authOptions();
    final categoryId = await _categoryId(draft.categorySlug);
    try {
      final response = await _dio.post<dynamic>(
        '/listings',
        data: {
          'post_type': draft.type.value,
          'title': draft.title,
          'description': draft.description,
          'status': asDraft ? 'draft' : 'active',
          'lat': AppConfig.defaultSearchLat,
          'lng': AppConfig.defaultSearchLng,
          'category_id': ?categoryId,
          if (draft.price != null) 'price': draft.price,
          if (draft.priceType != null) 'price_type': draft.priceType!.name,
          if (draft.condition != null) 'condition': draft.condition!.name,
          if (draft.brand != null) 'brand': draft.brand,
          if (draft.eventStart != null) 'event_start': draft.eventStart!.toIso8601String(),
          if (draft.eventEnd != null) 'event_end': draft.eventEnd!.toIso8601String(),
          if (draft.eventLocation != null) 'event_location': draft.eventLocation,
          'event_is_free': draft.eventIsFree,
          if (draft.informationLink != null) 'information_link': draft.informationLink,
        },
        options: options,
      );
      final created = (_data(response)['listing'] as Map<String, dynamic>?) ?? const {};
      final listing = _listing(created);

      for (final dataUrl in draft.imageUrls) {
        await _uploadImage(listing.id, dataUrl, options);
      }
      return listing;
    } on DioException catch (error) {
      throw _error(error);
    }
  }

  Future<void> _uploadImage(String listingId, String dataUrl, Options options) async {
    final match = RegExp(r'^data:([^;]+);base64,(.*)$', dotAll: true).firstMatch(dataUrl);
    if (match == null) {
      return;
    }
    final bytes = base64Decode(match.group(2)!);
    final extension = (match.group(1) ?? 'image/jpeg').split('/').last;
    final form = FormData.fromMap({
      'file': MultipartFile.fromBytes(bytes, filename: 'foto.$extension'),
    });
    try {
      await _dio.post<dynamic>('/listings/$listingId/images', data: form, options: options);
    } on DioException catch (error) {
      throw _error(error);
    }
  }

  @override
  Future<void> updateListingStatus(String listingId, ListingStatus status) async {
    final options = await _authOptions();
    try {
      await _dio.patch<dynamic>(
        '/listings/$listingId',
        data: {'status': status.value},
        options: options,
      );
    } on DioException catch (error) {
      throw _error(error);
    }
  }

  @override
  Future<void> deleteListing(String listingId) async {
    final options = await _authOptions();
    try {
      await _dio.delete<dynamic>('/listings/$listingId', options: options);
    } on DioException catch (error) {
      throw _error(error);
    }
  }

  // -------------------------------------------------------- reviews/notifs
  @override
  Future<List<Review>> fetchReviews() async {
    final options = await _options();
    try {
      final response = await _dio.get<dynamic>('/me/reviews', options: options);
      return (_data(response)['items'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(
            (json) => Review(
              id: json['id'] as String,
              authorName: json['author_name'] as String? ?? 'Pengguna',
              authorAvatar: json['author_avatar'] as String? ?? '',
              rating: (json['rating'] as num?)?.round() ?? 0,
              comment: json['comment'] as String? ?? '',
              createdAt: _date(json['created_at']),
            ),
          )
          .toList(growable: false);
    } on DioException catch (error) {
      if (error.response?.statusCode == 401) {
        return const [];
      }
      throw _error(error);
    }
  }

  @override
  Future<List<AppNotification>> fetchNotifications() async {
    final options = await _options();
    try {
      final response = await _dio.get<dynamic>('/me/notifications', options: options);
      return (_data(response)['items'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(
            (json) => AppNotification(
              id: json['id'] as String,
              title: json['title'] as String? ?? '',
              body: json['body'] as String? ?? '',
              type: json['type'] as String? ?? 'info',
              createdAt: _date(json['created_at']),
              read: json['read'] == true,
            ),
          )
          .toList(growable: false);
    } on DioException catch (error) {
      if (error.response?.statusCode == 401) {
        return const [];
      }
      throw _error(error);
    }
  }

  @override
  Future<void> markNotificationsRead() async {
    final options = await _authOptions();
    try {
      await _dio.post<dynamic>('/me/notifications/read-all', options: options);
    } on DioException catch (error) {
      throw _error(error);
    }
  }

  @override
  Future<void> markNotificationRead(String id) async {
    final options = await _authOptions();
    try {
      await _dio.post<dynamic>('/me/notifications/$id/read', options: options);
    } on DioException catch (error) {
      throw _error(error);
    }
  }

  // --------------------------------------------------------------- mapping
  DateTime _date(Object? value) {
    final parsed = DateTime.tryParse(value as String? ?? '');
    return parsed?.toLocal() ?? DateTime.now();
  }

  Listing _listing(Map<String, dynamic> json) {
    final seller = (json['seller'] as Map<String, dynamic>?) ?? const {};
    final category = json['category'];
    final images = (json['images'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(
          (image) => ListingImage(
            url: image['url'] as String? ?? '',
            thumbUrl: image['thumbnail_url'] as String? ?? image['url'] as String? ?? '',
          ),
        )
        .toList(growable: false);

    return Listing(
      id: json['id'] as String,
      type: PostType.fromValue(json['post_type'] as String? ?? 'sell'),
      title: json['title'] as String? ?? '',
      description: json['description'] as String? ?? '',
      categoryName: category is Map<String, dynamic>
          ? (category['name'] as String? ?? 'Umum')
          : 'Umum',
      categorySlug: category is Map<String, dynamic>
          ? (category['slug'] as String? ?? '')
          : '',
      distanceMeters: (json['distance_m'] as num?)?.round() ?? 0,
      areaLabel: json['area_label'] as String? ?? '',
      publishedAt: _date(json['published_at'] ?? json['created_at']),
      images: images,
      seller: Seller(
        id: seller['id'] as String? ?? '',
        username: seller['username'] as String? ?? '',
        displayName: seller['display_name'] as String? ?? seller['username'] as String? ?? '',
        avatarUrl: seller['avatar_url'] as String? ?? '',
        areaLabel: seller['area_label'] as String? ?? '',
        rating: 0,
        reviewCount: 0,
        isVerified: seller['is_verified'] == true,
        joinedAt: _date(seller['joined_at']),
        listingCount: (seller['listing_count'] as num?)?.toInt() ?? 0,
      ),
      price: (json['price'] as num?)?.round(),
      priceType: switch (json['price_type']) {
        'fixed' => PriceType.fixed,
        'negotiable' => PriceType.negotiable,
        _ => null,
      },
      condition: switch (json['condition']) {
        'new' => ItemCondition.baru,
        'used' => ItemCondition.bekas,
        _ => null,
      },
      status: ListingStatus.values.firstWhere(
        (value) => value.value == (json['status'] as String? ?? 'active'),
        orElse: () => ListingStatus.active,
      ),
      favoriteCount: (json['favorite_count'] as num?)?.round() ?? 0,
      participantCount: (json['participant_count'] as num?)?.round() ?? 0,
      eventStart: json['event_start'] == null ? null : _date(json['event_start']),
      eventEnd: json['event_end'] == null ? null : _date(json['event_end']),
      eventLocation: json['event_location'] as String?,
      eventIsFree: json['event_is_free'] != false,
      eventLink: json['event_link'] as String?,
      informationLink: json['information_link'] as String?,
      brand: json['brand'] as String?,
      isFavorite: json['is_favorite'] == true,
      viewCount: (json['view_count'] as num?)?.round() ?? 0,
    );
  }

  Conversation _conversation(Map<String, dynamic> json) {
    final messages = (json['messages'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(
          (message) => ChatMessage(
            id: message['id'] as String,
            senderIsMe: message['sender_is_me'] == true,
            type: MessageType.values.firstWhere(
              (value) => value.name == (message['type'] as String? ?? 'text'),
              orElse: () => MessageType.text,
            ),
            createdAt: _date(message['created_at']),
            text: message['text'] as String?,
            imageUrl: message['image_url'] as String?,
            read: message['read'] == true,
          ),
        )
        .toList(growable: false);

    return Conversation(
      id: json['id'] as String,
      listingId: json['listing_id'] as String? ?? '',
      listingTitle: json['listing_title'] as String? ?? '',
      listingImage: json['listing_image'] as String? ?? '',
      otherName: json['other_name'] as String? ?? 'Pengguna',
      otherAvatar: json['other_avatar'] as String? ?? '',
      otherUsername: json['other_username'] as String? ?? '',
      lastMessage: json['last_message'] as String? ?? '',
      updatedAt: _date(json['updated_at']),
      messages: messages,
      unread: (json['unread'] as num?)?.round() ?? 0,
      iAmSeller: json['i_am_seller'] == true,
      listingPrice: (json['listing_price'] as num?)?.round(),
    );
  }
}
