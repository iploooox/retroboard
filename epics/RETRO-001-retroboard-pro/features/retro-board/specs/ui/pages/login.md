# UI Page Spec: Login / Register

**Feature:** auth (UI component for retro-board)
**Page:** Login & Registration
**URL:** `/login`, `/register`
**Auth:** Public (redirects to `/dashboard` if already authenticated)
**Stories:** S-001, S-002

---

## 1. Overview

A clean, centered authentication page that handles both login and registration through a tab-based interface. The page uses a single URL pattern (`/login` and `/register`) with client-side routing to switch between forms. The design is minimal and focused, removing all navigation chrome to keep the user focused on authentication.

---

## 2. ASCII Wireframe

### 2.1 Login View (`/login`)

```
+============================================================================+
|                                                                            |
|                                                                            |
|                                                                            |
|                     ┌──────────────────────────────┐                       |
|                     │                              │                       |
|                     │     ╔═══════════════════╗     │                       |
|                     │     ║  RetroBoard Pro    ║     │                       |
|                     │     ║  ──────────────    ║     │                       |
|                     │     ║  (logo graphic)    ║     │                       |
|                     │     ╚═══════════════════╝     │                       |
|                     │                              │                       |
|                     │  ┌────────────┬────────────┐ │                       |
|                     │  │   Login    │  Register   │ │                       |
|                     │  │  (active)  │             │ │                       |
|                     │  ├────────────┴────────────┤ │                       |
|                     │  │                         │ │                       |
|                     │  │  Email                  │ │                       |
|                     │  │  ┌─────────────────────┐│ │                       |
|                     │  │  │ alice@example.com   ││ │                       |
|                     │  │  └─────────────────────┘│ │                       |
|                     │  │                         │ │                       |
|                     │  │  Password               │ │                       |
|                     │  │  ┌─────────────────────┐│ │                       |
|                     │  │  │ ●●●●●●●●        [👁] ││ │                       |
|                     │  │  └─────────────────────┘│ │                       |
|                     │  │                         │ │                       |
|                     │  │  Forgot password?       │ │                       |
|                     │  │  (link, muted)          │ │                       |
|                     │  │                         │ │                       |
|                     │  │  ┌─────────────────────┐│ │                       |
|                     │  │  │      Log In         ││ │                       |
|                     │  │  └─────────────────────┘│ │                       |
|                     │  │                         │ │                       |
|                     │  └─────────────────────────┘ │                       |
|                     │                              │                       |
|                     └──────────────────────────────┘                       |
|                                                                            |
|                                                                            |
+============================================================================+
```

### 2.2 Register View (`/register`)

```
+============================================================================+
|                                                                            |
|                                                                            |
|                     ┌──────────────────────────────┐                       |
|                     │                              │                       |
|                     │     ╔═══════════════════╗     │                       |
|                     │     ║  RetroBoard Pro    ║     │                       |
|                     │     ╚═══════════════════╝     │                       |
|                     │                              │                       |
|                     │  ┌────────────┬────────────┐ │                       |
|                     │  │   Login    │  Register   │ │                       |
|                     │  │            │  (active)   │ │                       |
|                     │  ├────────────┴────────────┤ │                       |
|                     │  │                         │ │                       |
|                     │  │  Display Name           │ │                       |
|                     │  │  ┌─────────────────────┐│ │                       |
|                     │  │  │ Alice Johnson       ││ │                       |
|                     │  │  └─────────────────────┘│ │                       |
|                     │  │                         │ │                       |
|                     │  │  Email                  │ │                       |
|                     │  │  ┌─────────────────────┐│ │                       |
|                     │  │  │ alice@example.com   ││ │                       |
|                     │  │  └─────────────────────┘│ │                       |
|                     │  │                         │ │                       |
|                     │  │  Password               │ │                       |
|                     │  │  ┌─────────────────────┐│ │                       |
|                     │  │  │ ●●●●●●●●        [👁] ││ │                       |
|                     │  │  └─────────────────────┘│ │                       |
|                     │  │  Min 8 chars, 1 upper,  │ │                       |
|                     │  │  1 lower, 1 digit       │ │                       |
|                     │  │                         │ │                       |
|                     │  │  ┌─────────────────────┐│ │                       |
|                     │  │  │   Create Account    ││ │                       |
|                     │  │  └─────────────────────┘│ │                       |
|                     │  │                         │ │                       |
|                     │  └─────────────────────────┘ │                       |
|                     │                              │                       |
|                     └──────────────────────────────┘                       |
|                                                                            |
+============================================================================+
```

### 2.3 Error State

