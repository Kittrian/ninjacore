const orientation = [
  "horizontal",
  "vertical"
] as const

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

const size = [
  "3xs",
  "2xs",
  "xs",
  "sm",
  "md",
  "lg",
  "xl",
  "2xl",
  "3xl"
] as const

export default {
  "slots": {
    "root": "flex gap-1.5",
    "item": "group relative flex flex-1 gap-3",
    "container": "relative flex items-center gap-1.5",
    "indicator": "group-data-[state=completed]:text-inverted group-data-[state=active]:text-inverted text-muted",
    "separator": "flex-1 rounded-full bg-elevated",
    "wrapper": "w-full",
    "date": "text-dimmed text-xs/5",
    "title": "font-medium text-highlighted text-sm",
    "description": "text-muted text-wrap text-sm"
  },
  "variants": {
    "orientation": {
      "horizontal": {
        "root": "flex-row w-full",
        "item": "flex-col",
        "separator": "h-0.5"
      },
      "vertical": {
        "root": "flex-col",
        "container": "flex-col",
        "separator": "w-0.5"
      }
    },
    "color": {
      "primary": {
        "indicator": "group-data-[state=completed]:bg-primary group-data-[state=active]:bg-primary"
      },
      "secondary": {
        "indicator": "group-data-[state=completed]:bg-secondary group-data-[state=active]:bg-secondary"
      },
      "tertiary": {
        "indicator": "group-data-[state=completed]:bg-tertiary group-data-[state=active]:bg-tertiary"
      },
      "info": {
        "indicator": "group-data-[state=completed]:bg-info group-data-[state=active]:bg-info"
      },
      "success": {
        "indicator": "group-data-[state=completed]:bg-success group-data-[state=active]:bg-success"
      },
      "warning": {
        "indicator": "group-data-[state=completed]:bg-warning group-data-[state=active]:bg-warning"
      },
      "error": {
        "indicator": "group-data-[state=completed]:bg-error group-data-[state=active]:bg-error"
      },
      "gray": {
        "indicator": "group-data-[state=completed]:bg-gray group-data-[state=active]:bg-gray"
      },
      "amber": {
        "indicator": "group-data-[state=completed]:bg-amber group-data-[state=active]:bg-amber"
      },
      "sky": {
        "indicator": "group-data-[state=completed]:bg-sky group-data-[state=active]:bg-sky"
      },
      "emerald": {
        "indicator": "group-data-[state=completed]:bg-emerald group-data-[state=active]:bg-emerald"
      },
      "zinc": {
        "indicator": "group-data-[state=completed]:bg-zinc group-data-[state=active]:bg-zinc"
      },
      "red": {
        "indicator": "group-data-[state=completed]:bg-red group-data-[state=active]:bg-red"
      },
      "purple": {
        "indicator": "group-data-[state=completed]:bg-purple group-data-[state=active]:bg-purple"
      },
      "neutral": {
        "indicator": "group-data-[state=completed]:bg-inverted group-data-[state=active]:bg-inverted"
      }
    },
    "size": {
      "3xs": "",
      "2xs": "",
      "xs": "",
      "sm": "",
      "md": "",
      "lg": "",
      "xl": "",
      "2xl": "",
      "3xl": ""
    },
    "reverse": {
      "true": ""
    }
  },
  "compoundVariants": [
    {
      "color": "primary" as typeof color[number],
      "reverse": false,
      "class": {
        "separator": "group-data-[state=completed]:bg-primary"
      }
    },
    {
      "color": "secondary" as typeof color[number],
      "reverse": false,
      "class": {
        "separator": "group-data-[state=completed]:bg-secondary"
      }
    },
    {
      "color": "tertiary" as typeof color[number],
      "reverse": false,
      "class": {
        "separator": "group-data-[state=completed]:bg-tertiary"
      }
    },
    {
      "color": "info" as typeof color[number],
      "reverse": false,
      "class": {
        "separator": "group-data-[state=completed]:bg-info"
      }
    },
    {
      "color": "success" as typeof color[number],
      "reverse": false,
      "class": {
        "separator": "group-data-[state=completed]:bg-success"
      }
    },
    {
      "color": "warning" as typeof color[number],
      "reverse": false,
      "class": {
        "separator": "group-data-[state=completed]:bg-warning"
      }
    },
    {
      "color": "error" as typeof color[number],
      "reverse": false,
      "class": {
        "separator": "group-data-[state=completed]:bg-error"
      }
    },
    {
      "color": "gray" as typeof color[number],
      "reverse": false,
      "class": {
        "separator": "group-data-[state=completed]:bg-gray"
      }
    },
    {
      "color": "amber" as typeof color[number],
      "reverse": false,
      "class": {
        "separator": "group-data-[state=completed]:bg-amber"
      }
    },
    {
      "color": "sky" as typeof color[number],
      "reverse": false,
      "class": {
        "separator": "group-data-[state=completed]:bg-sky"
      }
    },
    {
      "color": "emerald" as typeof color[number],
      "reverse": false,
      "class": {
        "separator": "group-data-[state=completed]:bg-emerald"
      }
    },
    {
      "color": "zinc" as typeof color[number],
      "reverse": false,
      "class": {
        "separator": "group-data-[state=completed]:bg-zinc"
      }
    },
    {
      "color": "red" as typeof color[number],
      "reverse": false,
      "class": {
        "separator": "group-data-[state=completed]:bg-red"
      }
    },
    {
      "color": "purple" as typeof color[number],
      "reverse": false,
      "class": {
        "separator": "group-data-[state=completed]:bg-purple"
      }
    },
    {
      "color": "primary" as typeof color[number],
      "reverse": true,
      "class": {
        "separator": "group-data-[state=active]:bg-primary group-data-[state=completed]:bg-primary"
      }
    },
    {
      "color": "secondary" as typeof color[number],
      "reverse": true,
      "class": {
        "separator": "group-data-[state=active]:bg-secondary group-data-[state=completed]:bg-secondary"
      }
    },
    {
      "color": "tertiary" as typeof color[number],
      "reverse": true,
      "class": {
        "separator": "group-data-[state=active]:bg-tertiary group-data-[state=completed]:bg-tertiary"
      }
    },
    {
      "color": "info" as typeof color[number],
      "reverse": true,
      "class": {
        "separator": "group-data-[state=active]:bg-info group-data-[state=completed]:bg-info"
      }
    },
    {
      "color": "success" as typeof color[number],
      "reverse": true,
      "class": {
        "separator": "group-data-[state=active]:bg-success group-data-[state=completed]:bg-success"
      }
    },
    {
      "color": "warning" as typeof color[number],
      "reverse": true,
      "class": {
        "separator": "group-data-[state=active]:bg-warning group-data-[state=completed]:bg-warning"
      }
    },
    {
      "color": "error" as typeof color[number],
      "reverse": true,
      "class": {
        "separator": "group-data-[state=active]:bg-error group-data-[state=completed]:bg-error"
      }
    },
    {
      "color": "gray" as typeof color[number],
      "reverse": true,
      "class": {
        "separator": "group-data-[state=active]:bg-gray group-data-[state=completed]:bg-gray"
      }
    },
    {
      "color": "amber" as typeof color[number],
      "reverse": true,
      "class": {
        "separator": "group-data-[state=active]:bg-amber group-data-[state=completed]:bg-amber"
      }
    },
    {
      "color": "sky" as typeof color[number],
      "reverse": true,
      "class": {
        "separator": "group-data-[state=active]:bg-sky group-data-[state=completed]:bg-sky"
      }
    },
    {
      "color": "emerald" as typeof color[number],
      "reverse": true,
      "class": {
        "separator": "group-data-[state=active]:bg-emerald group-data-[state=completed]:bg-emerald"
      }
    },
    {
      "color": "zinc" as typeof color[number],
      "reverse": true,
      "class": {
        "separator": "group-data-[state=active]:bg-zinc group-data-[state=completed]:bg-zinc"
      }
    },
    {
      "color": "red" as typeof color[number],
      "reverse": true,
      "class": {
        "separator": "group-data-[state=active]:bg-red group-data-[state=completed]:bg-red"
      }
    },
    {
      "color": "purple" as typeof color[number],
      "reverse": true,
      "class": {
        "separator": "group-data-[state=active]:bg-purple group-data-[state=completed]:bg-purple"
      }
    },
    {
      "color": "neutral" as typeof color[number],
      "reverse": false,
      "class": {
        "separator": "group-data-[state=completed]:bg-inverted"
      }
    },
    {
      "color": "neutral" as typeof color[number],
      "reverse": true,
      "class": {
        "separator": "group-data-[state=active]:bg-inverted group-data-[state=completed]:bg-inverted"
      }
    },
    {
      "orientation": "horizontal" as typeof orientation[number],
      "size": "3xs" as typeof size[number],
      "class": {
        "wrapper": "pe-4.5"
      }
    },
    {
      "orientation": "horizontal" as typeof orientation[number],
      "size": "2xs" as typeof size[number],
      "class": {
        "wrapper": "pe-5"
      }
    },
    {
      "orientation": "horizontal" as typeof orientation[number],
      "size": "xs" as typeof size[number],
      "class": {
        "wrapper": "pe-5.5"
      }
    },
    {
      "orientation": "horizontal" as typeof orientation[number],
      "size": "sm" as typeof size[number],
      "class": {
        "wrapper": "pe-6"
      }
    },
    {
      "orientation": "horizontal" as typeof orientation[number],
      "size": "md" as typeof size[number],
      "class": {
        "wrapper": "pe-6.5"
      }
    },
    {
      "orientation": "horizontal" as typeof orientation[number],
      "size": "lg" as typeof size[number],
      "class": {
        "wrapper": "pe-7"
      }
    },
    {
      "orientation": "horizontal" as typeof orientation[number],
      "size": "xl" as typeof size[number],
      "class": {
        "wrapper": "pe-7.5"
      }
    },
    {
      "orientation": "horizontal" as typeof orientation[number],
      "size": "2xl" as typeof size[number],
      "class": {
        "wrapper": "pe-8"
      }
    },
    {
      "orientation": "horizontal" as typeof orientation[number],
      "size": "3xl" as typeof size[number],
      "class": {
        "wrapper": "pe-8.5"
      }
    },
    {
      "orientation": "vertical" as typeof orientation[number],
      "size": "3xs" as typeof size[number],
      "class": {
        "wrapper": "-mt-0.5 pb-4.5"
      }
    },
    {
      "orientation": "vertical" as typeof orientation[number],
      "size": "2xs" as typeof size[number],
      "class": {
        "wrapper": "pb-5"
      }
    },
    {
      "orientation": "vertical" as typeof orientation[number],
      "size": "xs" as typeof size[number],
      "class": {
        "wrapper": "mt-0.5 pb-5.5"
      }
    },
    {
      "orientation": "vertical" as typeof orientation[number],
      "size": "sm" as typeof size[number],
      "class": {
        "wrapper": "mt-1 pb-6"
      }
    },
    {
      "orientation": "vertical" as typeof orientation[number],
      "size": "md" as typeof size[number],
      "class": {
        "wrapper": "mt-1.5 pb-6.5"
      }
    },
    {
      "orientation": "vertical" as typeof orientation[number],
      "size": "lg" as typeof size[number],
      "class": {
        "wrapper": "mt-2 pb-7"
      }
    },
    {
      "orientation": "vertical" as typeof orientation[number],
      "size": "xl" as typeof size[number],
      "class": {
        "wrapper": "mt-2.5 pb-7.5"
      }
    },
    {
      "orientation": "vertical" as typeof orientation[number],
      "size": "2xl" as typeof size[number],
      "class": {
        "wrapper": "mt-3 pb-8"
      }
    },
    {
      "orientation": "vertical" as typeof orientation[number],
      "size": "3xl" as typeof size[number],
      "class": {
        "wrapper": "mt-3.5 pb-8.5"
      }
    }
  ],
  "defaultVariants": {
    "size": "md" as typeof size[number],
    "color": "primary" as typeof color[number]
  }
}