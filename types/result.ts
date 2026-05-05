export type Success<T> = {
  status: 'success';
  data: T;
};

export type Failure<E> = {
  status: 'failure';
  error: E;
};

export type Result<T, E = Error> = Success<T> | Failure<E>;

export function success<T>(data: T): Success<T> {
  return { status: 'success', data };
}

export function failure<E>(error: E): Failure<E> {
  return { status: 'failure', error };
}

export function isSuccess<T, E>(result: Result<T, E>): result is Success<T> {
  return result.status === 'success';
}

export function isFailure<T, E>(result: Result<T, E>): result is Failure<E> {
  return result.status === 'failure';
}

export class ResultHandler<T, E> {
  constructor(private result: Result<T, E>) {}

  map<U>(fn: (data: T) => U): Result<U, E> {
    if (isSuccess(this.result)) {
      return success(fn(this.result.data));
    }
    return this.result as Failure<E>;
  }

  mapError<F>(fn: (error: E) => F): Result<T, F> {
    if (isFailure(this.result)) {
      return failure(fn(this.result.error));
    }
    return this.result as Success<T>;
  }

  flatMap<U>(fn: (data: T) => Result<U, E>): Result<U, E> {
    if (isSuccess(this.result)) {
      return fn(this.result.data);
    }
    return this.result as Failure<E>;
  }

  getOrElse(defaultValue: T): T {
    return isSuccess(this.result) ? this.result.data : defaultValue;
  }

  getOrThrow(): T {
    if (isSuccess(this.result)) {
      return this.result.data;
    }
    throw this.result.error;
  }

  match<U>(
    onSuccess: (data: T) => U,
    onFailure: (error: E) => U,
  ): U {
    return isSuccess(this.result)
      ? onSuccess(this.result.data)
      : onFailure(this.result.error);
  }
}

export function handle<T, E>(result: Result<T, E>): ResultHandler<T, E> {
  return new ResultHandler(result);
}
