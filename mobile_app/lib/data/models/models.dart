import 'package:flutter/foundation.dart';

enum PostType {
  sell('sell', 'Jual'),
  event('event', 'Event'),
  information('information', 'Informasi');

  const PostType(this.value, this.label);
  final String value;
  final String label;

  static PostType fromValue(String value) =>
      values.firstWhere((t) => t.value == value, orElse: () => sell);
}

enum ListingStatus {
  draft('draft', 'Draft'),
  active('active', 'Aktif'),
  hidden('hidden', 'Disembunyikan'),
  sold('sold', 'Terjual'),
  completed('completed', 'Selesai'),
  rejected('rejected', 'Ditolak'),
  expired('expired', 'Kedaluwarsa');

  const ListingStatus(this.value, this.label);
  final String value;
  final String label;
}

enum PriceType {
  fixed('fixed', 'Harga tetap'),
  negotiable('negotiable', 'Bisa nego');

  const PriceType(this.value, this.label);
  final String value;
  final String label;
}

enum ItemCondition {
  baru('new', 'Baru'),
  bekas('used', 'Bekas');

  const ItemCondition(this.value, this.label);
  final String value;
  final String label;
}

enum OfferStatus { pending, accepted, rejected, withdrawn }

enum MessageType { text, image, offer, meetup, system }

@immutable
class Category {
  const Category({
    required this.id,
    required this.name,
    required this.slug,
    required this.type,
  });

  final String id;
  final String name;
  final String slug;
  final PostType type;
}

@immutable
class Seller {
  const Seller({
    required this.id,
    required this.username,
    required this.displayName,
    required this.avatarUrl,
    required this.areaLabel,
    required this.rating,
    required this.reviewCount,
    required this.isVerified,
    required this.joinedAt,
    this.listingCount = 0,
  });

  final String id;
  final String username;
  final String displayName;
  final String avatarUrl;
  final String areaLabel;
  final double rating;
  final int reviewCount;
  final bool isVerified;
  final DateTime joinedAt;
  final int listingCount;
}

@immutable
class ListingImage {
  const ListingImage({required this.url, required this.thumbUrl});

  final String url;
  final String thumbUrl;
}

@immutable
class Listing {
  const Listing({
    required this.id,
    required this.type,
    required this.title,
    required this.description,
    required this.categoryName,
    required this.categorySlug,
    required this.distanceMeters,
    required this.areaLabel,
    required this.publishedAt,
    required this.images,
    required this.seller,
    this.price,
    this.priceType,
    this.condition,
    this.status = ListingStatus.active,
    this.favoriteCount = 0,
    this.participantCount = 0,
    this.eventStart,
    this.eventEnd,
    this.eventLocation,
    this.eventIsFree = true,
    this.eventLink,
    this.informationLink,
    this.brand,
    this.isFavorite = false,
    this.viewCount = 0,
  });

  final String id;
  final PostType type;
  final String title;
  final String description;
  final String categoryName;
  final String categorySlug;
  final int distanceMeters;
  final String areaLabel;
  final DateTime publishedAt;
  final List<ListingImage> images;
  final Seller seller;
  final int? price;
  final PriceType? priceType;
  final ItemCondition? condition;
  final ListingStatus status;
  final int favoriteCount;
  final int participantCount;
  final DateTime? eventStart;
  final DateTime? eventEnd;
  final String? eventLocation;
  final bool eventIsFree;
  final String? eventLink;
  final String? informationLink;
  final String? brand;
  final bool isFavorite;
  final int viewCount;

  Listing copyWith({
    bool? isFavorite,
    int? favoriteCount,
    ListingStatus? status,
    int? participantCount,
    bool? isJoined,
  }) {
    return Listing(
      id: id,
      type: type,
      title: title,
      description: description,
      categoryName: categoryName,
      categorySlug: categorySlug,
      distanceMeters: distanceMeters,
      areaLabel: areaLabel,
      publishedAt: publishedAt,
      images: images,
      seller: seller,
      price: price,
      priceType: priceType,
      condition: condition,
      status: status ?? this.status,
      favoriteCount: favoriteCount ?? this.favoriteCount,
      participantCount: participantCount ?? this.participantCount,
      eventStart: eventStart,
      eventEnd: eventEnd,
      eventLocation: eventLocation,
      eventIsFree: eventIsFree,
      eventLink: eventLink,
      informationLink: informationLink,
      brand: brand,
      isFavorite: isFavorite ?? this.isFavorite,
      viewCount: viewCount,
    );
  }
}

