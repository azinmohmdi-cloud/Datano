import Axios, { type AxiosError, type AxiosRequestConfig } from "axios";

export const AXIOS_INSTANCE = Axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL_V1,
});

export const customFetcher = <T>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig,
): Promise<T> => {
  const promise = AXIOS_INSTANCE({
    ...config,
    ...options,
  }).then(({ data }) => data);

  return promise;
};


export const fetcherHookAdapter = <T>(
  url: string,
  options?: RequestInit,
): Promise<T> => {
  const config: AxiosRequestConfig = {
    url,
    method: (options?.method as AxiosRequestConfig["method"]) ?? "GET",
    headers: options?.headers as Record<string, string>,
    signal: options?.signal ?? undefined,
    data: (options as any)?.body,
  };
  return customFetcher<T>(config);
};


export type ErrorType<Error> = AxiosError<Error>;

export type BodyType<BodyData> = BodyData;
