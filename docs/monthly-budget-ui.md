# Monthly budget UI

The monthly plan keeps one overview with the amount left to assign (or over-assigned) as the primary value. Income, assigned money and spending are supporting values; prior-month surplus appears only when present. Click the income amount to edit it, then blur/press Enter to save or Escape to cancel.

Categories share one set of desktop column headings. Groups open by default and can be collapsed individually or together without discarding in-progress category amounts. On phones, each category shows its name above a compact Planned / Spent / Remaining row. Surplus and debt-payment indicators remain visible.

Use **Edit groups** to add groups/categories or reveal removal controls. Synced debt categories remain protected. Receipt capture and upload live under **Receipt**, and the transaction history expands on demand. Receipt analysis still requires review and explicit save.

This is a frontend change only: no migrations, Supabase function deployments or new settings.

## Manual checks

1. Open a plan in a light and dark theme, on desktop and a narrow phone viewport. Confirm the monetary columns fit and the main balance is easy to find.
2. Verify under-planned, balanced and over-planned months. Check a category with surplus, an overspent category and a debt paid this month.
3. Edit income and a category's planned amount. Confirm totals refresh; cancel an income edit with Escape. A failed save should still show its error.
4. Collapse a group, then all groups, and expand them again. Use Edit groups to add/remove a normal category; synced debt categories should not have removal controls.
5. Open Receipt and try both camera capture and image upload. Review the result and save explicitly. Also create a manual transaction, then expand Transactions to view it.
6. Navigate between months, including a blank month, and confirm the existing blank/copy-month actions still work.