@immutable
class PriceOffer {
  const PriceOffer({
    required this.id,
    required this.amount,
    required this.status,
    required this.senderIsMe,
    required this.createdAt,
  });

  final String id;
  final int amount;
  final OfferStatus status;
  final bool senderIsMe;
  final DateTime createdAt;

  PriceOffer copyWith({OfferStatus? status}) => PriceOffer(
        id: id,
        amount: amount,
        status: status ?? this.status,
        senderIsMe: senderIsMe,
        createdAt: createdAt,
      );
}

@immutable
class ChatMessage {
  const ChatMessage({
    required this.id,
    required this.senderIsMe,
    required this.type,
    required this.createdAt,
    this.text,
    this.imageUrl,
    this.offer,
    this.read = false,
  });

  final String id;
  final bool senderIsMe;
  final MessageType type;
  final DateTime createdAt;
  final String? text;
  final String? imageUrl;
  final PriceOffer? offer;
  final bool read;

  ChatMessage copyWith({PriceOffer? offer, bool? read}) => ChatMessage(
        id: id,
        senderIsMe: senderIsMe,
        type: type,
        createdAt: createdAt,
        text: text,
        imageUrl: imageUrl,
        offer: offer ?? this.offer,
        read: read ?? this.read,
      );
}

@immutable
class Conversation {
  const Conversation({
    required this.id,
    required this.listingId,
    required this.listingTitle,
    required this.listingImage,
    required this.otherName,
    required this.otherAvatar,
    required this.otherUsername,
    required this.lastMessage,
    required this.updatedAt,
    required this.messages,
    this.unread = 0,
    this.iAmSeller = false,
    this.listingPrice,
  });

  final String id;
  final String listingId;
  final String listingTitle;
  final String listingImage;
  final String otherName;
  final String otherAvatar;
  final String otherUsername;
  final String lastMessage;
  final DateTime updatedAt;
  final List<ChatMessage> messages;
  final int unread;
  final bool iAmSeller;
  final int? listingPrice;

  Conversation copyWith({
    List<ChatMessage>? messages,
    String? lastMessage,
    DateTime? updatedAt,
    int? unread,
  }) =>
      Conversation(
        id: id,
        listingId: listingId,
        listingTitle: listingTitle,
        listingImage: listingImage,
        otherName: otherName,
        otherAvatar: otherAvatar,
        otherUsername: otherUsername,
        lastMessage: lastMessage ?? this.lastMessage,
        updatedAt: updatedAt ?? this.updatedAt,
        messages: messages ?? this.messages,
        unread: unread ?? this.unread,
        iAmSeller: iAmSeller,
        listingPrice: listingPrice,
      );
}

@immutable
class Review {
  const Review({
    required this.id,
    required this.authorName,
    required this.authorAvatar,
    required this.rating,
    required this.comment,
    required this.createdAt,
  });

  final String id;
  final String authorName;
  final String authorAvatar;
  final int rating;
  final String comment;
  final DateTime createdAt;
}

@immutable
class AppNotification {
  const AppNotification({
    required this.id,
    required this.title,
    required this.body,
    required this.type,
    required this.createdAt,
    this.read = false,
  });

  final String id;
  final String title;
  final String body;
  final String type;
  final DateTime createdAt;
  final bool read;

  AppNotification copyWith({bool? read}) => AppNotification(
        id: id,
        title: title,
        body: body,
        type: type,
        createdAt: createdAt,
        read: read ?? this.read,
      );
}

@immutable
class CurrentUser {
  const CurrentUser({
    required this.username,
    required this.displayName,
    required this.avatarUrl,
    required this.areaLabel,
    required this.rating,
    required this.reviewCount,
    required this.joinedAt,
    required this.phoneVerified,
    required this.faceVerified,
    required this.listingCount,
    required this.favoriteCount,
  });

  final String username;
  final String displayName;
  final String avatarUrl;
  final String areaLabel;
  final double rating;
  final int reviewCount;
  final DateTime joinedAt;
  final bool phoneVerified;
  final bool faceVerified;
  final int listingCount;
  final int favoriteCount;
}
