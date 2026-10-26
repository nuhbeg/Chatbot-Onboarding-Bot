import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  ApiError,
  customFetch,
  ResponseParseError,
  setAuthTokenGetter,
  setBaseUrl,
} from "../src/custom-fetch.ts";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  setAuthTokenGetter(null);
  setBaseUrl(null);
});

function mockFetch() {
  let requestedUrl;

  globalThis.fetch = async (input) => {
    requestedUrl = input;
    return new Response(null, { status: 204 });
  };

  return () => requestedUrl;
}

test("a null base URL clears the configured URL", async () => {
  const getRequestedUrl = mockFetch();
  setBaseUrl("https://api.example.test/v1///");
  setBaseUrl(null);

  await customFetch("/users");

  assert.equal(getRequestedUrl(), "/users");
});

test("an empty base URL clears the configured URL", async () => {
  const getRequestedUrl = mockFetch();
  setBaseUrl("https://api.example.test/v1///");
  setBaseUrl("");

  await customFetch("/users");

  assert.equal(getRequestedUrl(), "/users");
});

test("trailing slashes are removed without changing the rest of the URL", async () => {
  const getRequestedUrl = mockFetch();
  setBaseUrl("https://api.example.test/v1//resource///");

  await customFetch("/users?next=/preserve//");

  assert.equal(
    getRequestedUrl(),
    "https://api.example.test/v1//resource/users?next=/preserve//",
  );
});

test("an absolute string URL is unchanged when a base URL is configured", async () => {
  const getRequestedUrl = mockFetch();
  setBaseUrl("https://api.example.test/v1");
  const url = "https://other.example.test/users";

  await customFetch(url);

  assert.equal(getRequestedUrl(), url);
});

test("an absolute URL input is unchanged when a base URL is configured", async () => {
  const getRequestedUrl = mockFetch();
  setBaseUrl("https://api.example.test/v1");
  const url = new URL("https://other.example.test/users");

  await customFetch(url);

  assert.equal(getRequestedUrl(), url);
});

test("an absolute Request input is unchanged when a base URL is configured", async () => {
  const getRequestedUrl = mockFetch();
  setBaseUrl("https://api.example.test/v1");
  const request = new Request("https://other.example.test/users");

  await customFetch(request);

  assert.equal(getRequestedUrl(), request);
});

test("a relative POST Request keeps its method, headers, and body with the base URL", async () => {
  let requestedInput;
  let requestInit;
  globalThis.fetch = async (input, init) => {
    requestedInput = input;
    requestInit = init;
    return new Response(null, { status: 204 });
  };
  setBaseUrl("https://api.example.test/v1");
  const request = new Request("https://relative.example.test/users", {
    method: "POST",
    headers: { "x-custom-header": "custom-value" },
    body: "request payload",
  });
  // Native Request requires an absolute URL, so expose the relative URL shape
  // supported by runtimes that allow relative Request inputs.
  Object.defineProperty(request, "url", { value: "/users" });

  await customFetch(request);

  assert.equal(requestedInput.url, "https://api.example.test/v1/users");
  assert.equal(requestedInput.method, "POST");
  assert.equal(requestInit.method, "POST");
  assert.equal(requestedInput.headers.get("x-custom-header"), "custom-value");
  assert.equal(new Headers(requestInit.headers).get("x-custom-header"), "custom-value");
  assert.equal(await requestedInput.text(), "request payload");
});

test("a very long trailing slash suffix is removed", async () => {
  const getRequestedUrl = mockFetch();
  setBaseUrl(`https://api.example.test/v1${"/".repeat(100_000)}`);

  await customFetch("/users");

  assert.equal(getRequestedUrl(), "https://api.example.test/v1/users");
});

test("attaches a configured bearer token when no Authorization header is provided", async () => {
  let requestInit;
  globalThis.fetch = async (_input, init) => {
    requestInit = init;
    return new Response(null, { status: 204 });
  };
  setAuthTokenGetter(() => "configured-token");

  await customFetch("/users");

  assert.equal(new Headers(requestInit.headers).get("authorization"), "Bearer configured-token");
});

