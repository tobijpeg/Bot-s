export async function fetchWithSessionRefresh(fetchImpl, refreshSession, input, options = {}) {
  const initialHeaders = new Headers(options.headers || {});
  const initialAuthorization = initialHeaders.get("Authorization") || "";
  const initialResponse = await fetchImpl(input, options);
  if (initialResponse.status !== 401 || !/^Bearer\s+\S+/i.test(initialAuthorization)) return initialResponse;

  try {
    const { data, error } = await refreshSession();
    const accessToken = data?.session?.access_token;
    if (error || !accessToken || initialAuthorization === `Bearer ${accessToken}`) return initialResponse;

    const retryHeaders = new Headers(options.headers || {});
    retryHeaders.set("Authorization", `Bearer ${accessToken}`);
    return await fetchImpl(input, { ...options, headers: retryHeaders });
  } catch {
    return initialResponse;
  }
}
