# Responsive navigation

The portal header stays on one row. Below the MUI `md` breakpoint (900px), a menu button opens a right-hand drawer containing Home, all registered portal modules, Family members, Portal settings and Sign out. Wider screens retain direct links and account controls.

Budget and Meal Planning use the shared `SectionNav`. Below `sm` (600px), their tabs become a labeled menu showing the current section. Desktop tabs remain unchanged. All destinations are still Next.js links, and active destinations have `aria-current="page"`.

MUI manages keyboard navigation, focus trapping/restoration, Escape and backdrop dismissal. Navigation or resizing to desktop dismisses an open mobile menu. Touch targets are at least 44px, and the drawer respects the bottom safe area. No database changes are required.

## Verification

- Automated tests cover all module/account links, nested-route selection, section menus, sign-out, dismissal, focus restoration, route changes, responsive switching and hiding navigation for signed-out users.
- Static previews of the real navigation components were visually checked at 390px and 1100px with sample content, including Sunset and Midnight themes. Interaction behavior is covered by the component tests; this was not an authenticated production browser test.
- Manual device check: at 320–430px, open the main menu and each section picker, follow their links, and confirm the page has no horizontal navigation scrollbars. Try closing with the close button and backdrop, then check 768px and 1024px layouts and rotate the phone while a menu is open.
