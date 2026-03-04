# Bestfishi Freshwater Website (Remodeled)

Project path:
`/home/gokulspr/My project/fish-corporation-live`

## Implemented
- Full real-world freshwater aquaculture UI redesign with richer animations
- Freshwater-only fish catalog (no sea-food products)
- Live freshwater pricing board
- Marketplace with cart + checkout
- Separate pages for:
  - Shop Freshwater Fish
  - Request Partnership
  - Freshwater Aquaculture
  - Cold-chain Logistics
  - Traceability First
  - AI + IoT Monitoring
  - Track Order
- Sales inquiry + complaint forms
- Admin dashboard for incoming orders, complaints, and inquiries
- Admin status updates (order/complaint/inquiry)
- Order status notifications via SMS/WhatsApp (Twilio-based, when configured)
- Security protections (headers, validation, rate limits, admin key)

## Main Pages
- Website: `/`
- Ecosystem: `/ecosystem.html`
- Marketplace: `/marketplace.html`
- Technology: `/technology.html`
- Community: `/community.html`
- Contact: `/contact.html`
- Admin panel: `/admin.html`
- Shop: `/shop.html`
- Track order: `/track-order.html`

## Main APIs
- `/api/fish/live`
- `/api/site/overview`
- `/api/shop/products`
- `/api/shop/orders`
- `/api/contact/sales`
- `/api/complaints`
- `/api/ai/chat`
- `/api/orders/track`
- `/api/admin/orders` (admin key required)
- `/api/admin/sales-inquiries` (admin key required)
- `/api/admin/notifications` (admin key required)

## Run
```bash
cd "/home/gokulspr/My project/fish-corporation-live"
npm install
npm run start
```
Open:
`http://localhost:4080`

## Admin Login
Use the `ADMIN_KEY` from `.env` inside `/admin.html`.

## SMS / WhatsApp setup
Add Twilio values in `.env`:
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_SMS_FROM` or `TWILIO_SMS_SERVICE_SID`
- `TWILIO_WHATSAPP_FROM` (for WhatsApp updates)
- `DEFAULT_PHONE_COUNTRY_CODE` (default `+91`, converts 10-digit local numbers to E.164)

If these are missing, orders still work but notification logs show skipped/failed reasons.

### Real-time phone delivery checklist
1. In Twilio Console, buy/enable an SMS-capable number for your target country.
2. Put that number in `TWILIO_SMS_FROM` in E.164 format (example: `+1415xxxxxxx`).
3. For WhatsApp, enable Twilio WhatsApp sender:
   - Sandbox: users must send join code once from their WhatsApp.
   - Production sender: Meta approval required.
4. Set `TWILIO_WHATSAPP_FROM` (example: `whatsapp:+14155238886` for sandbox).
5. Update an order status to `confirmed` in `/admin.html` and verify SMS delivery + notification logs.
