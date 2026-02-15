# UI Selectors Reference

**⚠️ CRITICAL:** All Playwright tests MUST use these exact selectors from the actual React components. Do NOT guess element names!

Last updated: 2026-02-15

---

## Authentication Pages

### RegisterPage (`client/src/pages/RegisterPage.tsx`)

**Form Elements:**
- **Display Name Input:** `page.getByLabel('Display Name')`
  - Label: "Display Name"
  - Auto-generated ID: `display-name`
  - Placeholder: None

- **Email Input:** `page.getByLabel('Email')`
  - Label: "Email"
  - Auto-generated ID: `email`
  - Placeholder: None

- **Password Input:** `page.locator('#register-password')`
  - Label: "Password"
  - ID: `register-password` (explicit)
  - Type: password (toggleable)
  - Hint text: "Min 8 chars, 1 upper, 1 lower, 1 digit"

**Buttons:**
- **Submit Button:** `page.getByRole('button', { name: 'Create Account' })`
  - Text: "Create Account"
  - Type: submit

**Navigation:**
- **Login Tab:** `page.getByRole('tab', { name: 'Login' })`
- **Register Tab:** `page.getByRole('tab', { name: 'Register' })`

**Error Display:**
- **Alert Container:** `page.locator('[role="alert"]')`
- **Error Text:** Text content within alert div

---

### LoginPage (`client/src/pages/LoginPage.tsx`)

**Form Elements:**
- **Email Input:** `page.getByLabel('Email')`
- **Password Input:** `page.locator('#login-password')` or `page.getByRole('textbox', { name: 'Password' })`

**Buttons:**
- **Submit Button:** `page.getByRole('button', { name: /login|sign in/i })`

---

## Dashboard

### DashboardPage (`client/src/pages/DashboardPage.tsx`)

**Buttons:**
- **Create Team (Primary):** `page.getByRole('button', { name: 'Create Team' }).first()`
  - Icon: Plus
  - Text: "Create Team"
  - Opens: CreateTeamModal

- **Create Team (Empty State):** `page.getByRole('button', { name: 'Create Your First Team' })`
  - Shown when: No teams exist
  - Icon: Plus
  - Text: "Create Your First Team"

**Team List:**
- **Team Cards:** Team cards are Link elements with `to={`/teams/${team.id}`}`
- **Team Name:** Text within team card
- **Member Count:** Displayed with Users icon
- **Role Badge:** Shows user's role (admin/facilitator/member)

**Empty State:**
- **Heading:** "You're not on any teams yet."
- **Description:** "Create a team to start running retrospectives."

---

### CreateTeamModal (`client/src/components/teams/CreateTeamModal.tsx`)

**Form Elements:**
- **Team Name Input:** `page.getByLabel('Team Name')`
  - Label: "Team Name"
  - Placeholder: "e.g. Platform Team"
  - Required: Yes

- **Description Textarea:** `page.locator('#team-description')`
  - Label: "Description (optional)"
  - Placeholder: "What does this team work on?"
  - Rows: 3

**Buttons:**
- **Cancel:** `page.getByRole('button', { name: 'Cancel' })`
- **Submit:** `page.getByRole('button', { name: 'Create Team' })`
  - Note: There are TWO buttons with "Create Team" text (one in dashboard, one in modal)
  - Use `.nth(1)` for the modal submit button

---

## Team Detail Page

### TeamDetailPage (`client/src/pages/TeamDetailPage.tsx`)

**TODO:** Needs component review - check for:
- Sprint list rendering
- "Create Sprint" button
- Sprint activation button
- Board navigation link
- Team settings tabs

---

## Board Page

### BoardPage (`client/src/pages/BoardPage.tsx`)

**TODO:** Needs component review - check for:
- Column headers
- "Add a card" button/placeholder
- Card input fields
- Submit card button

---

### FacilitatorToolbar (`client/src/components/board/FacilitatorToolbar.tsx`)

**TODO:** Needs component review - check for:
- Phase transition buttons (Write → Group → Vote → Discuss → Action)
- Timer controls (Start/Stop/Reset)
- Lock/Unlock button
- Reveal votes button
- Focus mode toggle

---

### CardItem (`client/src/components/board/CardItem.tsx`)

**TODO:** Needs component review - check for:
- Edit button
- Delete button
- Vote button
- Reaction buttons
- Card content display

---

## Modals

### Modal (`client/src/components/ui/Modal.tsx`)

**TODO:** Needs component review - check for:
- Modal title
- Close button (X)
- Confirmation dialog buttons

---

## General Patterns

### Input Component (`client/src/components/ui/Input.tsx`)

**Behavior:**
- Generates ID from label: `label.toLowerCase().replace(/\s+/g, '-')`
- Example: "Team Name" → `id="team-name"`
- Use `getByLabel('Label Text')` for most inputs
- Use `locator('#explicit-id')` when ID is explicitly set

### Button Component (`client/src/components/ui/Button.tsx`)

**Selectors:**
- By text: `getByRole('button', { name: 'Button Text' })`
- By exact match: `getByRole('button', { name: /exact|pattern/i })`
- By index: `.first()`, `.nth(1)`, `.last()`

**Loading State:**
- When `isLoading={true}`, button shows spinner
- Text may change or be hidden

---

## Notes for Test Writers

1. **Always read the component first** - Don't guess selectors
2. **Use getByRole when possible** - More semantic and accessible
3. **Use getByLabel for form inputs** - Relies on proper label association
4. **Use locator('#id') for explicit IDs** - When component sets specific ID
5. **Check for multiple matches** - Use `.first()`, `.nth()`, `.last()` appropriately
6. **Wait for navigation** - Use `expect(page).toHaveURL('/path')` after actions
7. **Check for errors before asserting success** - Look for alert role elements

---

## Common Mistakes to Avoid

❌ **DON'T:** `page.getByPlaceholder('Email')` (unless explicitly set)
✅ **DO:** `page.getByLabel('Email')`

❌ **DON'T:** `page.getByText('Create')` (too ambiguous)
✅ **DO:** `page.getByRole('button', { name: 'Create Team' })`

❌ **DON'T:** `page.locator('button').first()` (fragile)
✅ **DO:** `page.getByRole('button', { name: 'Expected Text' })`

❌ **DON'T:** Assume element exists without checking component
✅ **DO:** Read the React component source first

---

## Update History

- 2026-02-15: Initial document created with Auth and Dashboard pages
- **TODO:** Complete Board, Team, and Modal sections
- **TODO:** Add component review for FacilitatorToolbar, CardItem, etc.
