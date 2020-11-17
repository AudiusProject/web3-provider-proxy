/**
 * Expected env variables
 *
 *   EDGE_CACHE_TTL: number (default 60)
 *    - Duration cached requests should live on the edge
 *
 *   BROWSER_CACHE_TTL: number (default 0)
 *    - Duration browser should cache requests
 *
 *   PROVIDERS: string[]
 *    - Array of web3 provider endpoints to use
 */

EDGE_CACHE_TTL = EDGE_CACHE_TTL || 60
BROWSER_CACHE_TTL = BROWSER_CACHE_TTL || 0
PROVIDERS = JSON.parse(PROVIDERS)

/**
 * sha256 encodes a given string message
 * @param {string} message
 * Borrowed from
 * https://developers.cloudflare.com/workers/examples/cache-api
 */
async function sha256(message) {
  // encode as UTF-8
  const msgBuffer = new TextEncoder().encode(message)
  // hash the message
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer)
  // convert ArrayBuffer to Array
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  // convert bytes to hex string
  const hashHex = hashArray.map(b => ("00" + b.toString(16)).slice(-2)).join("")
  return hashHex
}

/**
 * Recursively tries to get a response from a random provider
 * @param {string} url 
 * @param {Event} event 
 */
async function tryProvider (url, request) {
  // Pick a random provider
  const provider = new URL(PROVIDERS[Math.floor(Math.random() * PROVIDERS.length)])
  // Set the current URL hostname and pathname
  url.hostname = provider.hostname
  url.pathname = provider.pathname

  // Fetch the original request against the chosen provider and cache the result
  let response
  try {
    response = await fetch(url, request)
  } catch (e) {
    console.error(e)
    response = await tryProvider(url, request)
  }
  return response
}

/**
 * Gets a response from the origin. In our case, a web3 provider endpoint.
 * @param {string} url 
 * @param {Event} event 
 * @param {Request} cacheKey 
 */
async function getOriginResponse (url, event, cacheKey) {
  const cache = caches.default

  // Try origin requests until we get a response
  let response = await tryProvider(url, event.request)

  const headers = { 'Cache-Control': `public, max-age=${EDGE_CACHE_TTL}` }
  response = new Response(response.body, { ...response, headers })
  event.waitUntil(cache.put(cacheKey, response.clone()))
  return response
}

/**
 * Formats a response, applying browser cache TTL as well as CORS headers
 * @param {Response} response 
 * @param {object} body extra body content
 */
async function formatResponse (response, body) {
  // Make a new response so headers mutable
  let formattedResponse
  if (body) {
    const originalBody = await response.json()
    const fullBody = JSON.stringify({ ...originalBody, ...body })
    formattedResponse = new Response(fullBody, response)
  } else {
    formattedResponse = new Response(response.body, response)
  }
  // Don't allow the browser to cache the response
  formattedResponse.headers.set('Cache-Control', `max-age=${BROWSER_CACHE_TTL}`)
  formattedResponse.headers.set('Access-Control-Allow-Method', '*')
  formattedResponse.headers.set('Access-Control-Allow-Origin', '*')
  formattedResponse.headers.set('Access-Control-Allow-Headers', '*')
  return formattedResponse
}

/**
 * Handles OPTIONS requests
 * Borrowed from
 * https://developers.cloudflare.com/workers/examples/cors-header-proxy
 */
async function handleOptions(event) {
  const request = event.request
  let headers = request.headers
  if (
    headers.get("Origin") !== null &&
    headers.get("Access-Control-Request-Method") !== null &&
    headers.get("Access-Control-Request-Headers") !== null
  ){
    // Handle CORS pre-flight request.
    // If you want to check or reject the requested method + headers
    // you can do that here.
    let respHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
      "Access-Control-Max-Age": "86400", // 1 day,
      // Allow all future content Request headers to go back to browser
      // such as Authorization (Bearer) or X-Client-Name-Version
      "Access-Control-Allow-Headers": request.headers.get("Access-Control-Request-Headers"),
    }

    return new Response(null, {
      headers: respHeaders,
    })
  } else {
    // Handle standard OPTIONS request.
    // If you want to allow other HTTP Methods, you can do that here.
    return new Response(null, {
      headers: {
        Allow: "GET, HEAD, POST, OPTIONS",
      },
    })
  }

}

/**
 * Handles GET requests
 */
async function handleGet(event) {
  const request = event.request
  const url = new URL(request.url)
  const cache = caches.default

  let response
  response = await cache.match(request)
  if (!response) {
    response = await getOriginResponse(url, request, request)
  }
  return formatResponse(response)
}

/**
 * Handles POST requests
 */
async function handlePost(event) {
  const request = event.request
  const url = new URL(request.url)
  const cache = caches.default
  const body = await request.clone().json()
  const id = body.id
  const cacheableBody = JSON.stringify(body.params)
  const hash = await sha256(cacheableBody)

  // Store the URL in cache by adding the body's hash
  url.pathname = "/posts" + url.pathname + hash

  // Convert to a GET to be able to cache
  const cacheKey = new Request(url.toString(), {
    headers: request.headers,
    method: "GET",
  })

  let response = await cache.match(cacheKey)
  if (!response) {
    response = await getOriginResponse(url, event, cacheKey)
  }
  return formatResponse(response, { id })
}

addEventListener("fetch", event => {
  const request = event.request
  if (request.method.toUpperCase() === "OPTIONS") {
    return event.respondWith(handleOptions(event))
  } else if (request.method.toUpperCase() === "POST") {
    return event.respondWith(handlePost(event))
  }
  return event.respondWith(handleGet(event))
})