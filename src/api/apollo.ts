import {
  ApolloClient,
  ApolloLink,
  HttpLink,
  InMemoryCache,
  from,
} from "@apollo/client";
import { onError } from "@apollo/client/link/error";
import { TOKEN_STORAGE_KEY } from "@/auth/storage";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

const httpLink = new HttpLink({ uri: `${API_URL}/graphql` });

const authLink = new ApolloLink((operation, forward) => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (token) {
    operation.setContext(({ headers = {} }: { headers?: Record<string, string> }) => ({
      headers: { ...headers, Authorization: `Bearer ${token}` },
    }));
  }
  return forward(operation);
});

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void): void {
  onUnauthorized = fn;
}

const errorLink = onError(({ graphQLErrors }) => {
  if (!graphQLErrors) return;
  for (const err of graphQLErrors) {
    const code = err.extensions?.code;
    if (code === "UNAUTHORIZED") {
      onUnauthorized?.();
      return;
    }
  }
});

export function createApolloClient(): ApolloClient<unknown> {
  return new ApolloClient({
    link: from([errorLink, authLink, httpLink]),
    cache: new InMemoryCache(),
    defaultOptions: {
      watchQuery: { fetchPolicy: "cache-and-network", errorPolicy: "all" },
      query: { fetchPolicy: "network-only", errorPolicy: "all" },
    },
  });
}
