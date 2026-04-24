declare module "cookie" {
  export type SerializeOptions = {
    domain?: string;
    encode?: (value: string) => string;
    expires?: Date;
    httpOnly?: boolean;
    maxAge?: number;
    path?: string;
    priority?: "low" | "medium" | "high";
    sameSite?: true | false | "lax" | "strict" | "none";
    secure?: boolean;
  };

  export function parse(
    str: string,
    options?: Record<string, unknown>
  ): Record<string, string>;

  export function serialize(
    name: string,
    value: string,
    options?: SerializeOptions
  ): string;
}
