# Plot Twist Security Specification & ABAC Threat Model

## 1. Data Invariants
1. **User Profile Isolation**: Only the authenticated user matching `{userId}` can read or write their own user profile document in `/users/{userId}`.
2. **Identity Integrity**: `userId` field inside any written document (`savedMedia`, `swipeHistory`, etc.) must strictly equal `request.auth.uid`. No user can spoof or impersonate another user's identifier.
3. **Data Boundary Enforcement**: All string inputs (titles, IDs, names, codes) must have strict maximum lengths (`.size() <= MAX`) to prevent Denial of Wallet resource attacks.
4. **Library Segregation**: A user can only create, read, update, or delete their own `savedMedia` documents. Query listing is strictly guarded by `resource.data.userId == request.auth.uid`.
5. **Swipe History Immutability & Ownership**: Only the swiping user can create or update their swipe record (`active` vs `reversed`). Cannot overwrite or tamper with other users' swipe decks.
6. **Group Membership & Authorization**: Users can only read group documents where `request.auth.uid in resource.data.memberIds` or when looking up by `inviteCode`. Only group owners or members can perform valid group operations.
7. **No Anonymous Privilege Escalation**: Operations require authenticated users.

## 2. The "Dirty Dozen" Threat Payloads
1. **Payload 1 (ID Spoofing in Profile)**: Non-owner tries to update `/users/victim_user_123` with `displayName: 'Hacker'`.
2. **Payload 2 (Shadow Field Injection in Profile)**: Adding an unapproved system-level field `isAdmin: true` or `unauthorizedField: 'evil'`.
3. **Payload 3 (Impersonating Media Owner)**: User Alice writing to `/savedMedia/doc_1` with `userId: 'bob_victim_456'`.
4. **Payload 4 (Massive Denial of Wallet String)**: Writing a `title` or `notes` containing 2MB of junk text to exhaust storage or bandwidth.
5. **Payload 5 (Unauthenticated Profile Read)**: Guest or unauthenticated client attempting to scrape `/users/{userId}`.
6. **Payload 6 (Cross-User List Query Scraping)**: Malicious client running `getDocs(collection(db, 'savedMedia'))` without `where('userId', '==', auth.uid)`.
7. **Payload 7 (Swipe History Hijacking)**: User Alice attempting to change Bob's swipe history from `pass` to `interested`.
8. **Payload 8 (Invalid Enum Injection)**: Submitting `status: 'super_admin_status'` in `savedMedia` instead of allowed statuses.
9. **Payload 9 (Forged Document ID Injection)**: Attempting to create a document with an ID containing malicious path traversal or junk characters.
10. **Payload 10 (Group Owner Tampering)**: Group member trying to change the `ownerId` of `/groups/{groupId}` to themselves.
11. **Payload 11 (Non-Member Reading Private Group)**: Non-member attempting to read `/groups/{groupId}` data without belonging to `memberIds`.
12. **Payload 12 (Unauthorized Deletion)**: User Alice trying to delete Bob's watchlist item in `/savedMedia/bob_item`.

All 12 vectors must be blocked with `PERMISSION_DENIED`.
