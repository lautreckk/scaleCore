# ScaleForce

B2B SaaS platform for lead management and WhatsApp marketing automation.

## Features

- **Multi-tenant Architecture**: Super Admin, Tenants, and Tenant Users
- **Lead Management**: Custom webhooks, field mapping, lead scoring
- **WhatsApp Integration**: Evolution API v2.3 with multi-instance support
- **Campaign Management**: Mass messaging with real-time tracking
- **Automations**: Event-based triggers and scheduled actions
- **Wallet System**: Credit-based messaging (R$ 0.12 per message)
- **Mobile-First Design**: Red (#DC2626) and Black (#000000) dark theme

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Supabase (PostgreSQL + Auth + Realtime)
- **WhatsApp**: Evolution API v2.3
- **Hosting**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+
- Supabase account
- Evolution API instance

### Installation

1. Clone the repository:
\`\`\`bash
git clone <repo-url>
cd scaleforce
\`\`\`

2. Install dependencies:
\`\`\`bash
npm install
\`\`\`

3. Copy environment variables:
\`\`\`bash
cp .env.example .env.local
\`\`\`

4. Configure your environment variables in \`.env.local\`

5. Run the development server:
\`\`\`bash
npm run dev
\`\`\`

6. Open [http://localhost:3000](http://localhost:3000)

## Database Setup

The database schema is already applied via Supabase MCP. It includes:

### Tables
- \`super_admins\` - Platform administrators
- \`tenants\` - Customer organizations
- \`tenant_users\` - Users within tenants
- \`lead_sources\` - Webhook configurations
- \`leads\` - Lead/contact records
- \`lead_notes\` - Notes on leads
- \`lead_activities\` - Activity timeline
- \`whatsapp_instances\` - WhatsApp connections
- \`chats\` - Chat conversations
- \`messages\` - Chat messages
- \`campaigns\` - Mass messaging campaigns
- \`campaign_sends\` - Individual message sends
- \`contact_lists\` - Lead groupings
- \`contact_list_members\` - List memberships
- \`automations\` - Automation rules
- \`automation_executions\` - Execution logs
- \`wallets\` - Credit balances
- \`transactions\` - Credit transactions
- \`platform_metrics\` - Platform analytics
- \`audit_logs\` - Action audit trail
- \`webhook_events\` - Webhook logs

### Row Level Security

All tables have RLS enabled with policies for:
- Super admins: Full access to all data
- Tenant users: Access only to their tenant's data
- Role-based permissions within tenants

## API Routes

### Lead Webhook
\`POST /api/webhook/[source_id]\`

Receives leads from external sources with HMAC signature validation.

### Evolution Webhook
\`POST /api/webhooks/evolution\`

Receives WhatsApp events from Evolution API:
- QRCODE_UPDATED
- CONNECTION_UPDATE
- MESSAGES_UPSERT
- MESSAGES_UPDATE
- SEND_MESSAGE

## Deployment

### Vercel

1. Connect your repository to Vercel
2. Configure environment variables
3. Deploy

### Environment Variables for Production

Required environment variables:
- \`NEXT_PUBLIC_SUPABASE_URL\`
- \`NEXT_PUBLIC_SUPABASE_ANON_KEY\`
- \`SUPABASE_SERVICE_ROLE_KEY\`
- \`NEXT_PUBLIC_APP_URL\`
- \`EVOLUTION_API_URL\`
- \`EVOLUTION_API_KEY\`

## User Roles

### Super Admin
- Platform owner access
- Manage all tenants
- View platform metrics
- Access audit logs

### Tenant Roles
- **Owner**: Full tenant access
- **Admin**: Manage users, settings
- **Manager**: Manage leads, campaigns
- **Agent**: Handle chats, leads
- **Viewer**: Read-only access

## License

Proprietary - All rights reserved
