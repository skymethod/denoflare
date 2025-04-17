// typescript 5.7, es2024 (and deno 2.2) introduced a redefinition of Uint8Array that is extremely annoying
// this is a clever utility type used by std that works in both 5.7+ and below
// https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-7.html#support-for---target-es2024-and---lib-es2024
// https://github.com/denoland/deno/pull/27857
// https://github.com/denoland/std/pull/6372/files

export type Uint8Array_ = ReturnType<Uint8Array['slice']>;
