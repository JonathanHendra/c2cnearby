# Sequelize Model Associations

All associations are registered in `backend/src/database/associations.ts` by a single exported
function `initializeAssociations(models)`. It is called exactly once after all models are
registered in `backend/src/database/models/index.ts`. No model imports another model and no
controller/service defines associations.

Every association uses:

```ts
{
  foreignKey: 'user_id',
  as: 'listings',
  constraints: false,
}
```

`constraints: false` prevents Sequelize from creating or altering foreign keys at runtime.
Referential integrity is owned by migrations (see `DATABASE_MIGRATIONS.md`).

## Alias table

| Source | Target | Type | FK | Alias |
| --- | --- | --- | --- | --- |
| User | UserLocation | hasOne | user_id | location |
| UserLocation | User | belongsTo | user_id | user |
| User | UserVerification | hasMany | user_id | verifications |
| UserVerification | User | belongsTo | user_id | user |
| User | Listing | hasMany | user_id | listings |
| Listing | User | belongsTo | user_id | seller |
| Category | Listing | hasMany | category_id | listings |
| Listing | Category | belongsTo | category_id | category |
| Listing | ListingImage | hasMany | listing_id | images |
| ListingImage | Listing | belongsTo | listing_id | listing |
| User | Favorite | hasMany | user_id | favorites |
| Listing | Favorite | hasMany | listing_id | favorites |
| Favorite | User | belongsTo | user_id | user |
| Favorite | Listing | belongsTo | listing_id | listing |
| Listing | Conversation | hasMany | listing_id | conversations |
| Conversation | Listing | belongsTo | listing_id | listing |
| User | Conversation | hasMany | buyer_id | conversationsAsBuyer |
| User | Conversation | hasMany | seller_id | conversationsAsSeller |
| Conversation | User | belongsTo | buyer_id | buyer |
| Conversation | User | belongsTo | seller_id | seller |
| Conversation | Message | hasMany | conversation_id | messages |
| Message | Conversation | belongsTo | conversation_id | conversation |
| Message | User | belongsTo | sender_id | sender |
| Conversation | PriceOffer | hasMany | conversation_id | offers |
| PriceOffer | Conversation | belongsTo | conversation_id | conversation |
| Listing | PriceOffer | hasMany | listing_id | offers |
| PriceOffer | Listing | belongsTo | listing_id | listing |
| PriceOffer | User | belongsTo | sender_id | sender |
| PriceOffer | User | belongsTo | receiver_id | receiver |
| Conversation | TransactionAgreement | hasOne | conversation_id | agreement |
| TransactionAgreement | Conversation | belongsTo | conversation_id | conversation |
| Listing | TransactionAgreement | hasOne | listing_id | agreement |
| TransactionAgreement | Listing | belongsTo | listing_id | listing |
| User | TransactionAgreement | hasMany | buyer_id | agreementsAsBuyer |
| User | TransactionAgreement | hasMany | seller_id | agreementsAsSeller |
| TransactionAgreement | User | belongsTo | buyer_id | buyer |
| TransactionAgreement | User | belongsTo | seller_id | seller |
| Listing | EventParticipant | hasMany | event_listing_id | participants |
| EventParticipant | Listing | belongsTo | event_listing_id | event |
| User | EventParticipant | hasMany | user_id | eventParticipations |
| EventParticipant | User | belongsTo | user_id | user |
| Listing | Review | hasMany | listing_id | reviews |
| Review | Listing | belongsTo | listing_id | listing |
| User | Review | hasMany | reviewer_id | reviewsWritten |
| User | Review | hasMany | reviewee_id | reviewsReceived |
| Review | User | belongsTo | reviewer_id | reviewer |
| Review | User | belongsTo | reviewee_id | reviewee |
| User | Report | hasMany | reporter_id | reportsFiled |
| User | Report | hasMany | reported_user_id | reportsReceived |
| Report | User | belongsTo | reporter_id | reporter |
| Report | User | belongsTo | reported_user_id | reportedUser |
| Listing | Report | hasMany | listing_id | reports |
| Report | Listing | belongsTo | listing_id | listing |
| AdminUser | Report | hasMany | handled_by_admin_id | handledReports |
| Report | AdminUser | belongsTo | handled_by_admin_id | handledBy |
| User | UserBlock | hasMany | blocker_id | blocksCreated |
| User | UserBlock | hasMany | blocked_id | blocksReceived |
| UserBlock | User | belongsTo | blocker_id | blocker |
| UserBlock | User | belongsTo | blocked_id | blocked |
| User | Notification | hasMany | user_id | notifications |
| Notification | User | belongsTo | user_id | user |
| User | DeviceToken | hasMany | user_id | deviceTokens |
| DeviceToken | User | belongsTo | user_id | user |
| User | NotificationPreference | hasMany | user_id | notificationPreferences |
| NotificationPreference | User | belongsTo | user_id | user |
| AdminUser | AdminAuditLog | hasMany | admin_id | auditLogs |
| AdminAuditLog | AdminUser | belongsTo | admin_id | admin |
| AdminUser | AppSetting | hasMany | updated_by_admin_id | updatedSettings |
| AppSetting | AdminUser | belongsTo | updated_by_admin_id | updatedBy |

## Initialization contract

```ts
// database/index.ts (excerpt)
const sequelize = createSequelize(config);
const models = initializeModels(sequelize);      // registers every model once
initializeAssociations(models);                  // idempotent guard inside
await sequelize.authenticate();
await checkMigrationStatus();
```

- `initializeAssociations` must remain idempotent (guard with a module-level flag) so tests that
  recreate the container do not duplicate associations.
- Includes always use explicit `as` aliases; services must not rely on implicit names.
- Association includes are curated per query to prevent over-fetching. Private columns
  (`phone_private`, `location_private`) are excluded via `attributes` allow-lists.

## Tests

`backend/test/database/associations.test.ts` must assert:

1. Every model in the registry is initialized.
2. Every documented alias resolves (`Model.associations[alias]` exists).
3. Initializing twice does not throw or duplicate.
4. No SQL is emitted during association initialization (spy on `sequelize.query`).
5. A representative include (`Listing` → `images`, `seller`) produces a join with the expected
   alias.
