/**
 * §1 of docs/hero-brief.md — every content token in one place.
 * Swap these strings to re-word the hero; keep the line counts and rough
 * lengths, otherwise the hard line breaks in HeroCopy stop matching the layout.
 */

export const HERO_CONTENT = {
  /** Wordmark. Set as plain type, with no glyph standing in for a letter. */
  brand: 'CONTANGO',

  nav: ['SPREAD', 'DECAY', 'PORTFOLIO', 'DOCS'] as const,
  navCta: 'OPEN TERMINAL',

  /**
   * State A headline. Hard breaks, not wrapping.
   * Brief asks for ~40 characters per line, but at clamp(38px, 5.35vw, 88px)
   * in a 300 weight that overruns the 996px container at 1440 — see the note
   * in docs/hero-brief.md §7. Lines are held to ~20-26 characters instead.
   */
  h1: ['Two ways to hold oil.', 'Only one pays you', 'for the wait.'] as const,

  /** State A subtitle — 3 lines, ~52 chars, sits against the bottom edge. */
  sub: [
    'USO holds futures and pays to roll them forward.',
    'XOM sells the same barrel and pays a dividend.',
    'We track the gap and let you rotate between them.',
  ] as const,

  /** State B, seen from inside the shell. */
  bLead: 'Every roll has a price. We show it.',
  bBody: [
    'We snapshot both legs around the clock, including',
    'the hours when the exchange is closed.',
  ] as const,
  bCta: 'OPEN TERMINAL',
} as const

/**
 * §9.6 — real debugger output, used verbatim.
 * These are what make the frame read as a systems tool rather than generic
 * "data visualisation"; do not translate or decorate them.
 */
export const HUD_POOL: readonly string[] = [
  '==1193140== Memcheck, a memory error detector',
  '==1193140== Invalid read of size 1',
  '==1193140==    at 0x4C2E0F: parse_header (frame.c:214)',
  'push   %rbp',
  'mov    %rsp,%rbp',
  'call   0xffffffff81004508',
  'ldr    x0, [x19, #24]',
  'str    x29, [sp, #-32]!',
  'bl     0x7f2c14',
  'mov    x0, sp',
  'cmp    w1, #0x40',
  'b.ne   0x4008c0',
]

/** §9.6 — four fixed anchors, percentages of the viewport. */
export const HUD_ANCHORS = [
  { left: '17%', top: '45%' },
  { left: '69%', top: '21%' },
  { left: '63%', top: '68%' },
  { left: '31%', top: '68%' },
] as const
