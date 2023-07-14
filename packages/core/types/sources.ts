import { z } from "zod";

export type Capability<
  Input extends z.AnyZodObject = z.AnyZodObject,
  Output extends z.ZodTypeAny = z.ZodTypeAny
> = {
  name: string;
  inputType: Input;
  pagination?: "cursor" | "offset";
  run:
    | ((query: z.infer<Input>) => z.infer<Output>)
    | ((query: z.infer<Input>) => Promise<z.infer<Output>>);
  outputType: Output;
};

export type Source = {
  name: string;
  capabilities: Capability<any, any>[];
};
