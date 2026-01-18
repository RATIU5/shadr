import * as Either from "effect/Either";

export type Result<Ok, Err> = Either.Either<Ok, Err>;

export const ok = Either.right;
export const err = Either.left;
export const isOk = Either.isRight;
export const isErr = Either.isLeft;

export { Either };