```
                     │  ┌─────────────────────────┐ │
                     │  │                         │ │
                     │  │  ┌─────────────────────┐│ │
                     │  │  │ ⚠ Invalid email or  ││ │
                     │  │  │   password           ││ │
                     │  │  └─────────────────────┘│ │
                     │  │                         │ │
                     │  │  Email                  │ │
                     │  │  ┌─────────────────────┐│ │
                     │  │  │ alice@example.com   ││ │
                     │  │  └─────────────────────┘│ │
                     │  │                         │ │
                     │  │  Password               │ │
                     │  │  ┌─────────────────────┐│ │
                     │  │  │                     ││ │
                     │  │  └─────────────────────┘│ │
                     │  │  ^ Required             │ │
                     │  │                         │ │
```

---

## 3. Component Breakdown

### 3.1 Component Tree

```
<AuthPage>
  <AuthLayout>
    <LogoBanner />
    <AuthTabSwitcher activeTab={'login' | 'register'} onSwitch={fn} />
    <AuthFormContainer>
      {tab === 'login'    && <LoginForm />}
      {tab === 'register' && <RegisterForm />}
    </AuthFormContainer>
  </AuthLayout>
</AuthPage>
```

### 3.2 Component Specifications

| Component | Description | Props | Notes |
|-----------|-------------|-------|-------|
| `AuthPage` | Page wrapper, determines tab from URL | -- | Reads route to set active tab |
| `AuthLayout` | Centered card layout with background | `children` | `min-h-screen flex items-center justify-center` |
| `LogoBanner` | RetroBoard Pro logo and tagline | -- | Static branding element |
| `AuthTabSwitcher` | Login/Register toggle tabs | `activeTab`, `onSwitch` | Navigates between `/login` and `/register` |
| `LoginForm` | Login form with email, password | -- | Submits to auth store |
| `RegisterForm` | Registration form with name, email, password | -- | Submits to auth store |
| `FormField` | Reusable labeled input with error display | `label`, `type`, `error`, `value`, `onChange` | Shared across forms |
| `PasswordInput` | Password field with show/hide toggle | `value`, `onChange`, `error` | Eye icon toggles visibility |
| `FormError` | Top-level error banner | `message: string` | Red background, warning icon |
| `SubmitButton` | Primary form submit button with loading state | `label`, `isLoading` | Disabled during submission |

---

## 4. State Management (Zustand)

### 4.1 Auth Store

```typescript
interface AuthStore {
  // Auth state
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;

  // Form state
  isSubmitting: boolean;
  loginError: string | null;
  registerError: string | null;
  fieldErrors: Record<string, string>;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAccessToken: () => Promise<void>;
  clearErrors: () => void;
  setUser: (user: User) => void;
}
```

### 4.2 State Matrix

| State | `isAuthenticated` | `isSubmitting` | `loginError` | UI Behavior |
|-------|-------------------|----------------|-------------|-------------|
| Initial (not logged in) | `false` | `false` | `null` | Show auth form |
| Already logged in | `true` | `false` | `null` | Redirect to `/dashboard` |
| Submitting | `false` | `true` | `null` | Button shows spinner, inputs disabled |
| Login failed | `false` | `false` | `string` | Show error banner above form |
| Login success | `true` | `false` | `null` | Redirect to `/dashboard` |
| Register failed (email exists) | `false` | `false` | `null` | `fieldErrors.email` set |
| Register failed (validation) | `false` | `false` | `null` | Per-field errors shown |
| Register success | `true` | `false` | `null` | Redirect to `/dashboard` |

---

## 5. User Interactions

| # | Action | Trigger | Validation | Result |
|---|--------|---------|-----------|--------|
| 1 | Switch to Register tab | Click "Register" tab or navigate to `/register` | -- | Show registration form, clear errors |
| 2 | Switch to Login tab | Click "Login" tab or navigate to `/login` | -- | Show login form, clear errors |
| 3 | Submit login form | Click "Log In" or press Enter | Email required, password required | API call, redirect on success |
| 4 | Submit register form | Click "Create Account" or press Enter | All fields validated (see below) | API call, redirect on success |
| 5 | Toggle password visibility | Click eye icon | -- | Toggle input type password/text |
| 6 | Click "Forgot password?" | Click link | -- | (Phase 5) Show "coming soon" toast |
| 7 | Tab between fields | Press Tab key | -- | Standard focus progression |
| 8 | Type in field with error | `onChange` | -- | Clear that field's error on input |

---

## 6. Validation Rules

### 6.1 Client-Side Validation (instant feedback)

| Field | Rule | Error Message |
|-------|------|---------------|
| `display_name` (register) | Required, 1-100 chars, trimmed | "Display name is required" / "Display name must be 100 characters or fewer" |
| `email` | Required, valid email format | "Email is required" / "Enter a valid email address" |
| `password` (login) | Required | "Password is required" |
| `password` (register) | Required, min 8 chars, 1 uppercase, 1 lowercase, 1 digit | "Password must be at least 8 characters" / "Password must contain an uppercase letter, a lowercase letter, and a digit" |

