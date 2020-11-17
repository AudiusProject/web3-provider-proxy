# Web3 Provider Proxy

A starting point for proxying and caching excessive web3 requests with Cloudflare workers

🙋 ⇰ 🌍🌎🌏 ⇰ ⛓

## Why would I need this?

At [Audius](https://audius.co), we've found it to be useful to be able to proxy and cache requets to web3 providers.

1) Reliance on a single web3 provider has proven to be a [dangerous single point of failure](https://thedefiant.io/an-infrastructure-outage-temporarily-broke-defi/).

2) Different users frequently read the same data from chain, which is both expensive and inefficient.

3) Leaking your API keys for paid providers isn’t great when they’re hard-coded in your client / DApp


This repo is the cloudflare worker we use to give us flexible caching functionality and a extremely minimal & non-opinionated fashion.

This is an entry-point! Not all-in solution & we welcome all forking / tweaking / contributing as such tools might meet your use-cases.

## How do I use this?

1. You'll need a Cloudflare account set up with workers enabled to get going. See Cloudflare's [docs](https://developers.cloudflare.com/workers/) to get started.

2. Clone or fork this repo!

3. `cp wrangler-template.toml wrangler.toml`
   
   and replace the relevant environment variables you'd like to use. The import variables you'll want to pay attention to are

```
account_id: from your Cloudflare workers account
zone_id: from your Cloudflare workers account
name: what you'd like your worker to be called

PROVIDERS: an array of web3 providers you'd like to use
```

4. Deploy your worker

```
wrangler publish
```

5. You'll then want to set up a DNS record pointing to your workers site.

![Image of DNS](https://user-images.githubusercontent.com/2731362/99107939-73ecf600-259b-11eb-999c-fb1041215874.png)

And of course the `100::` is a dummy address per [the docs](https://developers.cloudflare.com/workers/learning/getting-started#optional-configure-for-deploying-to-a-registered-domain)

6. Update your client to send requests to your new provider!

  