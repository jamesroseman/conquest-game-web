import {
  ApolloClient,
  ApolloLink,
  HttpLink,
  InMemoryCache,
  from,
  Observable,
} from "@apollo/client";
import { onError } from "@apollo/client/link/error";
import { setContext } from "@apollo/client/link/context";
import { getApiUrl, getStoredToken, setStoredToken } from "@/lib/config";

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void): void {
  onUnauthorized = fn;
}

/**
 * Build a fresh client. The HTTP URI is read at request time via a custom fetch
 * so changing the API URL via the settings UI takes effect without reloading.
 */
export function createApolloClient(): ApolloClient<unknown> {
  const httpLink = new HttpLink({
    uri: () => `${getApiUrl()}/graphql`,
    fetch: (_input, init) => fetch(`${getApiUrl()}/graphql`, init),
  });

  const authLink = setContext((_op, { headers }) => {
    const token = getStoredToken();
    return {
      headers: {
        ...headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };
  });

  const errorLink = onError(({ graphQLErrors, networkError }) => {
    if (graphQLErrors) {
      for (const err of graphQLErrors) {
        const code = (err.extensions as { code?: string } | undefined)?.code;
        if (code === "UNAUTHORIZED") {
          setStoredToken(null);
          onUnauthorized?.();
          return;
        }
      }
    }
    if (networkError && "statusCode" in networkError && networkError.statusCode === 401) {
      setStoredToken(null);
      onUnauthorized?.();
    }
  });

  // No-op link kept around as a place to add request logging if we ever want it.
  const passthrough = new ApolloLink((operation, forward) => {
    return forward
      ? forward(operation)
      : new Observable((sub) => {
          sub.complete();
        });
  });

  return new ApolloClient({
    link: from([errorLink, authLink, passthrough, httpLink]),
    cache: new InMemoryCache({
      typePolicies: {
        Game: { keyFields: ["gameId"] },
        Player: { keyFields: ["playerId"] },
        Country: { keyFields: ["countryId"] },
        CountryState: { keyFields: ["countryId"] },
        Continent: { keyFields: ["continentId"] },
        Path: { keyFields: ["pathId"] },
        Map: { keyFields: ["mapId"] },
      },
    }),
  });
}
