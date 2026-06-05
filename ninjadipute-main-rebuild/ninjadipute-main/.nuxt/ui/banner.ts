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
    "root": [
      "relative z-50 w-full",
      "transition-colors"
    ],
    "container": "flex items-center justify-between gap-3 h-12",
    "left": "hidden lg:flex-1 lg:flex lg:items-center",
    "center": "flex items-center gap-1.5 min-w-0",
    "right": "lg:flex-1 flex items-center justify-end",
    "icon": "size-5 shrink-0 text-inverted pointer-events-none",
    "title": "text-sm text-inverted font-medium truncate",
    "actions": "flex gap-1.5 shrink-0 isolate",
    "close": "text-inverted hover:bg-default/10 focus-visible:bg-default/10 -me-1.5 lg:me-0"
  },
  "variants": {
    "color": {
      "primary": {
        "root": "bg-primary"
      },
      "secondary": {
        "root": "bg-secondary"
      },
      "tertiary": {
        "root": "bg-tertiary"
      },
      "info": {
        "root": "bg-info"
      },
      "success": {
        "root": "bg-success"
      },
      "warning": {
        "root": "bg-warning"
      },
      "error": {
        "root": "bg-error"
      },
      "gray": {
        "root": "bg-gray"
      },
      "amber": {
        "root": "bg-amber"
      },
      "sky": {
        "root": "bg-sky"
      },
      "emerald": {
        "root": "bg-emerald"
      },
      "zinc": {
        "root": "bg-zinc"
      },
      "red": {
        "root": "bg-red"
      },
      "purple": {
        "root": "bg-purple"
      },
      "neutral": {
        "root": "bg-inverted"
      }
    },
    "to": {
      "true": ""
    }
  },
  "compoundVariants": [
    {
      "color": "primary" as typeof color[number],
      "to": true,
      "class": {
        "root": "hover:bg-primary/90"
      }
    },
    {
      "color": "secondary" as typeof color[number],
      "to": true,
      "class": {
        "root": "hover:bg-secondary/90"
      }
    },
    {
      "color": "tertiary" as typeof color[number],
      "to": true,
      "class": {
        "root": "hover:bg-tertiary/90"
      }
    },
    {
      "color": "info" as typeof color[number],
      "to": true,
      "class": {
        "root": "hover:bg-info/90"
      }
    },
    {
      "color": "success" as typeof color[number],
      "to": true,
      "class": {
        "root": "hover:bg-success/90"
      }
    },
    {
      "color": "warning" as typeof color[number],
      "to": true,
      "class": {
        "root": "hover:bg-warning/90"
      }
    },
    {
      "color": "error" as typeof color[number],
      "to": true,
      "class": {
        "root": "hover:bg-error/90"
      }
    },
    {
      "color": "gray" as typeof color[number],
      "to": true,
      "class": {
        "root": "hover:bg-gray/90"
      }
    },
    {
      "color": "amber" as typeof color[number],
      "to": true,
      "class": {
        "root": "hover:bg-amber/90"
      }
    },
    {
      "color": "sky" as typeof color[number],
      "to": true,
      "class": {
        "root": "hover:bg-sky/90"
      }
    },
    {
      "color": "emerald" as typeof color[number],
      "to": true,
      "class": {
        "root": "hover:bg-emerald/90"
      }
    },
    {
      "color": "zinc" as typeof color[number],
      "to": true,
      "class": {
        "root": "hover:bg-zinc/90"
      }
    },
    {
      "color": "red" as typeof color[number],
      "to": true,
      "class": {
        "root": "hover:bg-red/90"
      }
    },
    {
      "color": "purple" as typeof color[number],
      "to": true,
      "class": {
        "root": "hover:bg-purple/90"
      }
    },
    {
      "color": "neutral" as typeof color[number],
      "to": true,
      "class": {
        "root": "hover:bg-inverted/90"
      }
    }
  ],
  "defaultVariants": {
    "color": "primary" as typeof color[number]
  }
}