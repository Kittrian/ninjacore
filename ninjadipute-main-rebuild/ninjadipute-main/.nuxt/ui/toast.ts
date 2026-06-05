const color = [
  "primary",
  "secondary",
  "tertiary",
  "info",
  "success",
  "warning",
  "error",
  "gray",
  "amber",
  "sky",
  "emerald",
  "zinc",
  "red",
  "purple",
  "neutral"
] as const

export default {
  "slots": {
    "root": "relative group overflow-hidden bg-default shadow-lg rounded-lg ring ring-default p-4 flex gap-2.5 focus:outline-none",
    "wrapper": "w-0 flex-1 flex flex-col",
    "title": "text-sm font-medium text-highlighted",
    "description": "text-sm text-muted",
    "icon": "shrink-0 size-5",
    "avatar": "shrink-0",
    "avatarSize": "2xl",
    "actions": "flex gap-1.5 shrink-0",
    "progress": "absolute inset-x-0 bottom-0",
    "close": "p-0"
  },
  "variants": {
    "color": {
      "primary": {
        "root": "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
        "icon": "text-primary"
      },
      "secondary": {
        "root": "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-secondary",
        "icon": "text-secondary"
      },
      "tertiary": {
        "root": "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-tertiary",
        "icon": "text-tertiary"
      },
      "info": {
        "root": "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-info",
        "icon": "text-info"
      },
      "success": {
        "root": "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-success",
        "icon": "text-success"
      },
      "warning": {
        "root": "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-warning",
        "icon": "text-warning"
      },
      "error": {
        "root": "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-error",
        "icon": "text-error"
      },
      "gray": {
        "root": "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gray",
        "icon": "text-gray"
      },
      "amber": {
        "root": "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber",
        "icon": "text-amber"
      },
      "sky": {
        "root": "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky",
        "icon": "text-sky"
      },
      "emerald": {
        "root": "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald",
        "icon": "text-emerald"
      },
      "zinc": {
        "root": "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc",
        "icon": "text-zinc"
      },
      "red": {
        "root": "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red",
        "icon": "text-red"
      },
      "purple": {
        "root": "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-purple",
        "icon": "text-purple"
      },
      "neutral": {
        "root": "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-inverted",
        "icon": "text-highlighted"
      }
    },
    "orientation": {
      "horizontal": {
        "root": "items-center",
        "actions": "items-center"
      },
      "vertical": {
        "root": "items-start",
        "actions": "items-start mt-2.5"
      }
    },
    "title": {
      "true": {
        "description": "mt-1"
      }
    }
  },
  "defaultVariants": {
    "color": "primary" as typeof color[number]
  }
}