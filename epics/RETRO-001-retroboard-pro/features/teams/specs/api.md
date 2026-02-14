# Teams API Specification

**Feature:** teams
**Base path:** `/api/v1/teams`
**Authentication:** All endpoints require a valid access token.

---

## Table of Contents

1. [POST /api/v1/teams](#1-post-apiv1teams)
2. [GET /api/v1/teams](#2-get-apiv1teams)
3. [GET /api/v1/teams/:id](#3-get-apiv1teamsid)
4. [PUT /api/v1/teams/:id](#4-put-apiv1teamsid)
5. [DELETE /api/v1/teams/:id](#5-delete-apiv1teamsid)
6. [GET /api/v1/teams/:id/members](#6-get-apiv1teamsidmembers)
7. [POST /api/v1/teams/:id/invitations](#7-post-apiv1teamsidinvitations)
8. [POST /api/v1/teams/join/:code](#8-post-apiv1teamsjoincode)
9. [PUT /api/v1/teams/:id/members/:userId](#9-put-apiv1teamsidmembersuserid)
10. [DELETE /api/v1/teams/:id/members/:userId](#10-delete-apiv1teamsidmembersuserid)
11. [Common Error Responses](#11-common-error-responses)
12. [Data Types](#12-data-types)

---

## 1. POST /api/v1/teams

Create a new team. The authenticated user becomes the team admin.

**Required role:** Any authenticated user (no team membership required -- creating a new team)

### Request

```
POST /api/v1/teams
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "name": "Sprint Warriors",
  "description": "Our agile team retrospectives",
  "avatar_url": "https://example.com/team-avatar.png"
}
```

### Validation Rules

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| name | string | Yes | Min 1 character. Max 100 characters. Trimmed. |
| description | string | No | Max 500 characters. Defaults to `null`. |
| avatar_url | string \| null | No | Valid URL format. Max 500 characters. Defaults to `null`. |

### Response: 201 Created

```json
{
  "team": {
    "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "name": "Sprint Warriors",
    "slug": "sprint-warriors",
    "description": "Our agile team retrospectives",
    "avatar_url": "https://example.com/team-avatar.png",
    "created_by": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "created_at": "2026-02-14T10:30:00.000Z",
    "updated_at": "2026-02-14T10:30:00.000Z",
    "member_count": 1,
    "your_role": "admin"
  }
}
```

### Error Responses

| Status | Code | Condition |
|--------|------|-----------|
| 400 | `VALIDATION_ERROR` | Missing or invalid fields |
| 401 | `AUTH_UNAUTHORIZED` | Not authenticated |
| 409 | `TEAM_SLUG_EXISTS` | Generated slug already taken (extremely rare with suffix logic) |

---

## 2. GET /api/v1/teams

List all teams the authenticated user belongs to.

**Required role:** Any authenticated user

### Request

```
GET /api/v1/teams
Authorization: Bearer <token>
```

### Query Parameters

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| page | number | No | 1 | Page number (1-based) |
| per_page | number | No | 20 | Items per page (max 100) |

### Response: 200 OK

```json
{
  "teams": [
    {
      "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
      "name": "Sprint Warriors",
      "slug": "sprint-warriors",
      "description": "Our agile team retrospectives",
      "avatar_url": "https://example.com/team-avatar.png",
      "created_by": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "created_at": "2026-02-14T10:30:00.000Z",
      "updated_at": "2026-02-14T10:30:00.000Z",
      "member_count": 5,
      "your_role": "admin"
    },
    {
      "id": "c3d4e5f6-a7b8-9012-cdef-234567890123",
      "name": "Backend Guild",
      "slug": "backend-guild",
      "description": null,
      "avatar_url": null,
      "created_by": "d4e5f6a7-b8c9-0123-def0-345678901234",
      "created_at": "2026-02-10T08:00:00.000Z",
      "updated_at": "2026-02-12T16:00:00.000Z",
      "member_count": 12,
      "your_role": "member"
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 2,
    "total_pages": 1
  }
}
```

### Error Responses

| Status | Code | Condition |
|--------|------|-----------|
| 401 | `AUTH_UNAUTHORIZED` | Not authenticated |

---

## 3. GET /api/v1/teams/:id

Get detailed information about a specific team.

**Required role:** member, facilitator, or admin (any team member)

### Request

```
GET /api/v1/teams/b2c3d4e5-f6a7-8901-bcde-f12345678901
Authorization: Bearer <token>
```

### Response: 200 OK

```json
{
  "team": {
    "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "name": "Sprint Warriors",
    "slug": "sprint-warriors",
    "description": "Our agile team retrospectives",
    "avatar_url": "https://example.com/team-avatar.png",
    "created_by": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "created_at": "2026-02-14T10:30:00.000Z",
    "updated_at": "2026-02-14T10:30:00.000Z",
    "member_count": 5,
    "your_role": "facilitator"
  }
}
```

### Error Responses

| Status | Code | Condition |
|--------|------|-----------|
| 401 | `AUTH_UNAUTHORIZED` | Not authenticated |
| 403 | `TEAM_NOT_MEMBER` | User is not a member of this team |
| 404 | `TEAM_NOT_FOUND` | Team does not exist |

---

## 4. PUT /api/v1/teams/:id

Update team details.

**Required role:** admin

### Request

```
PUT /api/v1/teams/b2c3d4e5-f6a7-8901-bcde-f12345678901
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "name": "Sprint Warriors v2",
  "description": "Updated team description",
  "avatar_url": "https://example.com/new-avatar.png"
}
```

### Validation Rules

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| name | string | No | Min 1 character. Max 100 characters. Trimmed. |
| description | string \| null | No | Max 500 characters. Pass `null` to clear. |
| avatar_url | string \| null | No | Valid URL or `null` to clear. Max 500 characters. |

At least one field must be provided. The slug is NOT updated when the name changes (slug is immutable).

### Response: 200 OK

```json
{
  "team": {
    "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "name": "Sprint Warriors v2",
    "slug": "sprint-warriors",
    "description": "Updated team description",
    "avatar_url": "https://example.com/new-avatar.png",
    "created_by": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "created_at": "2026-02-14T10:30:00.000Z",
    "updated_at": "2026-02-14T15:00:00.000Z",
    "member_count": 5,
    "your_role": "admin"
  }
}
```

### Error Responses

| Status | Code | Condition |
|--------|------|-----------|
| 400 | `VALIDATION_ERROR` | No valid fields provided or invalid values |
| 401 | `AUTH_UNAUTHORIZED` | Not authenticated |
| 403 | `TEAM_INSUFFICIENT_ROLE` | User is not an admin |
| 403 | `TEAM_NOT_MEMBER` | User is not a member of this team |
| 404 | `TEAM_NOT_FOUND` | Team does not exist |

---

## 5. DELETE /api/v1/teams/:id

Delete a team and all associated data (sprints, boards, cards, etc.).

**Required role:** admin

### Request

```
DELETE /api/v1/teams/b2c3d4e5-f6a7-8901-bcde-f12345678901
Authorization: Bearer <token>
```

### Response: 200 OK

```json
{
  "message": "Team deleted successfully"
}
```

### Error Responses

| Status | Code | Condition |
|--------|------|-----------|
| 401 | `AUTH_UNAUTHORIZED` | Not authenticated |
| 403 | `TEAM_INSUFFICIENT_ROLE` | User is not an admin |
| 403 | `TEAM_NOT_MEMBER` | User is not a member |
| 404 | `TEAM_NOT_FOUND` | Team does not exist |

---

## 6. GET /api/v1/teams/:id/members

List all members of a team with their roles.

**Required role:** member, facilitator, or admin (any team member)

### Request

```
GET /api/v1/teams/b2c3d4e5-f6a7-8901-bcde-f12345678901/members
Authorization: Bearer <token>
```

### Response: 200 OK

```json
{
  "members": [
    {
      "user": {
        "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "email": "alice@example.com",
        "display_name": "Alice Johnson",
        "avatar_url": "https://example.com/avatars/alice.jpg"
      },
      "role": "admin",
      "joined_at": "2026-02-14T10:30:00.000Z"
    },
    {
      "user": {
        "id": "d4e5f6a7-b8c9-0123-def0-345678901234",
        "email": "bob@example.com",
        "display_name": "Bob Smith",
        "avatar_url": null
      },
      "role": "facilitator",
      "joined_at": "2026-02-14T11:00:00.000Z"
    },
    {
      "user": {
        "id": "e5f6a7b8-c9d0-1234-ef01-456789012345",
        "email": "charlie@example.com",
        "display_name": "Charlie Brown",
        "avatar_url": null
      },
      "role": "member",
      "joined_at": "2026-02-14T12:00:00.000Z"
    }
  ]
}
```

Members are sorted by role priority (admin first, then facilitator, then member) and then by `joined_at` ascending within each role.

### Error Responses

| Status | Code | Condition |
|--------|------|-----------|
| 401 | `AUTH_UNAUTHORIZED` | Not authenticated |
| 403 | `TEAM_NOT_MEMBER` | User is not a member |
| 404 | `TEAM_NOT_FOUND` | Team does not exist |

---

## 7. POST /api/v1/teams/:id/invitations

Create a new invitation link for the team.

**Required role:** admin or facilitator

### Request

```
POST /api/v1/teams/b2c3d4e5-f6a7-8901-bcde-f12345678901/invitations
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "expires_in_hours": 168,
  "max_uses": 10
}
```

### Validation Rules

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| expires_in_hours | number | No | Min 1. Max 720 (30 days). Default: 168 (7 days). |
| max_uses | number \| null | No | Min 1. Max 1000. Default: `null` (unlimited). |

### Response: 201 Created

```json
{
  "invitation": {
    "id": "f6a7b8c9-d0e1-2345-f012-567890123456",
    "team_id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "code": "aBcDeFgHiJkL",
    "invite_url": "https://retroboard.example.com/join/aBcDeFgHiJkL",
    "created_by": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "expires_at": "2026-02-21T10:30:00.000Z",
    "max_uses": 10,
    "use_count": 0,
    "created_at": "2026-02-14T10:30:00.000Z"
  }
}
```

The `code` is a 12-character alphanumeric string (a-z, A-Z, 0-9). The `invite_url` is constructed by the API using the configured app base URL.

### Error Responses

| Status | Code | Condition |
|--------|------|-----------|
| 400 | `VALIDATION_ERROR` | Invalid field values |
| 401 | `AUTH_UNAUTHORIZED` | Not authenticated |
| 403 | `TEAM_INSUFFICIENT_ROLE` | User is not admin or facilitator |
| 403 | `TEAM_NOT_MEMBER` | User is not a member |
| 404 | `TEAM_NOT_FOUND` | Team does not exist |

---

## 8. POST /api/v1/teams/join/:code

Join a team using an invitation code.

**Required role:** Any authenticated user (not yet a member of the team)

### Request

```
POST /api/v1/teams/join/aBcDeFgHiJkL
Authorization: Bearer <token>
```

No request body required. The invite code is in the URL path.

### Response: 200 OK

```json
{
  "team": {
    "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "name": "Sprint Warriors",
    "slug": "sprint-warriors",
    "description": "Our agile team retrospectives",
    "avatar_url": "https://example.com/team-avatar.png",
    "created_by": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "created_at": "2026-02-14T10:30:00.000Z",
    "updated_at": "2026-02-14T10:30:00.000Z",
    "member_count": 6,
    "your_role": "member"
  },
  "membership": {
    "role": "member",
    "joined_at": "2026-02-14T14:00:00.000Z"
  }
}
```

### Behavior

1. Look up invitation by code.
2. Validate the invitation exists, is not expired, and has not exceeded `max_uses`.
3. Check that the user is not already a member of the team.
4. In a transaction: insert into `team_members` with `role = 'member'` and increment `use_count` on the invitation.
5. Return the team and membership details.

### Error Responses

| Status | Code | Condition |
|--------|------|-----------|
| 401 | `AUTH_UNAUTHORIZED` | Not authenticated |
| 404 | `TEAM_INVITE_NOT_FOUND` | Invite code does not exist |
| 409 | `TEAM_MEMBER_EXISTS` | User is already a member of this team |
| 410 | `TEAM_INVITE_EXPIRED` | Invitation has expired |
| 410 | `TEAM_INVITE_EXHAUSTED` | Invitation has reached max_uses |

---

## 9. PUT /api/v1/teams/:id/members/:userId

Update a team member's role.

**Required role:** admin

### Request

```
PUT /api/v1/teams/b2c3d4e5-f6a7-8901-bcde-f12345678901/members/d4e5f6a7-b8c9-0123-def0-345678901234
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "role": "facilitator"
}
```

### Validation Rules

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| role | string | Yes | Must be one of: `"admin"`, `"facilitator"`, `"member"` |

### Response: 200 OK

```json
{
  "member": {
    "user": {
      "id": "d4e5f6a7-b8c9-0123-def0-345678901234",
      "email": "bob@example.com",
      "display_name": "Bob Smith",
      "avatar_url": null
    },
    "role": "facilitator",
    "joined_at": "2026-02-14T11:00:00.000Z"
  }
}
```

### Special Rules

- An admin cannot demote themselves if they are the last admin. Returns `TEAM_LAST_ADMIN`.
- An admin can promote a member to admin (there can be multiple admins).
- An admin can demote another admin to facilitator or member.

### Error Responses

| Status | Code | Condition |
|--------|------|-----------|
| 400 | `VALIDATION_ERROR` | Invalid role value |
| 400 | `TEAM_LAST_ADMIN` | Cannot demote the last admin |
| 401 | `AUTH_UNAUTHORIZED` | Not authenticated |
| 403 | `TEAM_INSUFFICIENT_ROLE` | User is not an admin |
| 403 | `TEAM_NOT_MEMBER` | Requesting user is not a member |
| 404 | `TEAM_NOT_FOUND` | Team does not exist |
| 404 | `TEAM_NOT_FOUND` | Target user is not a member of this team |

---

## 10. DELETE /api/v1/teams/:id/members/:userId

Remove a member from the team. For self-removal (leaving the team), the `:userId` matches the authenticated user's ID.

**Required role:** admin (to remove others), any member (to remove self)

### Request

```
DELETE /api/v1/teams/b2c3d4e5-f6a7-8901-bcde-f12345678901/members/d4e5f6a7-b8c9-0123-def0-345678901234
Authorization: Bearer <token>
```

### Response: 200 OK

```json
{
  "message": "Member removed successfully"
}
```

### Special Rules

- Any member can remove themselves (leave the team) by specifying their own user ID.
- Only admins can remove other members.
- The last admin cannot leave the team. They must promote someone else first.

### Error Responses

| Status | Code | Condition |
|--------|------|-----------|
| 400 | `TEAM_LAST_ADMIN` | Last admin cannot leave without promoting another |
| 401 | `AUTH_UNAUTHORIZED` | Not authenticated |
| 403 | `TEAM_INSUFFICIENT_ROLE` | Non-admin trying to remove another member |
| 403 | `TEAM_NOT_MEMBER` | Requesting user is not a member |
| 404 | `TEAM_NOT_FOUND` | Team does not exist |
| 404 | `TEAM_NOT_FOUND` | Target user is not a member of this team |

---

## 11. Common Error Responses

All error responses follow the standard shape:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description",
    "details": []
  }
}
```

### Teams-Specific Error Codes

| Status | Code | Description |
|--------|------|-------------|
| 400 | `VALIDATION_ERROR` | Request validation failed |
| 400 | `TEAM_LAST_ADMIN` | Cannot remove/demote the last admin |
| 403 | `TEAM_NOT_MEMBER` | User is not a member of this team |
| 403 | `TEAM_INSUFFICIENT_ROLE` | User's role lacks required permission |
| 404 | `TEAM_NOT_FOUND` | Team with given ID does not exist |
| 404 | `TEAM_INVITE_NOT_FOUND` | Invitation code not found |
| 409 | `TEAM_SLUG_EXISTS` | Slug collision during team creation |
| 409 | `TEAM_MEMBER_EXISTS` | User already in team |
| 410 | `TEAM_INVITE_EXPIRED` | Invitation expired |
| 410 | `TEAM_INVITE_EXHAUSTED` | Invitation usage limit reached |

---

## 12. Data Types

### Team Object

```typescript
interface TeamResponse {
  id: string;              // UUID
  name: string;
  slug: string;            // URL-friendly unique identifier
  description: string | null;
  avatar_url: string | null;
  created_by: string;      // UUID of creating user
  created_at: string;      // ISO 8601
  updated_at: string;      // ISO 8601
  member_count: number;    // Total team members
  your_role: string;       // Requesting user's role: admin | facilitator | member
}
```

### Team Member Object

```typescript
interface TeamMemberResponse {
  user: {
    id: string;
    email: string;
    display_name: string;
    avatar_url: string | null;
  };
  role: 'admin' | 'facilitator' | 'member';
  joined_at: string;       // ISO 8601
}
```

### Invitation Object

```typescript
interface InvitationResponse {
  id: string;              // UUID
  team_id: string;         // UUID
  code: string;            // 12-char alphanumeric
  invite_url: string;      // Full URL for sharing
  created_by: string;      // UUID of creator
  expires_at: string;      // ISO 8601
  max_uses: number | null; // null = unlimited
  use_count: number;
  created_at: string;      // ISO 8601
}
```

### Pagination Object

```typescript
interface Pagination {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}
```