### 6.2 Server-Side Errors (displayed after submit)

| Error Code | Display Message | Placement |
|------------|-----------------|-----------|
| `AUTH_INVALID_CREDENTIALS` | "Invalid email or password" | Top-level error banner |
| `AUTH_EMAIL_EXISTS` | "An account with this email already exists" | Inline under email field |
| `VALIDATION_ERROR` | Per-field messages from server | Inline under respective fields |
| `INTERNAL_ERROR` | "Something went wrong. Please try again." | Top-level error banner |
| Network error | "Unable to connect. Check your internet connection." | Top-level error banner |

---

## 7. Data Requirements

### 7.1 API Endpoints

| Endpoint | Method | Purpose | Request Body |
|----------|--------|---------|--------------|
| `/api/v1/auth/login` | POST | Authenticate user | `{ email, password }` |
| `/api/v1/auth/register` | POST | Create account | `{ email, password, display_name }` |
| `/api/v1/auth/refresh` | POST | Refresh access token | `{ refresh_token }` |

### 7.2 Token Storage

| Token | Storage Location | Rationale |
|-------|------------------|-----------|
| `access_token` | In-memory (Zustand store) | Short-lived, no persistence needed |
| `refresh_token` | `localStorage` | Survives page refresh, enables silent re-auth |

### 7.3 Auth Flow on Page Load

```
Page loads
    |
    v
Check localStorage for refresh_token
    |
    ├── No token -> Show auth form
    |
    └── Token found -> Call /api/v1/auth/refresh
                           |
                           ├── Success -> Set user + tokens, redirect to /dashboard
                           |
                           └── Failure -> Clear localStorage, show auth form
```

---

## 8. Visual Design Notes

| Element | Specification |
|---------|---------------|
| Card width | `max-w-md` (448px) |
| Card background | White (`bg-white`) with `shadow-lg rounded-xl` |
| Page background | Light gray gradient (`bg-gradient-to-br from-slate-50 to-slate-100`) |
| Logo | SVG, centered above card, height 48px |
| Active tab | Bottom border accent color (`border-b-2 border-indigo-600`), bold text |
| Inactive tab | No border, gray text (`text-gray-500`) |
| Input fields | Full width, `rounded-lg border border-gray-300`, `focus:border-indigo-500 focus:ring-2` |
| Submit button | Full width, `bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-2.5` |
| Error banner | `bg-red-50 border border-red-200 text-red-700 rounded-lg p-3` |
| Field error | `text-red-600 text-sm mt-1` below the input |
| "Forgot password" link | `text-sm text-gray-500 hover:text-indigo-600` |
| Password hint (register) | `text-xs text-gray-400 mt-1` |

---

## 9. Responsive Behavior

| Breakpoint | Behavior |
|------------|----------|
| `< 640px` (mobile) | Card fills width with `mx-4` padding. Logo scales down. |
| `>= 640px` | Card at `max-w-md`, centered horizontally and vertically. |

The auth page is simple enough that it works identically on all screen sizes above mobile. The centered card pattern naturally adapts.

---

## 10. Accessibility

| Element | ARIA / A11y Requirement |
|---------|------------------------|
| Tab switcher | `role="tablist"`, each tab `role="tab"`, `aria-selected` |
| Form | `<form>` element with `aria-label="Login form"` or `"Registration form"` |
| Email input | `type="email"`, `autocomplete="email"`, `aria-required="true"` |
| Password input | `type="password"`, `autocomplete="current-password"` (login) or `"new-password"` (register) |
| Display name input | `type="text"`, `autocomplete="name"`, `aria-required="true"` |
| Show/hide password | `aria-label="Show password"` / `"Hide password"`, `aria-pressed` |
| Error banner | `role="alert"`, `aria-live="polite"` |
| Field errors | `aria-describedby` linking input to error element |
| Submit button | `aria-busy="true"` when submitting, `aria-disabled` when form invalid |
| Focus management | On tab switch, focus moves to first input of new form |

---

## 11. Error Handling

| Scenario | Behavior |
|----------|----------|
| Submit with empty required fields | Client-side validation prevents submission, shows field errors |
| Wrong credentials | Server returns 401, show "Invalid email or password" banner |
| Email already registered | Server returns 409, show inline error under email field |
| Server validation errors | Map `details[].field` to inline field errors |
| Network error | Show "Unable to connect" banner |
| Rate limited (future) | Show "Too many attempts. Please try again in X seconds." |
| Token refresh fails on page load | Clear stored tokens, show login form normally |
