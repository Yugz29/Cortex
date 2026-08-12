// Stub minimal : src/app/renderer/types.ts contient une augmentation
// `declare module 'react'` (CSSProperties). React n'est pas une dépendance de
// ce projet — cette déclaration ambiante permet à l'augmentation de compiler
// sans installer React ici.
declare module 'react' {
  interface CSSProperties {}
}
