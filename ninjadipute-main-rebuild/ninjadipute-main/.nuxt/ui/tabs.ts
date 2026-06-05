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

const variant = [
  "pill",
  "link"
] as const

const orientation = [
  "horizontal",
  "vertical"
] as const

const size = [
  "xs",
  "sm",
  "md",
  "lg",
  "xl"
] as const

export default {
  "slots": {
    "root": "flex items-center gap-2",
    "list": "relative flex p-1 group",
    "indicator": "absolute transition-[translate,width] duration-200",
    "trigger": [
      "group relative inline-flex items-center min-w-0 data-[state=inactive]:text-muted hover:data-[state=inactive]:not-disabled:text-default font-medium rounded-md disabled:cursor-not-allowed disabled:opacity-75",
      "transition-colors"
    ],
    "leadingIcon": "shrink-0",
    "leadingAvatar": "shrink-0",
    "leadingAvatarSize": "",
    "label": "truncate",
    "trailingBadge": "shrink-0",
    "trailingBadgeSize": "sm",
    "content": "focus:outline-none w-full"
  },
  "variants": {
    "color": {
      "primary": "",
      "secondary": "",
      "tertiary": "",
      "info": "",
      "success": "",
      "warning": "",
      "error": "",
      "gray": "",
      "amber": "",
      "sky": "",
      "emerald": "",
      "zinc": "",
      "red": "",
      "purple": "",
      "neutral": ""
    },
    "variant": {
      "pill": {
        "list": "bg-elevated rounded-lg",
        "trigger": "grow",
        "indicator": "rounded-md shadow-xs"
      },
      "link": {
        "list": "border-default",
        "indicator": "rounded-full",
        "trigger": "focus:outline-none"
      }
    },
    "orientation": {
      "horizontal": {
        "root": "flex-col",
        "list": "w-full",
        "indicator": "left-0 w-(--reka-tabs-indicator-size) translate-x-(--reka-tabs-indicator-position)",
        "trigger": "justify-center"
      },
      "vertical": {
        "list": "flex-col",
        "indicator": "top-0 h-(--reka-tabs-indicator-size) translate-y-(--reka-tabs-indicator-position)"
      }
    },
    "size": {
      "xs": {
        "trigger": "px-2 py-1 text-xs gap-1",
        "leadingIcon": "size-4",
        "leadingAvatarSize": "3xs"
      },
      "sm": {
        "trigger": "px-2.5 py-1.5 text-xs gap-1.5",
        "leadingIcon": "size-4",
        "leadingAvatarSize": "3xs"
      },
      "md": {
        "trigger": "px-3 py-1.5 text-sm gap-1.5",
        "leadingIcon": "size-5",
        "leadingAvatarSize": "2xs"
      },
      "lg": {
        "trigger": "px-3 py-2 text-sm gap-2",
        "leadingIcon": "size-5",
        "leadingAvatarSize": "2xs"
      },
      "xl": {
        "trigger": "px-3 py-2 text-base gap-2",
        "leadingIcon": "size-6",
        "leadingAvatarSize": "xs"
      }
    }
  },
  "compoundVariants": [
    {
      "orientation": "horizontal" as typeof orientation[number],
      "variant": "pill" as typeof variant[number],
      "class": {
        "indicator": "inset-y-1"
      }
    },
    {
      "orientation": "horizontal" as typeof orientation[number],
      "variant": "link" as typeof variant[number],
      "class": {
        "list": "border-b -mb-px",
        "indicator": "-bottom-px h-px"
      }
    },
    {
      "orientation": "vertical" as typeof orientation[number],
      "variant": "pill" as typeof variant[number],
      "class": {
        "indicator": "inset-x-1",
        "list": "items-center"
      }
    },
    {
      "orientation": "vertical" as typeof orientation[number],
      "variant": "link" as typeof variant[number],
      "class": {
        "list": "border-s -ms-px",
        "indicator": "-start-px w-px"
      }
    },
    {
      "color": "primary" as typeof color[number],
      "variant": "pill" as typeof variant[number],
      "class": {
        "indicator": "bg-primary",
        "trigger": "data-[state=active]:text-inverted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      }
    },
    {
      "color": "secondary" as typeof color[number],
      "variant": "pill" as typeof variant[number],
      "class": {
        "indicator": "bg-secondary",
        "trigger": "data-[state=active]:text-inverted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
      }
    },
    {
      "color": "tertiary" as typeof color[number],
      "variant": "pill" as typeof variant[number],
      "class": {
        "indicator": "bg-tertiary",
        "trigger": "data-[state=active]:text-inverted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tertiary"
      }
    },
    {
      "color": "info" as typeof color[number],
      "variant": "pill" as typeof variant[number],
      "class": {
        "indicator": "bg-info",
        "trigger": "data-[state=active]:text-inverted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info"
      }
    },
    {
      "color": "success" as typeof color[number],
      "variant": "pill" as typeof variant[number],
      "class": {
        "indicator": "bg-success",
        "trigger": "data-[state=active]:text-inverted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-success"
      }
    },
    {
      "color": "warning" as typeof color[number],
      "variant": "pill" as typeof variant[number],
      "class": {
        "indicator": "bg-warning",
        "trigger": "data-[state=active]:text-inverted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warning"
      }
    },
    {
      "color": "error" as typeof color[number],
      "variant": "pill" as typeof variant[number],
      "class": {
        "indicator": "bg-error",
        "trigger": "data-[state=active]:text-inverted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error"
      }
    },
    {
      "color": "gray" as typeof color[number],
      "variant": "pill" as typeof variant[number],
      "class": {
        "indicator": "bg-gray",
        "trigger": "data-[state=active]:text-inverted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray"
      }
    },
    {
      "color": "amber" as typeof color[number],
      "variant": "pill" as typeof variant[number],
      "class": {
        "indicator": "bg-amber",
        "trigger": "data-[state=active]:text-inverted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
      }
    },
    {
      "color": "sky" as typeof color[number],
      "variant": "pill" as typeof variant[number],
      "class": {
        "indicator": "bg-sky",
        "trigger": "data-[state=active]:text-inverted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky"
      }
    },
    {
      "color": "emerald" as typeof color[number],
      "variant": "pill" as typeof variant[number],
      "class": {
        "indicator": "bg-emerald",
        "trigger": "data-[state=active]:text-inverted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald"
      }
    },
    {
      "color": "zinc" as typeof color[number],
      "variant": "pill" as typeof variant[number],
      "class": {
        "indicator": "bg-zinc",
        "trigger": "data-[state=active]:text-inverted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc"
      }
    },
    {
      "color": "red" as typeof color[number],
      "variant": "pill" as typeof variant[number],
      "class": {
        "indicator": "bg-red",
        "trigger": "data-[state=active]:text-inverted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red"
      }
    },
    {
      "color": "purple" as typeof color[number],
      "variant": "pill" as typeof variant[number],
      "class": {
        "indicator": "bg-purple",
        "trigger": "data-[state=active]:text-inverted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple"
      }
    },
    {
      "color": "neutral" as typeof color[number],
      "variant": "pill" as typeof variant[number],
      "class": {
        "indicator": "bg-inverted",
        "trigger": "data-[state=active]:text-inverted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-inverted"
      }
    },
    {
      "color": "primary" as typeof color[number],
      "variant": "link" as typeof variant[number],
      "class": {
        "indicator": "bg-primary",
        "trigger": "data-[state=active]:text-primary focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
      }
    },
    {
      "color": "secondary" as typeof color[number],
      "variant": "link" as typeof variant[number],
      "class": {
        "indicator": "bg-secondary",
        "trigger": "data-[state=active]:text-secondary focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-secondary"
      }
    },
    {
      "color": "tertiary" as typeof color[number],
      "variant": "link" as typeof variant[number],
      "class": {
        "indicator": "bg-tertiary",
        "trigger": "data-[state=active]:text-tertiary focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-tertiary"
      }
    },
    {
      "color": "info" as typeof color[number],
      "variant": "link" as typeof variant[number],
      "class": {
        "indicator": "bg-info",
        "trigger": "data-[state=active]:text-info focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-info"
      }
    },
    {
      "color": "success" as typeof color[number],
      "variant": "link" as typeof variant[number],
      "class": {
        "indicator": "bg-success",
        "trigger": "data-[state=active]:text-success focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-success"
      }
    },
    {
      "color": "warning" as typeof color[number],
      "variant": "link" as typeof variant[number],
      "class": {
        "indicator": "bg-warning",
        "trigger": "data-[state=active]:text-warning focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-warning"
      }
    },
    {
      "color": "error" as typeof color[number],
      "variant": "link" as typeof variant[number],
      "class": {
        "indicator": "bg-error",
        "trigger": "data-[state=active]:text-error focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-error"
      }
    },
    {
      "color": "gray" as typeof color[number],
      "variant": "link" as typeof variant[number],
      "class": {
        "indicator": "bg-gray",
        "trigger": "data-[state=active]:text-gray focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gray"
      }
    },
    {
      "color": "amber" as typeof color[number],
      "variant": "link" as typeof variant[number],
      "class": {
        "indicator": "bg-amber",
        "trigger": "data-[state=active]:text-amber focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber"
      }
    },
    {
      "color": "sky" as typeof color[number],
      "variant": "link" as typeof variant[number],
      "class": {
        "indicator": "bg-sky",
        "trigger": "data-[state=active]:text-sky focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky"
      }
    },
    {
      "color": "emerald" as typeof color[number],
      "variant": "link" as typeof variant[number],
      "class": {
        "indicator": "bg-emerald",
        "trigger": "data-[state=active]:text-emerald focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald"
      }
    },
    {
      "color": "zinc" as typeof color[number],
      "variant": "link" as typeof variant[number],
      "class": {
        "indicator": "bg-zinc",
        "trigger": "data-[state=active]:text-zinc focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc"
      }
    },
    {
      "color": "red" as typeof color[number],
      "variant": "link" as typeof variant[number],
      "class": {
        "indicator": "bg-red",
        "trigger": "data-[state=active]:text-red focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red"
      }
    },
    {
      "color": "purple" as typeof color[number],
      "variant": "link" as typeof variant[number],
      "class": {
        "indicator": "bg-purple",
        "trigger": "data-[state=active]:text-purple focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-purple"
      }
    },
    {
      "color": "neutral" as typeof color[number],
      "variant": "link" as typeof variant[number],
      "class": {
        "indicator": "bg-inverted",
        "trigger": "data-[state=active]:text-highlighted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-inverted"
      }
    }
  ],
  "defaultVariants": {
    "color": "primary" as typeof color[number],
    "variant": "pill" as typeof variant[number],
    "size": "md" as typeof size[number]
  }
}