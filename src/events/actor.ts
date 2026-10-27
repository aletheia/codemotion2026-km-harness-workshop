export type Actor =
  | { readonly kind: 'human';   readonly id: string; readonly note?: string }
  | { readonly kind: 'agent';   readonly id: string; readonly modelId: string;
      readonly promptVersion: string; readonly extractorVersion: string }   // 'claims@v1'
  | { readonly kind: 'harness'; readonly id: string; readonly rule: 'class-A' | 'contest' | 'eval' | 'gate' | 'bootstrap' | 'catalogue' }
  | { readonly kind: 'import';  readonly id: string; readonly source: string }
  | { readonly kind: 'process'; readonly id: 'ingest' | 'log-init' | 'acl' | 'cursor' };   // run sheet rev. 11

export type ActorKind = Actor['kind'];