test("rejects and does not fetch when the auth token getter fails", async () => {
  const tokenError = new Error("secure token lookup failed");
  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    return new Response(null, { status: 204 });
  };
  setAuthTokenGetter(() => Promise.reject(tokenError));

  await assert.rejects(customFetch("/users"), (error) => error === tokenError);

  assert.equal(fetchCalled, false);
});

test("does not attach Authorization when the token getter returns null", async () => {
  let requestInit;
  let fetchCalled = false;
  globalThis.fetch = async (_input, init) => {
    fetchCalled = true;
    requestInit = init;
    return new Response(null, { status: 204 });
  };
  setAuthTokenGetter(() => null);

  await customFetch("/users");

  assert.equal(fetchCalled, true);
  assert.equal(new Headers(requestInit.headers).has("authorization"), false);
});

test("does not attach Authorization when the token getter returns an empty string", async () => {
  let requestInit;
  let fetchCalled = false;
  globalThis.fetch = async (_input, init) => {
    fetchCalled = true;
    requestInit = init;
    return new Response(null, { status: 204 });
  };
  setAuthTokenGetter(() => "");

  await customFetch("/users");

  assert.equal(fetchCalled, true);
  assert.equal(new Headers(requestInit.headers).has("authorization"), false);
});

test("preserves an explicit Authorization header without calling the token getter", async () => {
  let requestInit;
  let tokenGetterCalls = 0;
  globalThis.fetch = async (_input, init) => {
    requestInit = init;
    return new Response(null, { status: 204 });
  };
  setAuthTokenGetter(() => {
    tokenGetterCalls++;
    return "configured-token";
  });

  await customFetch("/users", {
    headers: { authorization: "Basic explicit-credentials" },
  });

  assert.equal(
    new Headers(requestInit.headers).get("authorization"),
    "Basic explicit-credentials",
  );
  assert.equal(tokenGetterCalls, 0);
});

test("parses successful JSON responses", async () => {
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ id: "user-1", name: "Ada" }), {
      headers: { "content-type": "application/json; charset=utf-8" },
    });

  const result = await customFetch("https://api.example.test/users/user-1");

  assert.deepEqual(result, { id: "user-1", name: "Ada" });
});

test("returns successful text responses as text", async () => {
  globalThis.fetch = async () =>
    new Response("service is ready", {
      headers: { "content-type": "text/plain; charset=utf-8" },
    });

  const result = await customFetch("https://api.example.test/health");

  assert.equal(result, "service is ready");
});

test("reports malformed JSON with request and response context", async () => {
  globalThis.fetch = async () =>
    new Response('{"id":', {
      status: 200,
      statusText: "OK",
      headers: { "content-type": "application/json" },
    });
  const url = "https://api.example.test/users";

  await assert.rejects(
    customFetch(url, { method: "POST", responseType: "json" }),
    (error) => {
      assert.ok(error instanceof ResponseParseError);
      assert.equal(error.method, "POST");
      assert.equal(error.url, url);
      assert.equal(error.status, 200);
      assert.equal(error.statusText, "OK");
      assert.equal(error.rawBody, '{"id":');
      assert.match(error.message, /POST https:\/\/api\.example\.test\/users/);
      assert.match(error.message, /200 OK/);
      assert.ok(error.cause instanceof SyntaxError);
      return true;
    },
  );
});

test("exposes status and parsed error data for unsuccessful JSON responses", async () => {
  const errorData = {
    title: "Validation failed",
    detail: "The email address is invalid.",
    field: "email",
  };
  globalThis.fetch = async () =>
    new Response(JSON.stringify(errorData), {
      status: 422,
      statusText: "Unprocessable Entity",
      headers: { "content-type": "application/problem+json" },
    });
  const url = "https://api.example.test/users";

  await assert.rejects(customFetch(url, { method: "POST" }), (error) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 422);
    assert.equal(error.statusText, "Unprocessable Entity");
    assert.deepEqual(error.data, errorData);
    assert.equal(error.method, "POST");
    assert.equal(error.url, url);
    assert.match(error.message, /Validation failed — The email address is invalid/);
    return true;
  });
});
