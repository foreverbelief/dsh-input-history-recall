import type { Context } from '@deepseek-ai/cordis'

/** Stable plugin name for cordis.yml rows. */
export declare const name: string

/** Host half: intentionally empty (client-only plugin). */
export declare function apply(ctx?: Context): void
