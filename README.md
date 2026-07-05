# Sunday

WhatsApp bot shell for calendar blocking and schedule lookup.

```bash
npm install
npm run dev        # launches the Electron app
```

## Config

```bash
BOT_APP_NAME=Sunday
BOT_NAME=Sunday Bot
BOT_TAG=@sunday
WHATSAPP_ALLOWED_GROUPS=group-id-1,group-id-2
GOOGLE_CALENDAR_ID=primary
```

## Build

```bash
npm test
npm run typecheck
npm run build
```

Runtime files live in the Electron `userData` folder.
